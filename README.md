# openAR Protocol 

First of all we're deeply grateful to the team from Zora. Without their tremendous lift off we would have struggled to bring our platform live. We made sure to publish this code base under the same licence as theirs. 

Also, we don't want to compete with Zora in by any means. We had to fork their protocol to meet the needs of our platform. If your needs are met by Zora please use their protocol it is deployed on nearly every chain. 

Our contracts are an adoption of the Zora Media Protocol. We'll briefly explain the modifications but please make sure to consult https://github.com/ourzora/core and [zora.engineering](https://zora.engineering) for an in depth explanation of the protocol

The primary changes to the contracts where. 
1. Unlike the Zora protocol we want to be able to take a cut on the sales to support the platform maintenance and fill a artist support fund. We therefore had to add some functionality to administer the percentages and execute the payout to the receiving wallets. 
2. Unlike the Zora protocol we wanted to be able to batch mint an editon N artwork and need to be able to schedule several mint requests before execution. As `mintWithSig` does not support batch minting (the user would have to sign each individual mint) and the nonce handling allows only one active signature per artist we had to develop a new `mintArArtwork` function in the media contract. This function can only be exectuted by the contract owner and requires a valid `EIP712` signature of the artist. 
3. We thought that contracts should be Ownable, to be able to transfer contract ownership if necessary
4. Also while the contracts are not upgradeable we made sure to decouple them by making the relating addresses configurable. This way, if necessary, we can write a new market logic for the existing token contract. 

### Using the protocol without from outside our platform
The conrtracts are build to be used around our platform. Or put differently our platform expect you to use the contracts via the platform. You can call the functions directly. Just don't expect minted tokens to show up in the listings, bids to be accepted, 

While we're keeping the options open for auction based sales. Our platform will be running as a shop for the beginning. You're free to submit lower Bids than the Ask but be aware that other users are not informed of their existence. 

Also please note that for the moment the platforms currency is *xDAI*, bids in other currencies will be processed but not taken into the consideration. 

## Table of Contents

- [Architecture](#architecture)
  - [Mint](#mint)
  - [Mint AR Object](#mintArObject)
  - [Set Bid](#set-bid)
  - [Remove Bid](#remove-bid)
  - [Transfer](#transfer)
  - [Burn](#burn)
  - [Set Ask](#set-ask)
  - [Accept Bid](#accept-bid)
  - [Approve](#approve)
  - [Update Token and Media URI](#update-token-and-media-uri)
  - [Permit](#permit)
  - [Mint with Signature](#mint-with-signature)
  - [MintArObject](#mintarobject)
- [Local Development](#Local-Development)
  - [Install Dependencies](#install-dependencies)
  - [Compile Contracts](#compile-contracts)
  - [Start a Local Blockchain](#start-a-local-blockchain)
  - [Run Tests](#run-tests)

## Architecture

This protocol is an extension of the ERC-721 NFT standard, intended to
provide a unified pool of liquidity in the form of bids in a market for each NFT.
This protocol refers to NFTs as `Media`.

The protocol's roles and methods interact with the core contracts as follows:
![Architecture Diagram](./architecture.png)

The following structs are defined in the contract and used as parameters for some methods:

```solidity
// Decimal.D256
struct D256 {
  uint256 value;
}

struct Bid {
  // Amount of the currency being bid
  uint256 amount;
  // Address to the ERC20 token being used to bid
  address currency;
  // Address of the bidder
  address bidder;
  // Address of the recipient
  address recipient;
  // % of the next sale to award the previous owner
  Decimal.D256 sellOnShare;
}

struct Ask {
  // Amount of the currency being asked
  uint256 amount;
  // Address to the ERC20 token being asked
  address currency;
  // % of the next sale to award the previous owner
  Decimal.D256 sellOnShare;
}

struct BidShares {
  // openAR addition
  // % of sale value that goes to the platform for maintenance 
  Decimal.D256 platform;

  // openAR addition
  // % of sale value that goes to the platform pool for supporting artist
  Decimal.D256 pool;

  // % of sale value that goes to the original creator of the nft
  Decimal.D256 creator;
  
  // % of sale value that goes to the seller (current owner) of the nft
  Decimal.D256 owner;
  
  // % of sale value that goes to the _previous_ owner of the nft
  Decimal.D256 prevOwner;
}

// openAR addition
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

// Any time a mint(), mintWithSig(), or mintArObject will be called a  TokenObjectMinted(uint256[] tokenIds, MintObjectData data) will be emitted
struct MintObjectData {
    // The Hex representation of openAR Artwork's key
    bytes32 awKeyHex;
    // The Hex representation of openAR ArObject's key
    bytes32 objKeyHex;
    // How many times has the object been minted
    uint256 editionOf;
}

// using tokenMediaData(tokenId) you can receive the following additional data for the token. 
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

struct EIP712Signature {
  uint256 deadline;
  uint8 v;
  bytes32 r;
  bytes32 s;
}
```

### Mint

At any time, a creator may mint a new piece of media. When a piece is minted, the new media is transferred to the creator and a market is formed.

| **Name**    | **Type**    | **Description**                                                                         |
| ----------- | ----------- | --------------------------------------------------------------------------------------- |
| `data`      | `MediaData` | The data represented by this media, including SHA256 hashes for future integrity checks |
| `bidShares` | `BidShares` | The percentage of bid fees that should be perpetually rewarded to the creator.          |

![Mint process flow diagram](./mint.png)

### mintArObject

At any time the artist might choose to mint an AR object on our platform. If she chooses so, she will have to sign an EIP712 signature permitting us as contract owner to schedule a batch mint of the AR object edtion. The owner only function will need to be called with the following argument.s 

| **Name**         | **Type**           | **Description**                                                             |
| ---------------- | ------------------ | ----------------------------------------------------------------------------|
| `creator`        | `address`          | The address of the creator we mint the tokens for                           |
| `tokenURIs`      | `string[]`         | Array with the tokenURIs of each token of the batch                         |
| `metadataURIs`   | `string[]`         | Array with the metadataURIs of each token of the batch                      |
| `contentHashes`  | `string[]`         | Array with the contentHashes of each token of the batch                     |
| `metadataHashes` | `string[]`         | Array with the metadataHashes of each token of the batch                    |
| `data`           | `MintArObjectData` | Further data needed for the mint and/or to prove the signature              |
| `bidShares`      | `BidShares`        | The intital bid shares that will be set for the artists                     |
| `sig`            | `EIP712Signature`  | The artist's signature                                                      |

### Set Bid

Anyone may place a bid on a minted token. By placing a bid, the bidder deposits the currency of their choosing into
the market contract. Any valid ERC-20 currencies can be used to bid. Note that we strongly recommend that bidders do not bid using a currency that can be rebased, such as [AMPL](https://www.ampleforth.org/), [YAM](https://yam.finance/), or [BASED](https://based.money), as funds can become locked in the Market if the token is rebased.

| **Name**  | **Type**  | **Description**                        |
| --------- | --------- | -------------------------------------- |
| `tokenId` | `uint256` | The tokenID for the media being bid on |
| `bid`     | `Bid`     | The bid to be placed                   |

![Set Bid process flow diagram](./setBid.png)

### Remove Bid

Once a bid has been set by a bidder, it can be removed. In order to remove a bid from a piece of media, the bidder simply specifies the piece of media that they wish to remove their bid from.
Note from the process flow diagram above for setting a bid that only one bid can be set a time per bidder per piece of media.

| **Name**  | **Type**  | **Description**                                      |
| --------- | --------- | ---------------------------------------------------- |
| `tokenId` | `uint256` | The tokenID for the media who's bid is being removed |

![Remove Bid process flow diagram](./removeBid.png)

### Transfer

Any media owner is able to transfer their media to an address of their choosing. This does not alter the market for the media, except to remove the Ask on the piece, if it is present. Its implementation from the standard ERC721 standard is unchanged in this protocol.

### Burn

This protocol allows for media to be burned, if and only if the owner of the media is also the creator. ~~When burned, the `tokenURI` and `metadataURI` of the media are not removed. This means that even though the market becomes inactive, the media is still viewable. Effectively, the media becomes read-only.~~ (openAR we want tokens to be fully removed from our platform, we'll remove all references to the token in our contract)
Any bids that were placed on a piece prior to it being burned can still be removed.

| **Name**  | **Type**  | **Description**                   |
| --------- | --------- | --------------------------------- |
| `tokenId` | `uint256` | The tokenID for the media to burn |

![Burn process flow diagram](./burn.png)

### Set Ask

At any time, an owner may set an Ask on their media. The ask serves to automatically fulfill a bid if it satisfies the parameters of the ask. This allows collectors to optionally buy a piece outright, without waiting for the owner to explicitly accept their bid.

| **Name**  | **Type**  | **Description**           |
| --------- | --------- | ------------------------- |
| `tokenId` | `uint256` | The tokenID for the media |
| `ask`     | `Ask`     | The ask to be set         |

![Set Ask process flow diagram](./setAsk.png)

### Accept Bid

When an owner sees a satisfactory bid, they can accept it and transfer the ownership of the piece to the bidder's recipient. The bid's funds are split according to the percentages defined in the piece's bid shares.
Note that bids can have a sell-on fee. This fee is to entitle the seller to a piece of the next sale of the media. For example, suppose someone owns a piece with a limited means of promoting it. In this case, it may be favorable to accept a bid from a highly regarded platform for a lower initial capital, but high potential resale fee.
Since the sell-on fee can be easily avoided by bidders with ill intent, it's suggested that owners only accept sell-on fee offers from reputable buyers.

| **Name**  | **Type**  | **Description**           |
| --------- | --------- | ------------------------- |
| `tokenId` | `uint256` | The tokenID for the media |
| `bid`     | `Bid`     | The bid to accept         |

![Accept Bid process flow diagram](./acceptBid.png)

### Approve

At any time, the owner of a piece of media is able to approve another address to act on its behalf.
This implementation is unchanged from the ERC-721 standard. However, approved addresses are now also able to accept bids,
set asks, update URIs, and burn media (provided the owner is the creator, as above).

### Update Token and Media URI

Although this protocol is designed to maintain perpetual markets for media, data availability of that media is considered
out of scope. However, in the event that the URIs that point to the data must be changed, this protocol offers the ability to update them.
Recall that when minting tokens, sha256 hashes of the content and metadata are provided for integrity checks. As a result, anyone is able to
check the integrity of the media if the URIs change.

This protocol deviates from the ERC-721 in that the `tokenURI` does **not** point to a valid ERC721 Metadata JSON Schema as defined in the EIP.
In order to support integrity checks when updating the tokenURIs, the content and metadata of a piece of media are split into `tokenURI` and `metadataURI`,
respectively. This split effectively allows for the reconfiguration of the URIs of both the content and metadata, while preserving integrity checks.

### Permit

In order to provide support for third parties to interact with this protocol on a user's behalf, the EIP-712 standard for signing typed data structures is supported.
The protocol offers a `permit` method loosely based off of EIP-2612, with some adjustments made to support NFTs rather than ERC-20 currencies. The `Permit` EIP-712 data structure is as follows:

```typescript
{
  Permit: [
    { name: 'spender', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ];
}
```

If the permit is applied, the specified `spender` is set as approved for the signer. Note that the `spender` will stay approved until the approval is revoked.

### Mint With Signature

If the media has yet to be minted yet, creators are able to permit a third party to mint on their behalf by signing a `MintWithSig` object. The structure is as follows:

```typescript
{
  MintWithSig: [
    { name: 'tokenURI', type: 'string' },
    { name: 'metadataURI', type: 'string' },
    { name: 'creatorShare', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ];
}
```

### MintArObject

Can only be called by the contract owner. The owner will have to provide the signed `MintArObject` object. The structure is as follows:

```typescript
{
  MintArObject: [
    { name: 'keyHash', type: 'bytes32' },
    { name: 'editionOf', type: 'uint256' },
    { name: 'setInitialAsk', type: 'bool' },
    { name: 'initialAsk', type: 'uint256' },
    { name: 'creatorShare', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}
```

## Local Development

The following assumes `node >= 14`

### Install Dependencies

```shell script
yarn
```

### Compile Contracts

```shell script
yarn build
```

### Start a Local Blockchain

```shell script
yarn chain
```

### Deploy Contracts to Local Blockchain

```shell script
yarn dev-deploy
```

### Create Typechain TS Code

```shell script
yarn typechain
```

### Run Tests

```shell script
yarn test
```
