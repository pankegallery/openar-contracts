// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {ERC721Burnable} from "./ERC721Burnable.sol";
import {ERC721} from "./ERC721.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Decimal} from "./Decimal.sol";
import {IMarket} from "./interfaces/IMarket.sol";
import "./interfaces/IMedia.sol";

// TODO: Split mint wallet from deployer wallet
// TODO: MaxEditionOf 
// import "hardhat/console.sol";

/**
 * @title A media value system, with perpetual equity to creators
 * @notice This contract provides an interface to mint media with a market
 * owned by the creator.
 */
contract Media is IMedia, ERC721Burnable, ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    /* *******
     * Globals
     * *******
     */

    // Deployment Address
    address private _owner;

    // Address for the market
    address public marketContract;

    // Mapping from token to previous owner of the token
    mapping(uint256 => address) public previousTokenOwners;

    // Mapping from token id to creator address
    mapping(uint256 => address) public tokenCreators;

    // Mapping from creator address to their (enumerable) set of created tokens
    mapping(address => EnumerableSet.UintSet) private _creatorTokens;

    // Mapping from token id to sha256 hash of content
    mapping(uint256 => bytes32) public tokenContentHashes;

    // Mapping from token id to sha256 hash of metadata
    mapping(uint256 => bytes32) public tokenMetadataHashes;

    // Mapping from token id to MediaData
    mapping(uint256 => MediaData) public tokenMediaData;

    // Mapping from token id to metadataURI
    mapping(uint256 => string) private _tokenMetadataURIs;

    // Mapping from contentHash to bool
    mapping(bytes32 => bool) private _contentHashes;

    // Mapping from objectKeyHash to bool
    mapping(bytes32 => bool) private _arObjectKeyHashes;

    //keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;

    // ethers.utils.solidityKeccak256([ "string" ], [ "MintWithSig(bytes32 awKeyHash,bytes32 objKeyHash,bytes32 contentHash,bytes32 metadataHash,uint256 creatorShare,uint256 nonce,uint256 deadline)" ])
    //keccak256("MintWithSig(bytes32 awKeyHash,bytes32 objKeyHash,bytes32 contentHash,bytes32 metadataHash,uint256 creatorShare,uint256 nonce,uint256 deadline)");
    bytes32 public constant MINT_WITH_SIG_TYPEHASH =
        0x02752aeafd7f75c1808a9321b32cd92c7997ecbc884ab0bd78b50f3eeaa0e1d0;

    // ethers.utils.solidityKeccak256([ "string" ], [ "MintArObject(bytes32 awKeyHash,bytes32 objKeyHash,uint256 editionOf,bool setInitialAsk,uint256 initialAsk,uint256 nonce,uint256 deadline)" ])
    // keccak256("MintArObject(bytes32 awKeyHash,bytes32 objKeyHash,uint256 editionOf,bool setInitialAsk,uint256 initialAsk,uint256 nonce,uint256 deadline)");
    bytes32 public constant MINT_AROBJECT_TYPEHASH =
        0x60281011d055d6009ac61cc127d5ba3be4c3365ba07cd49830c77f68bdc52141;
    
    // Mapping from address to token id to permit nonce
    mapping(address => mapping(uint256 => uint256)) public permitNonces;

    // Mapping from address to mint with sig nonce
    mapping(address => uint256) public mintWithSigNonces;

    // Mapping create address to nonce (which is a random/unique large number) and nonce use flag
    mapping(address => mapping(uint256 => bool))
        private mintArObjectSigNoncesState;

    /*
     *     bytes4(keccak256('name()')) == 0x06fdde03
     *     bytes4(keccak256('symbol()')) == 0x95d89b41
     *     bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
     *     bytes4(keccak256('tokenMetadataURI(uint256)')) == 0x157c3df9
     *
     *     => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd ^ 0x157c3df9 == 0x4e222e66
     */
    bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x4e222e66;

    Counters.Counter private _tokenIdTracker;

    /* *********
     * Modifiers
     * *********
     */

    /**
     * @notice Require that the token has not been burned and has been minted
     */
    modifier onlyExistingToken(uint256 tokenId) {
        require(_exists(tokenId), "Media: nonexistent token");
        _;
    }

    /**
     * @notice Require that the token has had a content hash set
     */
    modifier onlyTokenWithContentHash(uint256 tokenId) {
        require(
            tokenContentHashes[tokenId] != 0,
            "Media: token does not have hash of created content"
        );
        _;
    }

    /**
     * @notice Require that the token has had a metadata hash set
     */
    modifier onlyTokenWithMetadataHash(uint256 tokenId) {
        require(
            tokenMetadataHashes[tokenId] != 0,
            "Media: token does not have hash of its metadata"
        );
        _;
    }

    
    /**
     * @notice Ensure that the provided spender is the approved or the owner of
     * the media for the specified tokenId
     */
    modifier onlyApprovedOrOwner(address spender, uint256 tokenId) {
        require(
            _isApprovedOrOwner(spender, tokenId),
            "Media: Only approved or owner"
        );
        _;
    }

    /**
     * @notice Ensure the token has been created (even if it has been burned)
     */
    modifier onlyTokenCreated(uint256 tokenId) {
        require(
            _tokenIdTracker.current() > tokenId,
            "Media: token with that id does not exist"
        );
        _;
    }

    /**
     * @notice Ensure that the provided URI is not empty
     */
    modifier onlyValidURI(string memory uri) {
        require(
            bytes(uri).length != 0,
            "Media: specified uri must be non-empty"
        );
        _;
    }

    /**
     * @notice On deployment, set the market contract address and register the
     * ERC721 metadata interface
     * @dev In case you change the name, also change it in _calculateDomainSeparator() at the very bottom
     */
    constructor() public ERC721("openAR", "OPENAR") {
        _owner = _msgSender();

        // _setOwner(_msgSender());
        _registerInterface(_INTERFACE_ID_ERC721_METADATA);
    }

    /* **************
     * View Functions
     * **************
     */

    /**
     * @notice return the URI for a particular piece of media with the specified tokenId
     * @dev This function is an override of the base OZ implementation because we
     * will return the tokenURI even if the media has been burned. In addition, this
     * protocol does not support a base URI, so relevant conditionals are removed.
     * @return the URI for a token
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        onlyTokenCreated(tokenId)
        returns (string memory)
    {
        string memory _tokenURI = _tokenURIs[tokenId];

        return _tokenURI;
    }

    /**
     * @notice Return the metadata URI for a piece of media given the token URI
     * @return the metadata URI for the token
     */
    function tokenMetadataURI(uint256 tokenId)
        external
        view
        override
        onlyTokenCreated(tokenId)
        returns (string memory)
    {
        return _tokenMetadataURIs[tokenId];
    }

    /**
     * @notice Returns the number of token the creator has created
     * @return uint256 number of tokens
     */
    function creatorBalanceOf(address creator)
        public
        view
        override
        returns (uint256)
    {
        require(
            creator != address(0),
            "Media: balance query for the zero address"
        );

        return _creatorTokens[creator].length();
    }

    /**
     * @notice Returns the tokenId at the index of the token created by the creator
     * @return uint256 number of tokens
     */
    function tokenOfCreatorByIndex(address creator, uint256 index)
        public
        view
        override
        returns (uint256)
    {
        require(
            creator != address(0),
            "Media: tokenOfCreatorByIndex query for the zero address"
        );

        return _creatorTokens[creator].at(index);
    }

    /* ****************
     * Public Functions
     * ****************
     */

    /**
     * @notice Returns true if the actor is owner or approved for the given token.
     */
    function isApprovedOrOwner(address actor, uint256 tokenId)
        public
        override
        returns (bool)
    {
        return _isApprovedOrOwner(actor, tokenId);
    }

     /**
     * @notice Returns true if the token has been created
     */
    function isCreated(uint256 tokenId)
        public
        override
        returns (bool)
    {
        return _tokenIdTracker.current() > tokenId;
    }

    /**
     * @notice see IMedia
     *
     */
    function mintArObject(
        address creator,
        string[] memory tokenURIs,
        string[] memory metadataURIs,
        bytes32[] memory contentHashes,
        bytes32[] memory metadataHashes,
        MintArObjectData memory data,
        IMarket.BidShares memory bidShares,
        EIP712Signature memory sig
    ) public override onlyOwner nonReentrant {
        require(
            sig.deadline == 0 || sig.deadline >= block.timestamp,
            "Media: mintArObject expired"
        );

        require(
            metadataURIs.length == tokenURIs.length &&
            contentHashes.length == tokenURIs.length &&
            metadataHashes.length == tokenURIs.length,
            "Media: mintArObject invalid-data 1"
        );

        require(
            data.batchOffset + data.batchSize <= data.editionOf,
            "Media: mintArObject invalid-data 2"
        );

        require(
            data.batchSize == tokenURIs.length,
            "Media: mintArObject invalid-data 3"
        );

        require(
            !mintArObjectSigNoncesState[creator][data.mintArObjectNonce],
            "Media: mintArObject invalid-nonce"
        );

        if (data.batchOffset + data.batchSize == data.editionOf)
            mintArObjectSigNoncesState[creator][data.mintArObjectNonce] = true;

        bytes32 domainSeparator = _calculateDomainSeparator();

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSeparator,
                    keccak256(
                        abi.encode(
                            MINT_AROBJECT_TYPEHASH,
                            sha256(abi.encodePacked(data.awKeyHex)),
                            sha256(abi.encodePacked(data.objKeyHex)),
                            data.editionOf,
                            data.setInitialAsk,
                            data.initialAsk,
                            data.mintArObjectNonce,
                            sig.deadline
                        )
                    )
                )
            );

        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(
            recoveredAddress != address(0) && creator == recoveredAddress,
            "Media: Signature invalid"
        );

        require(
            !data.setInitialAsk || data.initialAsk > 0,
            "Media: mintArObject initialAsk is zero"
        );

        require(
            _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] ==
                false,
            "Media: mintArObject arObject hash already been minted"
        );

        // first we loop through all passed on token values to make sure that the whole
        // batch will be minted
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            require(
                contentHashes[i] != 0,
                "Media: mintArObject all content hashes must be non-zero"
            );
            require(
                _contentHashes[contentHashes[i]] == false,
                "Media: mintArObject a token has already been created with one of the content hashes"
            );
            require(
                metadataHashes[i] != 0,
                "Media: mintArObject all metadata hash must be non-zero"
            );
        }

        uint256[] memory tokenIds = new uint256[](tokenURIs.length);

        // now mint all of them
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            MintData memory mData =
                MintData(
                    tokenURIs[i],
                    metadataURIs[i],
                    data.awKeyHex,
                    data.objKeyHex,
                    contentHashes[i],
                    metadataHashes[i],
                    data.editionOf,
                    i + 1 + data.batchOffset
                );

            tokenIds[i] =
                _mintForCreator(recoveredAddress, mData, bidShares);

            if (data.setInitialAsk) {
                IMarket.Ask memory ask =
                    IMarket.Ask(data.initialAsk, data.currency);
                IMarket(marketContract).setInitialAsk(tokenIds[i], ask);
            }

        }

        emit TokenObjectMinted(tokenIds, MintObjectData(
            data.awKeyHex,
            data.objKeyHex,
            data.editionOf
        ));

        if (data.batchOffset + data.batchSize == data.editionOf)
            _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] = true;
    }

    /**
     * @notice see IMedia
     */
    function mint(MintData memory data, IMarket.BidShares memory bidShares)
        public
        override
        nonReentrant
    {
        require(
            _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] ==
                false,
            "Media: mint arObject hash already been minted"
        );
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = _mintForCreator(msg.sender, data, bidShares);

        emit TokenObjectMinted(tokenIds, MintObjectData(
            data.awKeyHex,
            data.objKeyHex,
            data.editionOf
        ));

         // now set this object key as already minted
        _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] = true;
    }

    /**
     * @notice see IMedia
     *
     */
    function mintWithSig(
        address creator,
        MintData memory data,
        IMarket.BidShares memory bidShares,
        uint256 mintWithSigNonce,
        EIP712Signature memory sig
    ) public override nonReentrant {
        require(
            sig.deadline == 0 || sig.deadline >= block.timestamp,
            "Media: mintWithSig expired"
        );

        require(
            mintWithSigNonce == mintWithSigNonces[creator]++,
            "Media: mintWithSig invalid-nonce"
        );

        bytes32 domainSeparator = _calculateDomainSeparator();

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSeparator,
                    keccak256(
                        abi.encode(
                            MINT_WITH_SIG_TYPEHASH,
                            sha256(abi.encodePacked(data.awKeyHex)),
                            sha256(abi.encodePacked(data.objKeyHex)),
                            data.contentHash,
                            data.metadataHash,
                            bidShares.creator.value,
                            mintWithSigNonce,
                            sig.deadline
                        )
                    )
                )
            );

        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(
            recoveredAddress != address(0) && creator == recoveredAddress,
            "Media: mintWithSig signature invalid"
        );

        require(
            _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] ==
                false,
            "Media: mintWithSig arObject hash already been minted"
        );

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = _mintForCreator(recoveredAddress, data, bidShares);

        emit TokenObjectMinted(tokenIds, MintObjectData(
            data.awKeyHex,
            data.objKeyHex,
            data.editionOf
        ));

        // now set this object key as already minted
        _arObjectKeyHashes[sha256(abi.encodePacked(data.objKeyHex))] = true;
    }

    /**
     * @notice see IMedia
     */
    function auctionTransfer(uint256 tokenId, address recipient)
        external
        override
    {
        require(msg.sender == marketContract, "Media: only market contract");
        previousTokenOwners[tokenId] = ownerOf(tokenId);

        _safeTransfer(ownerOf(tokenId), recipient, tokenId, "");
    }

    /**
     * @notice Burn a token.
     * @dev Only callable if the media owner is also the creator.
     */
    function burn(uint256 tokenId)
        public
        override
        nonReentrant
        onlyExistingToken(tokenId)
        onlyApprovedOrOwner(msg.sender, tokenId)
    {
        address owner = ownerOf(tokenId);

        require(
            tokenCreators[tokenId] == owner,
            "Media: owner is not creator of media"
        );

        _burn(tokenId);
    }

    /**
     * @notice Sets the market contract address. This address is the only permitted address that
     * can call the mutable functions. This method can only be called once.
     * @dev OpenAR: We moved this from the constructor to a configurabe function.
     */
    function configure(address marketContractAddr) external override onlyOwner {
        require(
            marketContractAddr != address(0),
            "Media: cannot set media contract as zero address"
        );

        marketContract = marketContractAddr;
    }

    /**
     * @notice Revoke the approvals for a token. The provided `approve` function is not sufficient
     * for this protocol, as it does not allow an approved address to revoke it's own approval.
     * In instances where a 3rd party is interacting on a user's behalf via `permit`, they should
     * revoke their approval once their task is complete as a best practice.
     */
    function revokeApproval(uint256 tokenId) external override nonReentrant {
        require(
            msg.sender == getApproved(tokenId),
            "Media: caller not approved address"
        );
        _approve(address(0), tokenId);
    }

    /**
     * @notice see IMedia
     * @dev only callable by approved or owner
     */
    function updateTokenURI(uint256 tokenId, string calldata tokenURI)
        external
        override
        nonReentrant
        onlyApprovedOrOwner(msg.sender, tokenId)
        onlyTokenWithContentHash(tokenId)
        onlyValidURI(tokenURI)
    {
        _setTokenURI(tokenId, tokenURI);
        emit TokenURIUpdated(tokenId, msg.sender, tokenURI);
    }

    /**
     * @notice see IMedia
     * @dev only callable by approved or owner
     */
    function updateTokenMetadataURI(
        uint256 tokenId,
        string calldata metadataURI
    )
        external
        override
        nonReentrant
        onlyApprovedOrOwner(msg.sender, tokenId)
        onlyTokenWithMetadataHash(tokenId)
        onlyValidURI(metadataURI)
    {
        _setTokenMetadataURI(tokenId, metadataURI);
        emit TokenMetadataURIUpdated(tokenId, msg.sender, metadataURI);
    }

    /**
     * @notice See IMedia
     * @dev This method is loosely based on the permit for ERC-20 tokens in  EIP-2612, but modified
     * for ERC-721.
     */
    function permit(
        address spender,
        uint256 tokenId,
        EIP712Signature memory sig
    ) public override nonReentrant onlyExistingToken(tokenId) {
        require(
            sig.deadline == 0 || sig.deadline >= block.timestamp,
            "Media: Permit expired"
        );
        require(spender != address(0), "Media: spender cannot be 0x0");
        bytes32 domainSeparator = _calculateDomainSeparator();

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSeparator,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            spender,
                            tokenId,
                            permitNonces[ownerOf(tokenId)][tokenId]++,
                            sig.deadline
                        )
                    )
                )
            );

        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(
            recoveredAddress != address(0) &&
                ownerOf(tokenId) == recoveredAddress,
            "Media: permit signature invalid"
        );

        _approve(spender, tokenId);
    }

    /* *****************
     * Private Functions
     * *****************
     */

    /**
     * @notice Creates a new token for `creator`. Its token ID will be automatically
     * assigned (and available on the emitted {IERC721-Transfer} event), and the token
     * URI autogenerated based on the base URI passed at construction.
     *
     * See {ERC721-_safeMint}.
     *
     * On mint, also set the sha256 hashes of the content and its metadata for integrity
     * checks, along with the initial URIs to point to the content and metadata. Attribute
     * the token ID to the creator, mark the content hash as used, and set the bid shares for
     * the media's market.
     *
     * Note that although the content hash must be unique for future mints to prevent duplicate media,
     * metadata has no such requirement.
     */
    function _mintForCreator(
        address creator,
        MintData memory data,
        IMarket.BidShares memory bidShares
    )
        internal
        onlyValidURI(data.tokenURI)
        onlyValidURI(data.metadataURI)
        returns (uint256)
    {
        require(data.contentHash != 0, "Media: content hash must be non-zero");
        require(
            data.metadataHash != 0,
            "Media: metadata hash must be non-zero"
        );
        require(data.awKeyHex != 0, "Media: awKeyHex hash must be non-zero");
        require(data.objKeyHex != 0, "Media: objKeyHex hash must be non-zero");
        require(
            _contentHashes[data.contentHash] == false,
            "Media: a token has already been created with this content hash"
        );
        require(data.editionOf > 0, "Media: editionOf hash must be > zero");
        require(
            data.editionNumber > 0,
            "Media: editionNumber hash must be > zero"
        );

        uint256 tokenId = _tokenIdTracker.current();

        _safeMint(creator, tokenId);
        _tokenIdTracker.increment();
        _setTokenContentHash(tokenId, data.contentHash);
        _setTokenMetadataHash(tokenId, data.metadataHash);
        _setTokenMetadataURI(tokenId, data.metadataURI);
        _setTokenURI(tokenId, data.tokenURI);
        _creatorTokens[creator].add(tokenId);
        _contentHashes[data.contentHash] = true;

        tokenMediaData[tokenId] = MediaData(
            data.awKeyHex,
            data.objKeyHex,
            data.editionOf,
            data.editionNumber
        );

        tokenCreators[tokenId] = creator;
        previousTokenOwners[tokenId] = creator;

        IMarket(marketContract).setBidShares(tokenId, bidShares);

        return tokenId;
    }

    function _setTokenContentHash(uint256 tokenId, bytes32 contentHash)
        internal
        virtual
        onlyExistingToken(tokenId)
    {
        tokenContentHashes[tokenId] = contentHash;
    }

    function _setTokenMetadataHash(uint256 tokenId, bytes32 metadataHash)
        internal
        virtual
        onlyExistingToken(tokenId)
    {
        tokenMetadataHashes[tokenId] = metadataHash;
    }

    function _setTokenMetadataURI(uint256 tokenId, string memory metadataURI)
        internal
        virtual
        onlyExistingToken(tokenId)
    {
        _tokenMetadataURIs[tokenId] = metadataURI;
    }

    /**
     * @notice Destroys `tokenId`.
     * @dev We modify the OZ _burn implementation to
     * OpenAR we modified the OurZora to really burn the nft. What's burned is
     * burned
     */
    function _burn(uint256 tokenId) internal override {
        address owner = ownerOf(tokenId);

        super._burn(tokenId);

        _creatorTokens[owner].remove(tokenId);

        delete _contentHashes[tokenContentHashes[tokenId]];
        delete _arObjectKeyHashes[sha256(abi.encodePacked(tokenMediaData[tokenId].objKeyHex))];
        delete tokenContentHashes[tokenId];
        delete tokenMetadataHashes[tokenId];
        delete _tokenMetadataURIs[tokenId];
        delete tokenMediaData[tokenId];
        delete tokenCreators[tokenId];

        delete previousTokenOwners[tokenId];

        IMarket(marketContract).removeAsk(tokenId);
    }

    /**
     * @notice transfer a token and remove the ask for it.
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        IMarket(marketContract).removeAsk(tokenId);

        super._transfer(from, to, tokenId);
    }

    /**
     * @dev Calculates EIP712 DOMAIN_SEPARATOR based on the current contract and chain ID.
     */
    function _calculateDomainSeparator() internal view returns (bytes32) {
        uint256 chainID;
        /* solium-disable-next-line */
        assembly {
            chainID := chainid()
        }

        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes("openAR")),
                    keccak256(bytes("1")),
                    chainID,
                    address(this)
                )
            );
    }
}
