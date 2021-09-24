// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "../Decimal.sol";

/**
 * @title Interface for Zora Protocol's Market
 */
interface IMarket {
    struct Bid {
        // Amount of the currency being bid
        uint256 amount;
        // Address to the ERC20 token being used to bid
        address currency;
        // Address of the bidder
        address bidder;
        // Address of the recipient
        address recipient;
        // % of the next sale to award the current owner
        Decimal.D256 sellOnShare;
    }

    struct Ask {
        // Amount of the currency being asked
        uint256 amount;
        // Address to the ERC20 token being asked
        address currency;
    }

    struct BidShares {
        // % of sale value that goes to the platform for maintenance
        Decimal.D256 platform;
        // % of sale value that goes to the platform pool for supporting artist
        Decimal.D256 pool;
        // % of sale value that goes to the original creator of the nft
        Decimal.D256 creator;
        // % of sale value that goes to the seller (current owner) of the nft
        Decimal.D256 owner;
        // % of sale value that goes to the _previous_ owner of the nft
        Decimal.D256 prevOwner;
    }

    struct PlatformCuts {
        // % of sale value that goes to the platform for maintenance on the first sale
        Decimal.D256 firstSalePlatform;
        // % of sale value that goes to the platform pool for supporting artist  on the first sale
        Decimal.D256 firstSalePool;
        // % of sale value that goes to the platform for maintenance on further sales
        Decimal.D256 furtherSalesPlatform;
        // % of sale value that goes to the platform pool for supporting artist on any other sales
        Decimal.D256 furtherSalesPool;
        // % of sale value that goes to artist on subsequent sales
        Decimal.D256 furtherSalesCreator;
    }

    event BidCreated(uint256 indexed tokenId, Bid bid);
    event BidRemoved(uint256 indexed tokenId, Bid bid);
    event BidFinalized(uint256 indexed tokenId, Bid bid);
    event AskCreated(uint256 indexed tokenId, Ask ask);
    event AskRemoved(uint256 indexed tokenId, Ask ask);
    event BidShareUpdated(uint256 indexed tokenId, BidShares bidShares);
    event PlatformCutsUpdated(PlatformCuts platformCuts);
    event Paused(address account);
    event Unpaused(address account);

    function bidForTokenBidder(uint256 tokenId, address bidder)
        external
        view
        returns (Bid memory);

    function currentAskForToken(uint256 tokenId)
        external
        view
        returns (Ask memory);

    function bidSharesForToken(uint256 tokenId)
        external
        view
        returns (BidShares memory);

    function isValidBid(uint256 tokenId, uint256 bidAmount)
        external
        view
        returns (bool);

    function isValidBidShares(BidShares calldata bidShares)
        external
        pure
        returns (bool);

    function splitShare(Decimal.D256 calldata sharePercentage, uint256 amount)
        external
        pure
        returns (uint256);

    function configure(address mediaContractAddress) external;

    function configurePlatformAddress(
        address platformAddress
    ) external;

    function configurePoolAddress(
        address poolAddress
    ) external;

    function configurePlatformCuts(PlatformCuts calldata pCuts) external;

    function configureEnforcePlatformCuts(bool flag)
        external
        returns (bool);

    function configurePausedUnpaused(bool flag)
        external
        returns (bool);

    function setBidShares(uint256 tokenId, BidShares calldata bidShares)
        external;

    /**
     * @notice Set the bid on a piece of media
     */
    function setBid(uint256 tokenId, Bid calldata bid) external payable;
    
    /**
     * @notice Set the ask for a batch of NFTs of one arObject
     */
    function setAskForBatch(uint256[] calldata tokenIds, Ask calldata ask) external;

    /**
     *  @notice Removes the ask for a batch of NFTs of one arObject
     */
    function removeAskForBatch(uint256[] calldata tokenIds) external;

    /**
     * @notice Remove the ask on a piece of media
     */
    function removeAsk(uint256 tokenId) external;

    /**
     * @notice Set the ask on a piece of media
     */
    function setAsk(uint256 tokenId, Ask calldata ask) external;
    
    /**
     * @notice Set the ask on a piece of media
     */
    function setInitialAsk(uint256 tokenId, Ask calldata ask) external;

    /**
     * @notice Remove the bid on a piece of media
     */
    function removeBid(uint256 tokenId) external;

    function acceptBid(uint256 tokenId, Bid calldata bid) external;

    
}
