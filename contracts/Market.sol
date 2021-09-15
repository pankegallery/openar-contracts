// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Decimal} from "./Decimal.sol";
import {Media} from "./Media.sol";
import {IMarket} from "./interfaces/IMarket.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

interface IWETH {
    function balanceOf(address guy) external returns (uint256);

    function deposit() external payable;
    function withdraw(uint wad) external;

    function transfer(address to, uint256 value) external returns (bool);
}

/**
 * @title A Market for pieces of media
 * @notice This contract contains all of the market logic for Media
 */
contract Market is IMarket, Context, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* *******
     * Globals
     * *******
     */

    // Address of the media contract that can call this market
    address public mediaContract;
    address public openARPlatform;
    address public openARPool;
    bool public enforcePlatformCuts = true;
    PlatformCuts public platformCuts;

    bool private _paused;

    // wxDai contract
    address public wrappedNativeCoin;

    // Deployment owner Address
    address private _owner;

    // Mapping from token to mapping from bidder to bid
    mapping(uint256 => mapping(address => Bid)) private _tokenBidders;

    // Mapping from token to the bid shares for the token
    mapping(uint256 => BidShares) private _bidShares;

    // Mapping from token to the current ask for the token
    mapping(uint256 => Ask) private _tokenAsks;

    /* *********
     * Modifiers
     * *********
     */

    /**
     * @notice require that the msg.sender is the configured media contract
     */
    modifier onlyMediaCaller() {
        require(mediaContract == msg.sender, "Market: Only media contract");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    /**
     * @notice Ensure that the provided spender is the approved or the owner of
     * the media for the specified tokenId
     */
    modifier tokenOnlyApprovedOrOwner(address actor, uint256 tokenId) {
        require(
            Media(mediaContract).isApprovedOrOwner(actor, tokenId),
            "Market: Only approved or owner"
        );
        _;
    }

    /**
     * @notice Ensure that the provided spender is the approved or the owner of
     * the media for the specified tokenId
     */
    modifier onlyMediaCallerOrApprovedOrOwner(address actor, uint256 tokenId) {
        require(
            actor == mediaContract ||
                Media(mediaContract).isApprovedOrOwner(actor, tokenId),
            "Market: Only media caller, approved, or owner"
        );
        _;
    }

    /**
     * @notice Ensure the token has been created (even if it has been burned)
     */
    modifier tokeOnlyCreated(uint256 tokenId) {
        require(
            Media(mediaContract).isCreated(tokenId),
            "Market: token with that id has not been created"
        );
        _;
    }

    /* ****************
     * View Functions
     * ****************
     */
    function bidForTokenBidder(uint256 tokenId, address bidder)
        external
        view
        override
        returns (Bid memory)
    {
        return _tokenBidders[tokenId][bidder];
    }

    function currentAskForToken(uint256 tokenId)
        external
        view
        override
        returns (Ask memory)
    {
        return _tokenAsks[tokenId];
    }

    function bidSharesForToken(uint256 tokenId)
        public
        view
        override
        returns (BidShares memory)
    {
        return _bidShares[tokenId];
    }

    /**
     * @notice Validates that the bid is valid by ensuring that the bid amount can be split perfectly into all the bid shares.
     *  We do this by comparing the sum of the individual share values with the amount and ensuring they are equal. Because
     *  the splitShare function uses integer division, any inconsistencies with the original and split sums would be due to
     *  a bid splitting that does not perfectly divide the bid amount.
     */
    function isValidBid(uint256 tokenId, uint256 bidAmount)
        public
        view
        override
        returns (bool)
    {
        BidShares memory bidShares = bidSharesForToken(tokenId);

        require(
            isValidBidShares(bidShares),
            "Market: Invalid bid shares for token"
        );
        return
            bidAmount != 0 &&
            (bidAmount ==
                splitShare(bidShares.creator, bidAmount)
                    .add(splitShare(bidShares.platform, bidAmount))
                    .add(splitShare(bidShares.pool, bidAmount))
                    .add(splitShare(bidShares.prevOwner, bidAmount))
                    .add(splitShare(bidShares.owner, bidAmount)));
    }

    /**
     * @notice Validates that the provided bid shares sum to 100
     */
    function isValidBidShares(BidShares memory bidShares)
        public
        pure
        override
        returns (bool)
    {
        return
            bidShares
                .creator
                .value
                .add(bidShares.owner.value)
                .add(bidShares.prevOwner.value)
                .add(bidShares.platform.value)
                .add(bidShares.pool.value) == uint256(100).mul(Decimal.BASE);
    }

    /**
     * @notice return a % of the specified amount. This function is used to split a bid into shares
     * for a media's shareholders.
     */
    function splitShare(Decimal.D256 memory sharePercentage, uint256 amount)
        public
        pure
        override
        returns (uint256)
    {
        return Decimal.mul(amount, sharePercentage).div(100);
    }

    /* ****************
     * Public Functions
     * ****************
     */
    constructor(address _wn) public {
        wrappedNativeCoin = _wn;
        _owner = _msgSender();
        _paused = false;
    }

    /**
     * @notice Sets bid shares for a particular tokenId. These bid shares must
     * sum to 100.
     */
    function setBidShares(uint256 tokenId, BidShares memory bidShares)
        public
        override
        whenNotPaused
        onlyMediaCaller
    {
        if (enforcePlatformCuts) {
            bidShares.prevOwner = Decimal.D256(0);
            bidShares.owner = Decimal.D256(
                uint256(100)
                    .mul(Decimal.BASE)
                    .sub(platformCuts.firstSalePlatform.value)
                    .sub(platformCuts.firstSalePool.value)
            );

            bidShares.platform = platformCuts.firstSalePlatform;
            bidShares.pool = platformCuts.firstSalePool;
            bidShares.creator = Decimal.D256(0);
        }

        require(
            isValidBidShares(bidShares),
            "Market: Invalid bid shares, must sum to 100"
        );

        _bidShares[tokenId] = bidShares;

        emit BidShareUpdated(tokenId, bidShares);
    }

    /**
     * @notice Sets the ask on a particular media. If the ask cannot be evenly split into the media's
     * bid shares, this reverts.
     */
    function setAsk(uint256 tokenId, Ask memory ask)
        public
        override
        whenNotPaused
        tokenOnlyApprovedOrOwner(msg.sender, tokenId)
    {
        _setAsk(tokenId, ask);
    }

    /**
     * @notice Sets the ask on a particular media. If the ask cannot be evenly split into the media's
     * bid shares, this reverts.
     */
    function setInitialAsk(uint256 tokenId, Ask memory ask)
        public
        override
        whenNotPaused
        onlyMediaCaller
    {
        _setAsk(tokenId, ask);
    }

    /**
     * @notice Set the ask for a batch of tokens of one arObject
     */
    function setAskForBatch(
        uint256[] memory tokenIds,
        IMarket.Ask memory ask,
        bytes32 objKeyHex
    ) public override whenNotPaused nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                Media(mediaContract).isApprovedOrOwner(msg.sender, tokenIds[i]),
                "Market: setAskForBatch Only approved or owner"
            );
            (, bytes32 oKH, , ) =
                Media(mediaContract).tokenMediaData(tokenIds[i]);
            require(
                oKH == objKeyHex,
                "Market: setAskForBatch only specified objKeyHex"
            );
        }

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _setAsk(tokenIds[i], ask);
        }
    }

    /**
     * @notice see IMedia
     */
    function removeAskForBatch(uint256[] calldata tokenIds)
        external
        override
        whenNotPaused
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                Media(mediaContract).isApprovedOrOwner(msg.sender, tokenIds[i]),
                "Market: removeAskForBatch Only approved or owner"
            );
        }

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _removeAsk(tokenIds[i]);
        }
    }

    /**
     * @notice removes an ask for a token and emits an AskRemoved event
     */
    function removeAsk(uint256 tokenId)
        external
        override
        whenNotPaused
        onlyMediaCallerOrApprovedOrOwner(msg.sender, tokenId)
    {
        _removeAsk(tokenId);
    }

    /**
     * @notice Sets the bid on a particular media for a bidder. The token being used to bid
     * is transferred from the spender to this contract to be held until removed or accepted.
     * If another bid already exists for the bidder, it is refunded.
     */
    function setBid(uint256 tokenId, Bid memory bid)
        public
        payable
        override
        whenNotPaused
        tokeOnlyCreated(tokenId)
    {
        require(
            bid.bidder == msg.sender,
            "Market: bidder needs to be message sender"
        );
        require(bid.bidder != address(0), "Market: bidder cannot be 0 address");
        require(bid.amount != 0, "Market: cannot bid amount of 0");
        
        require(
            bid.recipient != address(0),
            "Market: bid recipient cannot be 0 address"
        );

        BidShares memory bidShares = _bidShares[tokenId];
        require(
            bidShares
                .creator
                .value
                .add(bidShares.platform.value)
                .add(bidShares.pool.value)
                .add(bid.sellOnShare.value) <= uint256(100).mul(Decimal.BASE),
            "Market: Sell on fee invalid for share splitting 1"
        );

        require(
            !enforcePlatformCuts ||
                (platformCuts
                    .furtherSalesPlatform
                    .value
                    .add(platformCuts.furtherSalesPool.value)
                    .add(platformCuts.furtherSalesCreator.value)
                    .add(bid.sellOnShare.value) <=
                    uint256(100).mul(Decimal.BASE)),
            "Market: Sell on fee invalid for share splitting 2"
        );

        Bid memory existingBid = _tokenBidders[tokenId][bid.bidder];

        // If there is an existing bid, refund it before continuing
        if (existingBid.amount > 0) {
            _removeBid(bid.bidder, tokenId);
        }

        uint256 transfered = _handleIncomingBid(bid.amount, bid.currency);

        _tokenBidders[tokenId][bid.bidder] = Bid(
            transfered,
            bid.currency,
            bid.bidder,
            bid.recipient,
            bid.sellOnShare
        );

        emit BidCreated(tokenId, _tokenBidders[tokenId][bid.bidder]);

        // If a bid meets the criteria for an ask, automatically accept the bid.
        // If no ask is set or the bid does not meet the requirements, ignore.
        if (
            _tokenAsks[tokenId].amount > 0 && 
            bid.currency == _tokenAsks[tokenId].currency &&
            bid.amount >= _tokenAsks[tokenId].amount
        ) {
            // Finalize exchange
            _finalizeNFTTransfer(tokenId, bid.bidder);
        }
    }

    /**
     * @notice Removes the bid on a particular media for the message sender. The bid amount
     * is transferred from this contract to the bidder, if they had a bid placed.
     */
    function removeBid(uint256 tokenId)
        public
        override
        whenNotPaused
        tokeOnlyCreated(tokenId)
    {
        _removeBid(msg.sender, tokenId);
    }

    /**
     * @notice Accepts a bid from a particular bidder. Can only be called by the media contract.
     * See {_finalizeNFTTransfer}
     * Provided bid must match a bid in storage. This is to prevent a race condition
     * where a bid may change while the acceptBid call is in transit.
     * A bid cannot be accepted if it cannot be split equally into its shareholders.
     * This should only revert in rare instances (example, a low bid with a zero-decimal token),
     * but is necessary to ensure fairness to all shareholders.
     
     */
    function acceptBid(uint256 tokenId, Bid calldata expectedBid)
        external
        override
        whenNotPaused
        tokeOnlyCreated(tokenId)
        tokenOnlyApprovedOrOwner(msg.sender, tokenId)
    {
        Bid memory bid = _tokenBidders[tokenId][expectedBid.bidder];
        require(bid.amount > 0, "Market: cannot accept bid of 0");
        require(
            bid.amount == expectedBid.amount &&
                bid.currency == expectedBid.currency &&
                bid.sellOnShare.value == expectedBid.sellOnShare.value &&
                bid.recipient == expectedBid.recipient,
            "Market: Unexpected bid found."
        );
        require(
            isValidBid(tokenId, bid.amount),
            "Market: Bid invalid for share splitting"
        );

        _finalizeNFTTransfer(tokenId, bid.bidder);
    }

    /**
     * @notice Given a token ID and a bidder, this method transfers the value of
     * the bid to the shareholders. It also transfers the ownership of the media
     * to the bid recipient. Finally, it removes the accepted bid and the current ask.
     */
    function _finalizeNFTTransfer(uint256 tokenId, address bidder) private {
        Bid memory bid = _tokenBidders[tokenId][bidder];
        BidShares memory newBidShares;

        BidShares memory bidShares = _bidShares[tokenId];
        
        if (bidShares.owner.value > 0)
            // Transfer bid share to owner of media
            _handleOutgoingTransfer(
                IERC721(mediaContract).ownerOf(tokenId),
                splitShare(bidShares.owner, bid.amount),
                bid.currency
            );

        if (bidShares.creator.value > 0)
            // Transfer bid share to creator of media
            _handleOutgoingTransfer(
                Media(mediaContract).tokenCreators(tokenId),
                splitShare(bidShares.creator, bid.amount),
                bid.currency
            );

        if (bidShares.prevOwner.value > 0)
            // Transfer bid share to previous owner of media (if applicable)
            _handleOutgoingTransfer(
                Media(mediaContract).previousTokenOwners(tokenId),
                splitShare(bidShares.prevOwner, bid.amount),
                bid.currency
            );

        if (bidShares.platform.value > 0)
            // Transfer bid to the openAR platform
            _handleOutgoingTransfer(
                openARPlatform,
                splitShare(bidShares.platform, bid.amount),
                bid.currency
            );

        if (bidShares.pool.value > 0)
            // Transfer bid to the openAR pool
            _handleOutgoingTransfer(
                openARPool,
                splitShare(bidShares.pool, bid.amount),
                bid.currency
            );

        // Transfer media to bid recipient
        Media(mediaContract).auctionTransfer(tokenId, bid.recipient);

        if (enforcePlatformCuts) {
            newBidShares.platform = platformCuts.furtherSalesPlatform;
            newBidShares.pool = platformCuts.furtherSalesPool;
            newBidShares.creator = platformCuts.furtherSalesCreator;
        } else {
            newBidShares.platform = bidShares.platform;
            newBidShares.pool = bidShares.pool;
            newBidShares.creator = bidShares.creator;
        }

        // Set the previous owner share to the accepted bid's sell-on fee
        newBidShares.prevOwner = bid.sellOnShare;

        // Calculate the bid share for the new owner,
        // equal to 100 - creatorShare - sellOnShare
        newBidShares.owner = Decimal.D256(
            uint256(100)
                .mul(Decimal.BASE)
                .sub(bidShares.creator.value)
                .sub(bidShares.platform.value)
                .sub(bidShares.pool.value)
                .sub(bid.sellOnShare.value)
        );

        if (isValidBidShares(newBidShares)) {
            _bidShares[tokenId] = newBidShares;
        } else {
            newBidShares.platform = platformCuts.furtherSalesPlatform;
            newBidShares.pool = platformCuts.furtherSalesPool;
            newBidShares.creator = platformCuts.furtherSalesCreator;
            newBidShares.prevOwner = Decimal.D256(0);
            newBidShares.owner = Decimal.D256(
                uint256(100)
                    .mul(Decimal.BASE)
                    .sub(newBidShares.creator.value)
                    .sub(newBidShares.platform.value)
                    .sub(newBidShares.pool.value)
            );
        }

        _bidShares[tokenId] = newBidShares;

        // Remove the accepted bid
        delete _tokenBidders[tokenId][bidder];

        emit BidShareUpdated(tokenId, bidShares);
        emit BidFinalized(tokenId, bid);
    }

    /**
     * @notice Sets the media contract address. This address is the only permitted address that
     * can call the mutable functions.
     * @dev OpenAR we do allow to potentially overwrite the mediaContractAddress
     */
    function configure(address mediaContractAddress)
        external
        override
        onlyOwner
        whenNotPaused
    {
        require(
            mediaContractAddress != address(0),
            "Market: cannot set media contract as zero address"
        );

        mediaContract = mediaContractAddress;
    }

    /**
     * @notice Sets the OpenAR platform wallett address. This wallet will receive the platform share of any sales
     */
    function configurePlatformAddress(address platformAddress)
        external
        override
        onlyOwner
        whenNotPaused
    {
        require(
            platformAddress != address(0),
            "Market: cannot set platform wallet address as zero address"
        );

        openARPlatform = platformAddress;
    }

    /**
     * @notice Sets the OpenAR pool wallett address. This wallet will receive the pool share of any sales
     */
    function configurePoolAddress(address openARPoolAddress)
        external
        override
        onlyOwner
        whenNotPaused
    {
        require(
            openARPoolAddress != address(0),
            "Market: cannot set platform wallet address as zero address"
        );

        openARPool = openARPoolAddress;
    }

    /**
     * @notice Sets the OpenAR pool wallett address. This wallet will receive the pool share of any sales
     */
    function configurePlatformCuts(PlatformCuts memory pCuts)
        public
        override
        onlyOwner
        whenNotPaused
    {
        require(
            pCuts.firstSalePlatform.value >= uint256(0).mul(Decimal.BASE) &&
                pCuts.firstSalePlatform.value <= uint256(100).mul(Decimal.BASE),
            "Market: firstSaleCutMaintenance need to be between 0 and 100"
        );

        require(
            pCuts.firstSalePool.value >= uint256(0).mul(Decimal.BASE) &&
                pCuts.firstSalePool.value <= uint256(100).mul(Decimal.BASE),
            "Market: firstSaleCutPool need to be between 0 and 100"
        );

        require(
            pCuts.furtherSalesPlatform.value >= uint256(0).mul(Decimal.BASE) &&
                pCuts.furtherSalesPlatform.value <=
                uint256(100).mul(Decimal.BASE),
            "Market: furtherSalesCutMaintenance need to be between 0 and 100"
        );

        require(
            pCuts.furtherSalesPlatform.value >= uint256(0).mul(Decimal.BASE) &&
                pCuts.furtherSalesPlatform.value <=
                uint256(100).mul(Decimal.BASE),
            "Market: furtherSalesCutPool need to be between 0 and 100"
        );

        require(
            pCuts.furtherSalesCreator.value >= uint256(0).mul(Decimal.BASE) &&
                pCuts.furtherSalesCreator.value <=
                uint256(100).mul(Decimal.BASE),
            "Market: furtherSalesCreator need to be between 0 and 100"
        );

        platformCuts = pCuts;

        emit PlatformCutsUpdated(platformCuts);
    }

    /**
     * @notice Boolean flag wether the platform cuts are enforced or user can
     * submit own bidshare ratios
     */
    function configureEnforcePlatformCuts(bool flag)
        public
        override
        onlyOwner
        whenNotPaused
        returns (bool)
    {
        enforcePlatformCuts = flag;
        return enforcePlatformCuts;
    }

    /**
     * @notice Simple pause unpause of the market
     */
    function configurePausedUnpaused(bool flag)
        external
        override
        onlyOwner
        returns (bool)
    {
        _paused = flag;

        if (flag) {
            emit Unpaused(msg.sender);
        } else {
            emit Paused(msg.sender);
        }

        return _paused;
    }

    // INTERNAL FUNCTIONS

    /**
     * @dev Given an amount and a currency, transfer the currency to this contract.
     * If the currency is ETH (0x0), attempt to wrap the amount as WETH
     */
    function _handleIncomingBid(uint256 amount, address currency)
        internal
        returns (uint256)
    {
        // If this is an ETH bid, ensure they sent enough and convert it to WETH under the hood
        if (currency == address(0)) {
            require(
                msg.value == amount,
                "Market: Sent Native Coin Value does not match specified bid amount"
            );

            IWETH(wrappedNativeCoin).deposit{value: amount}();
        } else {
            // We must check the balance that was actually transferred to the auction,
            // as some tokens impose a transfer fee and would not actually transfer the
            // full amount to the market, resulting in potentally locked funds
            IERC20 token = IERC20(currency);
            uint256 beforeBalance = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amount);
            uint256 afterBalance = token.balanceOf(address(this));
            require(
                beforeBalance.add(amount) == afterBalance,
                "Market: Token transfer call did not transfer expected amount"
            );
        }
        return amount;
    }

    function _handleOutgoingTransfer(
        address to,
        uint256 amount,
        address currency
    ) internal {
        // If the auction is in ETH, unwrap it from its underlying WETH and try to send it to the recipient.
        if (currency == address(0)) {
            IWETH(wrappedNativeCoin).withdraw(amount);
            
            // If the ETH transfer fails (sigh), rewrap the ETH and try send it as WETH.
            if (!_safeTransferNative(to, amount)) {
                IWETH(wrappedNativeCoin).deposit{value: amount}();
                IERC20(wrappedNativeCoin).safeTransfer(to, amount);
            }
        } else {
            IERC20(currency).safeTransfer(to, amount);
        }
    }

    function _safeTransferNative(address to, uint256 value)
        internal
        returns (bool)
    {
        (bool success, ) = to.call{value: value}(new bytes(0));
        return success;
    }

    function _setAsk(uint256 tokenId, Ask memory ask) internal {
        require(
            ask.amount > 0,
            "Market: Ask needs to be > 0"
        );

        require(
            isValidBid(tokenId, ask.amount),
            "Market: Ask invalid for share splitting"
        );

        _tokenAsks[tokenId] = ask;
        // TODO: this could loop through all existing bids and close on the highest
        // matching bid
        emit AskCreated(tokenId, ask);
    }

    function _removeAsk(uint256 tokenId) internal {
        emit AskRemoved(tokenId, _tokenAsks[tokenId]);
        delete _tokenAsks[tokenId];
    }

    function _removeBid(address bidder, uint256 tokenId) internal {
        Bid memory bid = _tokenBidders[tokenId][bidder];

        require(bid.amount > 0, "Market: cannot remove bid amount of 0");

        emit BidRemoved(tokenId, bid);
        delete _tokenBidders[tokenId][bidder];

        _handleOutgoingTransfer(bid.bidder, bid.amount, bid.currency);
    }

    // FALLBACK FUNCTIONS
    receive() external payable {}

    fallback() external payable {}
}
