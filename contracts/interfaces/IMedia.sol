// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {IMarket} from "./IMarket.sol";

/**
 * @title Interface for Zora Protocol's Media
 */
interface IMedia {
    struct EIP712Signature {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct MediaData {
        // The Hex representation of openAR Artwork's key
        bytes32 awKeyHex;
        // The Hex representation of openAR ArObject's key
        bytes32 objKeyHex;
        // How many times has the object been minted
        uint256 editionOf;
        // The number of the object
        uint256 editionNumber;
    }

    struct MintData {
        // A valid URI of the content represented by this token
        string tokenURI;
        // A valid URI of the metadata associated with this token
        string metadataURI;
        // The Hex representation of ArObject's parent artwork's key
        bytes32 awKeyHex;
        // The Hex representation of ArObject's key
        bytes32 objKeyHex;
        // A SHA256 hash of the content pointed to by tokenURI
        bytes32 contentHash;
        // A SHA256 hash of the content pointed to by metadataURI
        bytes32 metadataHash;
        // How many times has the object been minted
        uint256 editionOf;
        // The number of the object
        uint256 editionNumber;
    }

    struct MintArObjectData {
        // The Hex representation of ArObject's parent artwork's key
        bytes32 awKeyHex;
        // The Hex representation of ArObject's key
        bytes32 objKeyHex;
        // how many times shall the object be minted
        uint256 editionOf;
        // value of the Ask > 0
        uint256 initialAsk;
        // the mint Nonce
        uint256 mintArObjectNonce;
        // the currency of the Ask
        address currency;
        // flag if and Ask will directly be created
        bool setInitialAsk;
    }

    event TokenURIUpdated(uint256 indexed _tokenId, address owner, string _uri);
    event TokenMetadataURIUpdated(
        uint256 indexed _tokenId,
        address owner,
        string _uri
    );

    /**
     * @notice Returns true if the actor is owner or approved for the given token.
     */
    function isApprovedOrOwner(address actor, uint256 tokenId)
        external
        returns (bool);

    /**
     * @notice Returns true if the actor is owner or approved for the given token.
     */
    function isCreated(uint256 tokenId) external returns (bool);

    /**
     * @notice Return the metadata URI for a piece of media given the token URI
     */
    function tokenMetadataURI(uint256 tokenId)
        external
        view
        returns (string memory);

    /**
     * @notice Mint new media for msg.sender.
     */
    function mint(MintData calldata data, IMarket.BidShares calldata bidShares)
        external;

    /**
     * @notice EIP-712 mintWithSig method. Mints new media for a creator given a valid signature.
     */
    function mintWithSig(
        address creator,
        MintData calldata data,
        IMarket.BidShares calldata bidShares,
        uint256 mintWithSigNonce,
        EIP712Signature calldata sig
    ) external;

    /**
     * @notice EIP-712 mintArObject method. Mints an edition of the ArObject for a creator given a valid signature.
     */
    function mintArObject(
        address creator,
        string[] calldata tokenURI,
        string[] calldata metadataURI,
        bytes32[] calldata contentHash,
        bytes32[] calldata metadataHash,
        MintArObjectData calldata data,
        IMarket.BidShares calldata bidShares,
        EIP712Signature calldata sig
    ) external;

    /**
     * @notice Allow to conigure the tokens market contract
     */
    function configure(address marketContractAddress) external;

    function creatorBalanceOf(address creator) external view returns (uint256);

    function tokenOfCreatorByIndex(address creator, uint256 index)
        external
        view
        returns (uint256);

    /**
     * @notice Transfer the token with the given ID to a given address.
     * Save the previous owner before the transfer, in case there is a sell-on fee.
     * @dev This can only be called by the auction contract specified at deployment
     */
    function auctionTransfer(uint256 tokenId, address recipient) external;

    /**
     * @notice Revoke approval for a piece of media
     */
    function revokeApproval(uint256 tokenId) external;

    /**
     * @notice Update the token URI
     */
    function updateTokenURI(uint256 tokenId, string calldata tokenURI) external;

    /**
     * @notice Update the token metadata uri
     */
    function updateTokenMetadataURI(
        uint256 tokenId,
        string calldata metadataURI
    ) external;

    /**
     * @notice EIP-712 permit method. Sets an approved spender given a valid signature.
     */
    function permit(
        address spender,
        uint256 tokenId,
        EIP712Signature calldata sig
    ) external;
}
