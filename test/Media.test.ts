// @ts-ignore
import { ethers } from "hardhat";
import chai, { expect } from "chai";
import asPromised from "chai-as-promised";
import { BigNumber, Wallet, Bytes } from "ethers";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import {
  deployMarket,
  deployMedia,
  deployWXDAI,
  deployCurrency,
  ONE_ETH,
  TENTH_ETH,
  THOUSANDTH_ETH,
  TWO_ETH,
  mint,
  mintWithSig,
  mintArObjectWithSig,
  signMintArObject,
  signMintWithSig,
  signPermit,
} from "./utils";
import { Decimal, getBytes32FromString } from "../utils";
import { WXDAI, Market, Media, BaseERC20 } from "../typechain";
import { PlatformCuts, BidShares, Ask, Bid, MediaData } from "./types";
import { generateWallets } from "../utils/generateWallets";
import { sha256 } from "ethers/lib/utils";

chai.use(asPromised);

let contentHex: string;
let contentHash: string;
let contentHashBytes: Bytes;

let otherContentHex: string;
let otherContentHash: string;
let otherContentHashBytes: Bytes;

let justAnotherContentHex: string;
let justAnotherContentHash: string;
let justAnotherContentHashBytes: Bytes;

let zeroContentHashBytes: Bytes;

let metadataHex: string;
let metadataHash: string;
let metadataHashBytes: Bytes;

let otherMetadataHex: string;
let otherMetadataHash: string;
let otherMetadataHashBytes: Bytes;

let justAnotherMetadataHex: string;
let justAnotherMetadataHash: string;
let justAnotherMetadataHashBytes: Bytes;

const artworkKey = "7QEHYy4i8078lGXP";
const awKeyHex = ethers.utils.formatBytes32String(artworkKey);
const awKeyHexBytes = ethers.utils.arrayify(awKeyHex);
const awKeyHash = sha256(awKeyHex);
const awKeyHashBytes = ethers.utils.arrayify(awKeyHash);

const otherArtworkKey = "8QEHYy4i8078lGXP";
const otherAwKeyHex = ethers.utils.formatBytes32String(otherArtworkKey);
const otherAwKeyHexBytes = ethers.utils.arrayify(otherAwKeyHex);
const otherAwKeyHash = sha256(otherAwKeyHex);
const otherAwKeyHashBytes = ethers.utils.arrayify(otherAwKeyHash);

const justAnotherArtworkKey = "9QEHYy4i8078lGXP";
const justAnotherAwKeyHex = ethers.utils.formatBytes32String(
  justAnotherArtworkKey
);
const justAnotherAwKeyHexBytes = ethers.utils.arrayify(justAnotherAwKeyHex);
const justAnotherAwKeyHash = sha256(justAnotherAwKeyHex);
const justAnotherAwKeyHashBytes = ethers.utils.arrayify(justAnotherAwKeyHash);

const arObjectKey = "8QEHYy4i8078lGXJ";
const objKeyHex = ethers.utils.formatBytes32String(arObjectKey);
const objKeyHexBytes = ethers.utils.arrayify(objKeyHex);
const objKeyHash = sha256(objKeyHex);
const objKeyHashBytes = ethers.utils.arrayify(objKeyHash);

const otherArObjectKey = "8QEHYy4i8078lwerA";
const otherObjKeyHex = ethers.utils.formatBytes32String(otherArObjectKey);
const otherObjKeyHexBytes = ethers.utils.arrayify(otherObjKeyHex);
const otherObjKeyHash = sha256(otherObjKeyHex);
const otherObjKeyHashBytes = ethers.utils.arrayify(otherObjKeyHash);

const justAnotherArObjectKey = "9QEHYy4i8078lwerA";
const justAnotherObjKeyHex = ethers.utils.formatBytes32String(
  justAnotherArObjectKey
);
const justAnotherObjKeyHexBytes = ethers.utils.arrayify(justAnotherObjKeyHex);
const justAnotherObjKeyHash = sha256(justAnotherObjKeyHex);
const justAnotherObjKeyHashBytes = ethers.utils.arrayify(justAnotherObjKeyHash);

const defaultTokenId = 1;
const defaultBatchSize = 10;
let tokenURI = "www.example.com";
let metadataURI = "www.example2.com";

metadataHex = ethers.utils.formatBytes32String("{}");
metadataHash = sha256(metadataHex);
metadataHashBytes = ethers.utils.arrayify(metadataHash);

contentHex = ethers.utils.formatBytes32String("content");
contentHash = sha256(contentHex);
contentHashBytes = ethers.utils.arrayify(contentHash);

otherMetadataHex = ethers.utils.formatBytes32String('{meta:"other"}');
otherMetadataHash = sha256(otherMetadataHex);
otherMetadataHashBytes = ethers.utils.arrayify(otherMetadataHash);

otherContentHex = ethers.utils.formatBytes32String("otherthing");
otherContentHash = sha256(otherContentHex);
otherContentHashBytes = ethers.utils.arrayify(otherContentHash);

justAnotherMetadataHex = ethers.utils.formatBytes32String(
  '{meta:"justanother"}'
);
justAnotherMetadataHash = sha256(justAnotherMetadataHex);
justAnotherMetadataHashBytes = ethers.utils.arrayify(justAnotherMetadataHash);

justAnotherContentHex = ethers.utils.formatBytes32String("justanotherthing");
justAnotherContentHash = sha256(justAnotherContentHex);
justAnotherContentHashBytes = ethers.utils.arrayify(justAnotherContentHash);

zeroContentHashBytes = ethers.utils.arrayify(ethers.constants.HashZero);

const defaultBid = (currency: string, bidder: string, recipient?: string) => ({
  amount: ONE_ETH,
  currency,
  bidder,
  recipient: recipient || bidder,
  sellOnShare: Decimal.new(10),
});

let defaultAsk = {
  amount: ONE_ETH,
  currency: "0x41A322b28D0fF354040e2CbC676F0320d8c8850d",
  sellOnShare: Decimal.new(10),
};

// helper function so we can parse numbers and do approximate number calculations, to avoid annoying gas calculations
const smallify = (bn: BigNumber) => bn.div(THOUSANDTH_ETH).toNumber();

describe("Media", () => {
  let market: Market;
  let media: Media;
  let wxdai: WXDAI;
  let currency: BaseERC20;

  let deployerWallet,
    bidderWallet,
    prevOwnerWallet,
    otherWallet,
    platformWallet,
    poolWallet,
    creatorWallet,
    nonBidderWallet,
    ownerWallet: Wallet;
  let deployerAddress,
    bidderAddress,
    prevOwnerAddress,
    otherAddress,
    platformAddress,
    poolAddress,
    creatorAddress,
    nonBidderAddress,
    ownerAddress: string;

  let platformCuts: PlatformCuts = {
    firstSalePlatform: Decimal.new(10),
    firstSalePool: Decimal.new(5),
    furtherSalesPlatform: Decimal.new(5),
    furtherSalesPool: Decimal.new(5),
    furtherSalesCreator: Decimal.new(5),
  };

  let defaultBidSharesMint = {
    prevOwner: Decimal.new(0),
    owner: Decimal.new(85),
    creator: Decimal.new(0),
    platform: platformCuts.firstSalePlatform,
    pool: platformCuts.firstSalePool,
  };

  async function deploy() {
    wxdai = await deployWXDAI();
    market = await deployMarket(wxdai.address);
    media = await deployMedia();
    await market.configure(media.address);
    await market.configurePlatformAddress(platformAddress);
    await market.configurePoolAddress(poolAddress);
    await market.configurePlatformCuts(platformCuts);
    await market.configureEnforcePlatformCuts(true);

    await media.configure(market.address);

    currency = await deployCurrency();

    defaultAsk = {
      ...defaultAsk,
      currency: currency.address,
    };
  }

  async function setWallets() {
    [
      deployerWallet,
      bidderWallet,
      prevOwnerWallet,
      otherWallet,
      platformWallet,
      poolWallet,
      creatorWallet,
      nonBidderWallet,
      ownerWallet,
    ] = generateWallets(ethers.provider);

    [


      deployerAddress,
      bidderAddress,
      prevOwnerAddress,
      otherAddress,
      platformAddress,
      poolAddress,
      creatorAddress,
      nonBidderAddress,
      ownerAddress,
    ] = await Promise.all(
      [
        deployerWallet,
        bidderWallet,
        prevOwnerWallet,
        otherWallet,
        platformWallet,
        poolWallet,
        creatorWallet,
        nonBidderWallet,
        ownerWallet,
      ].map((s) => s.getAddress())
    );
  }

  async function approveCurrency(spender: string, owner: Wallet) {
    await currency.connect(owner).approve(spender, MaxUint256);
  }

  async function mintCurrency(to: string, value: BigNumber) {
    await currency.connect(deployerWallet).mint(to, value);
  }

  const defaultNativeBid = (bidder: string, recipient?: string) => ({
    amount: ONE_ETH,
    currency: AddressZero,
    bidder,
    recipient: recipient || bidder,
    sellOnShare: Decimal.new(10),
  });

  async function setBidShares(
    market: Market,
    tokenId: number,
    bidShares?: BidShares
  ) {
    return market.setBidShares(tokenId, bidShares);
  }

  async function setAsk(market: Market, tokenId: number, ask: Ask) {
    return market.setAsk(tokenId, ask);
  }

  async function removeAsk(market: Market, tokenId: number) {
    return market.removeAsk(tokenId);
  }

  async function setAskForBatch(
    market: Market,
    tokenIds: number[],
    objKeyHex: Bytes,
    ask: Ask
  ) {
    return market.setAskForBatch(tokenIds, ask, objKeyHex);
  }

  async function removeAskForBatch(market: Market, tokenIds: number[]) {
    return market.removeAskForBatch(tokenIds);
  }

  async function setBid(market: Market, bid: Bid, tokenId: number) {
    return market.setBid(tokenId, bid);
  }

  async function setNativeBid(
    market: Market,
    bid: Bid,
    tokenId: number,
    value: BigNumber
  ) {
    return market.setBid(tokenId, bid, { value });
  }

  async function removeBid(market: Market, tokenId: number) {
    return market.removeBid(tokenId);
  }

  async function acceptBid(market: Market, tokenId: number, bid: Bid) {
    return market.acceptBid(tokenId, bid);
  }

  async function setupAuction(currencyAddress: string, tokenId = 0) {
    const asCreator = media.connect(creatorWallet);

    const marketAsCreator = market.connect(creatorWallet);
    const marketAsPrevOwner = market.connect(prevOwnerWallet);
    const marketAsOwner = market.connect(ownerWallet);
    const marketAsBidder = market.connect(bidderWallet);
    const marketAsOther = market.connect(otherWallet);

    await mintCurrency(creatorWallet.address, TWO_ETH.mul(10000));
    await mintCurrency(prevOwnerWallet.address, TWO_ETH.mul(10000));
    await mintCurrency(ownerWallet.address, TWO_ETH.mul(10000));
    await mintCurrency(bidderWallet.address, TWO_ETH.mul(10000));
    await mintCurrency(otherWallet.address, TWO_ETH.mul(10000));
    await approveCurrency(market.address, creatorWallet);
    await approveCurrency(market.address, prevOwnerWallet);
    await approveCurrency(market.address, ownerWallet);
    await approveCurrency(market.address, bidderWallet);
    await approveCurrency(market.address, otherWallet);

    await mint(
      asCreator,
      otherAwKeyHexBytes,
      otherObjKeyHexBytes,
      metadataURI,
      tokenURI,
      contentHashBytes,
      metadataHashBytes,
      defaultBidSharesMint
    );

    await setBid(
      marketAsPrevOwner,
      defaultBid(currency.address, prevOwnerWallet.address),
      tokenId
    );

    await acceptBid(
      marketAsCreator,
      tokenId,
      defaultBid(currency.address, prevOwnerWallet.address)
    );

    await setBid(
      marketAsOwner,
      defaultBid(currency.address, ownerWallet.address),
      tokenId
    );
    await acceptBid(
      marketAsPrevOwner,
      tokenId,
      defaultBid(currency.address, ownerWallet.address)
    );

    await setBid(
      marketAsBidder,
      defaultBid(currency.address, bidderWallet.address),
      tokenId
    );

    await setBid(
      marketAsOther,
      defaultBid(currency.address, otherWallet.address),
      tokenId
    );
  }

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset", []);

    await setWallets();

    await deploy();
  });

  describe("#configure", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should revert if not called by the owner", async () => {
      await expect(
        media.connect(otherWallet).configure(market.address)
      ).eventually.rejectedWith("Ownable: caller is not the owner");
    });

    it("should be callable by the owner", async () => {
      await expect(media.connect(deployerWallet).configure(market.address))
        .eventually.fulfilled;

      const marketContractAddress = await media
        .connect(deployerWallet)
        .marketContract();

      expect(marketContractAddress).eq(market.address);
    });
  });

  describe("#ownwership", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should be able to renounce ownership", async () => {
      await expect(media.connect(deployerWallet).renounceOwnership()).eventually
        .fulfilled;

      await expect(
        media.connect(deployerWallet).configure(market.address)
      ).eventually.rejectedWith("Ownable: caller is not the owner");
    });

    it("should be able to transfer ownership", async () => {
      await expect(
        media.connect(deployerWallet).transferOwnership(otherWallet.address)
      ).eventually.fulfilled;

      await expect(media.connect(otherWallet).configure(market.address))
        .eventually.fulfilled;
    });
  });

  describe("#mint", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should mint a token", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).fulfilled;

      const t = await token.tokenByIndex(0);
      const ownerT = await token.tokenOfOwnerByIndex(creatorWallet.address, 0);
      const ownerOf = await token.ownerOf(0);
      const creator = await token.tokenCreators(0);
      const prevOwner = await token.previousTokenOwners(0);
      const tokenContentHash = await token.tokenContentHashes(0);
      const metadataContentHash = await token.tokenMetadataHashes(0);
      const savedTokenURI = await token.tokenURI(0);
      const savedMetadataURI = await token.tokenMetadataURI(0);

      expect(t).eq(ownerT);
      expect(ownerOf).eq(creatorWallet.address);
      expect(creator).eq(creatorWallet.address);
      expect(prevOwner).eq(creatorWallet.address);
      expect(tokenContentHash).eq(contentHash);
      expect(metadataContentHash).eq(metadataHash);
      expect(savedTokenURI).eq(tokenURI);
      expect(savedMetadataURI).eq(metadataURI);
    });

    it("should emit a correct TokenObjectMinted event", async () => {
      const token = media.connect(creatorWallet);

      const block = await ethers.provider.getBlockNumber();

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).eventually.fulfilled;

      const events = await token.queryFilter(
        token.filters.TokenObjectMinted(null, null),
        block
      );

      const t = await token.tokenByIndex(0);

      expect(events.length).eq(1);
      const logDescription = token.interface.parseLog(events[0]);

      expect(logDescription.args.tokenIds.length).to.eq(BigNumber.from(1));
      expect(logDescription.args.tokenIds[0]).to.eq(t);
      expect(logDescription.args.data.awKeyHex).to.eq(awKeyHex);
      expect(logDescription.args.data.objKeyHex).to.eq(objKeyHex);
      expect(logDescription.args.data.editionOf).to.eq(BigNumber.from(1));
    });

    it("should revert if an empty content hash is specified", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          zeroContentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Media: content hash must be non-zero");
    });

    it("should correctly set MintData", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).eventually.fulfilled;

      const mediaData: MediaData = await token.tokenMediaData(0);

      expect(mediaData.awKeyHex).eq(awKeyHex);
      expect(mediaData.objKeyHex).eq(objKeyHex);
      expect(mediaData.editionOf).eq(BigNumber.from(1));
      expect(mediaData.editionNumber).eq(BigNumber.from(1));
    });

    it("should revert if MintData.editionOf < 1", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          },
          BigNumber.from(0),
          BigNumber.from(1)
        )
      ).rejectedWith("Media: editionOf hash must be > zero");
    });

    it("should revert if MintData.editionNumber < 1", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          },
          BigNumber.from(1),
          BigNumber.from(0)
        )
      ).rejectedWith("Media: editionNumber hash must be > zero");
    });

    it("should revert if the content hash already exists for a created token", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).fulfilled;

      await expect(
        mint(
          token,
          awKeyHexBytes,
          otherObjKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith(
        "Media: a token has already been created with this content hash"
      );
    });

    it("should revert if the objKeyHash already exists for a created token", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).fulfilled;

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Media: mint arObject hash already been minted");
    });

    it("should revert if the metadataHash is empty", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          zeroContentHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Media: metadata hash must be non-zero");
    });

    it("should revert if the metadataURI is empty", async () => {
      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          "",
          tokenURI,
          zeroContentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Media: specified uri must be non-empty");
    });

    it("should be able to mint a token with bid shares summing to less than 100 but platformCut is enforced", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(true);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(15),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).not.rejectedWith("Market: Invalid bid shares, must sum to 100");
    });

    it("should not be able to mint a token with bid shares summing to less than 100", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(false);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(15),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Market: Invalid bid shares, must sum to 100");
    });

    it("should be able to mint a token with bid shares summing to greater than 100 but platformCut is enforced", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(true);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          "222",
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(125),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).not.rejectedWith("Market: Invalid bid shares, must sum to 100");
    });

    it("should not be able to mint a token with bid shares summing to greater than 100", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(false);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          "222",
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(125),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).rejectedWith("Market: Invalid bid shares, must sum to 100");
    });

    it("should be setting the bid share correctly if platform cuts are enabled", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(true);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          "222",
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(125),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).eventually.fulfilled;

      const bidShares = await deployerMarket.bidSharesForToken(0);

      expect(bidShares.platform.value.toString()).eq(
        platformCuts.firstSalePlatform.value.toString()
      );

      expect(bidShares.pool.value.toString()).eq(
        platformCuts.firstSalePool.value.toString()
      );

      expect(bidShares.creator.value.toString()).eq(
        Decimal.new(0).value.toString()
      );

      expect(bidShares.owner.value.toString()).eq(
        Decimal.new(100)
          .value.sub(platformCuts.firstSalePlatform.value)
          .sub(platformCuts.firstSalePool.value)
          .toString()
      );

      expect(bidShares.prevOwner.value.toString()).eq(
        Decimal.new(0).value.toString()
      );
    });

    it("should be setting the bid share correctly if platform cuts are disabled", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(false);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          "222",
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(5),
            pool: Decimal.new(5),
            owner: Decimal.new(5),
          }
        )
      ).eventually.fulfilled;

      const bidShares = await deployerMarket.bidSharesForToken(0);

      expect(bidShares.platform.value.toString()).eq(
        Decimal.new(5).value.toString()
      );

      expect(bidShares.pool.value.toString()).eq(
        Decimal.new(5).value.toString()
      );

      expect(bidShares.creator.value.toString()).eq(
        Decimal.new(85).value.toString()
      );

      expect(bidShares.owner.value.toString()).eq(
        Decimal.new(5).value.toString()
      );
      expect(bidShares.prevOwner.value.toString()).eq(
        Decimal.new(0).value.toString()
      );
    });

    it("should be setting custom bid share correctly if platform cuts are disabled", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(false);

      const token = media.connect(creatorWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          "222",
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(50),
            platform: Decimal.new(30),
            pool: Decimal.new(10),
            owner: Decimal.new(10),
          }
        )
      ).eventually.fulfilled;

      const bidShares = await deployerMarket.bidSharesForToken(0);

      expect(bidShares.platform.value.toString()).eq(
        Decimal.new(30).value.toString()
      );

      expect(bidShares.pool.value.toString()).eq(
        Decimal.new(10).value.toString()
      );

      expect(bidShares.creator.value.toString()).eq(
        Decimal.new(50).value.toString()
      );

      expect(bidShares.owner.value.toString()).eq(
        Decimal.new(10).value.toString()
      );
      expect(bidShares.prevOwner.value.toString()).eq(
        Decimal.new(0).value.toString()
      );
    });
  });

  describe("#creator housekeeping", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("a newly minted token should increase the creatorBalanceOf by 1 and be retrievable at index 0", async () => {
      const token = media.connect(creatorWallet);
      const creatorBalanceOf1 = await token.creatorBalanceOf(
        creatorWallet.address
      );

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).fulfilled;

      const creatorBalanceOf2 = await token.creatorBalanceOf(
        creatorWallet.address
      );
      expect(creatorBalanceOf1.add(1)).eq(creatorBalanceOf2);

      const tokenId = await token.tokenOfCreatorByIndex(
        creatorWallet.address,
        0
      );
      expect(tokenId.toString()).eq("0");
    });
  });

  describe("#mintWithSig", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should mint a token for a given creator with a valid signature", async () => {
      const token = media.connect(otherWallet);
      const deployerMarket = await market.connect(otherWallet);

      const beforeNonce = await token.mintWithSigNonces(creatorWallet.address);
      expect(beforeNonce);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        beforeNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          beforeNonce,
          sig
        )
      ).fulfilled;

      const recovered = await token.tokenCreators(0);
      const recoveredTokenURI = await token.tokenURI(0);
      const recoveredMetadataURI = await token.tokenMetadataURI(0);
      const recoveredContentHash = await token.tokenContentHashes(0);
      const recoveredMetadataHash = await token.tokenMetadataHashes(0);
      const recoveredCreatorBidShare = (
        await deployerMarket.bidSharesForToken(0)
      ).creator.value;
      const afterNonce = await token.mintWithSigNonces(creatorWallet.address);

      expect(recovered).to.eq(creatorWallet.address);
      expect(recoveredTokenURI).to.eq(tokenURI);
      expect(recoveredMetadataURI).to.eq(metadataURI);
      expect(recoveredContentHash).to.eq(contentHash);
      expect(recoveredMetadataHash).to.eq(metadataHash);
      expect(recoveredCreatorBidShare).to.eq(
        defaultBidSharesMint.creator.value
      );
      expect(afterNonce).to.eq(beforeNonce.add(1));
    });

    it("should emit a correct TokenObjectMinted event", async () => {
      const token = media.connect(otherWallet);

      const beforeNonce = await token.mintWithSigNonces(creatorWallet.address);
      expect(beforeNonce);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        beforeNonce,
        await deployerWallet.getChainId()
      );

      const block = await ethers.provider.getBlockNumber();

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          beforeNonce,
          sig
        )
      ).fulfilled;

      const events = await token.queryFilter(
        token.filters.TokenObjectMinted(null, null),
        block
      );

      const t = await token.tokenByIndex(0);

      expect(events.length).eq(1);
      const logDescription = token.interface.parseLog(events[0]);

      expect(logDescription.args.tokenIds.length).to.eq(BigNumber.from(1));
      expect(logDescription.args.tokenIds[0]).to.eq(t);
      expect(logDescription.args.data.awKeyHex).to.eq(awKeyHex);
      expect(logDescription.args.data.objKeyHex).to.eq(objKeyHex);
      expect(logDescription.args.data.editionOf).to.eq(BigNumber.from(1));
    });

    it("should not mint a token for a different creator", async () => {
      const token = media.connect(otherWallet);

      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        bidderWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            pool: Decimal.new(0),
            platform: Decimal.new(0),
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
          },
          currentNonce,
          sig
        )
      ).rejectedWith("Media: mintWithSig signature invalid");
    });

    it("should be not be able to schedule several mints", async () => {
      const token = media.connect(otherWallet);

      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig1 = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      const sig2 = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        otherAwKeyHash,
        otherObjKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce,
          sig1
        )
      ).eventually.fulfilled;

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          otherContentHashBytes,
          otherMetadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce,
          sig2
        )
      ).rejectedWith("Media: mintWithSig invalid-nonce");
    });

    it("should increase nonce after mint", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce,
          sig
        )
      ).eventually.fulfilled;

      const currentNonce2 = await token.mintWithSigNonces(
        creatorWallet.address
      );

      expect(currentNonce.toNumber()).eq(currentNonce2.toNumber() - 1);
    });

    it("should not mint a token with a invalid nonce", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce.add(1),
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce.add(1),
          sig
        )
      ).rejectedWith("Media: mintWithSig invalid-nonce");

      const currentNonce2 = await token.mintWithSigNonces(
        creatorWallet.address
      );

      const sig2 = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce2,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce2,
          sig2
        )
      ).eventually.fulfilled;

      const currentNonce3 = await token.mintWithSigNonces(
        creatorWallet.address
      );

      const sig3 = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(85).value,
        currentNonce3.sub(1),
        await deployerWallet.getChainId()
      );
      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          currentNonce3.sub(1),
          sig3
        )
      ).rejectedWith("Media: mintWithSig invalid-nonce");
    });

    it("should not mint a token for a different contentHash", async () => {
      const badContent = "bad bad bad";
      const badContentHex = ethers.utils.formatBytes32String(badContent);
      const badContentHash = sha256(badContentHex);
      const badContentHashBytes = ethers.utils.arrayify(badContentHash);

      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          badContentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig
        )
      ).rejectedWith("Media: mintWithSig signature invalid");
    });

    it("should correctly set MintData", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig
        )
      ).eventually.fulfilled;

      const mediaData: MediaData = await token.tokenMediaData(0);

      expect(mediaData.awKeyHex).eq(awKeyHex);
      expect(mediaData.objKeyHex).eq(objKeyHex);
      expect(mediaData.editionOf).eq(BigNumber.from(1));
      expect(mediaData.editionNumber).eq(BigNumber.from(1));
    });

    it("should revert if MintData.editionOf < 1", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig,
          BigNumber.from(0),
          BigNumber.from(1)
        )
      ).rejectedWith("Media: editionOf hash must be > zero");
    });

    it("should revert if MintData.editionNumber < 1", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig,
          BigNumber.from(1),
          BigNumber.from(0)
        )
      ).rejectedWith("Media: editionNumber hash must be > zero");
    });

    it("should not mint a token for a different metadataHash", async () => {
      const badMetadata = '{"some": "bad", "data": ":)"}';
      const badMetadataHex = ethers.utils.formatBytes32String(badMetadata);
      const badMetadataHash = sha256(badMetadataHex);
      const badMetadataHashBytes = ethers.utils.arrayify(badMetadataHash);
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          badMetadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig
        )
      ).rejectedWith("Media: mintWithSig signature invalid");
    });

    it("should not mint a token for a different creator bid share", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(100),
            creator: Decimal.new(0),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig
        )
      ).rejectedWith("Media: mintWithSig signature invalid");
    });

    it("should not mint a token with an invalid deadline", async () => {
      const token = media.connect(otherWallet);
      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          { ...sig, deadline: "1" }
        )
      ).rejectedWith("Media: mintWithSig expired");
    });

    it("should revert if the objKeyHash already exists for a created token", async () => {
      const token = media.connect(otherWallet);

      await expect(
        mint(
          token,
          awKeyHexBytes,
          objKeyHexBytes,
          metadataURI,
          tokenURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
            owner: Decimal.new(0),
          }
        )
      ).fulfilled;

      const currentNonce = await token.mintWithSigNonces(creatorWallet.address);

      const sig = await signMintWithSig(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        contentHash,
        metadataHash,
        Decimal.new(5).value,
        currentNonce,
        await deployerWallet.getChainId()
      );

      await expect(
        mintWithSig(
          token,
          creatorWallet.address,
          awKeyHexBytes,
          objKeyHexBytes,
          tokenURI,
          metadataURI,
          contentHashBytes,
          metadataHashBytes,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(95),
            creator: Decimal.new(5),
            platform: Decimal.new(0),
            pool: Decimal.new(0),
          },
          currentNonce,
          sig
        )
      ).rejectedWith("Media: mintWithSig arObject hash already been minted");
    });
  });

  describe("#mintArObject", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should mint an ArObject as editon of 1 token for a given creator with a valid signature and no initial ask", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + 1).to.eq(tokenCount2);
    });

    it("should mint an ArObject as editon of 1 token for a given creator with a valid signature and a very high initial ask", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(22222),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(22222),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + 1).to.eq(tokenCount2);
    });


    it("should mint several different ArObject sas editon of 1 token for a given creator with a valid signature and an initial ask", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(222),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(222),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const sig2 = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        otherAwKeyHash,
        otherObjKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(333),
        BigNumber.from(timestamp + 200),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [otherContentHashBytes],
          [otherMetadataHashBytes],
          otherAwKeyHexBytes,
          otherObjKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(333),
          BigNumber.from(timestamp + 200),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig2
        )
      ).fulfilled;
      console.log("Now 3");
      const sig3 = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        justAnotherAwKeyHash,
        justAnotherObjKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(44),
        BigNumber.from(timestamp + 400),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [justAnotherContentHashBytes],
          [justAnotherMetadataHashBytes],
          justAnotherAwKeyHexBytes,
          justAnotherObjKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(44),
          BigNumber.from(timestamp + 400),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig3
        )
      ).fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + 3).to.eq(tokenCount2);
    });

    it("should emit a correct TokenObjectMinted event", async () => {
      const token = media.connect(deployerWallet);
      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const block = await ethers.provider.getBlockNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const events = await token.queryFilter(
        token.filters.TokenObjectMinted(null, null),
        block
      );

      const t = await token.tokenByIndex(0);

      expect(events.length).eq(1);
      const logDescription = token.interface.parseLog(events[0]);

      expect(logDescription.args.tokenIds.length).to.eq(BigNumber.from(1));
      expect(logDescription.args.tokenIds[0]).to.eq(t);
      expect(logDescription.args.data.awKeyHex).to.eq(awKeyHex);
      expect(logDescription.args.data.objKeyHex).to.eq(objKeyHex);
      expect(logDescription.args.data.editionOf).to.eq(BigNumber.from(1));
    });

    it("should emit a correct TokenObjectMinted event when batch minting", async () => {
      const token = media.connect(deployerWallet);
      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(3),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const block = await ethers.provider.getBlockNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const events = await token.queryFilter(
        token.filters.TokenObjectMinted(null, null),
        block
      );

      expect(events.length).eq(1);
      const logDescription = token.interface.parseLog(events[0]);

      expect(logDescription.args.tokenIds.length).to.eq(BigNumber.from(3));
      expect(logDescription.args.tokenIds[0]).to.eq(
        await token.tokenByIndex(0)
      );
      expect(logDescription.args.tokenIds[1]).to.eq(
        await token.tokenByIndex(1)
      );
      expect(logDescription.args.tokenIds[2]).to.eq(
        await token.tokenByIndex(2)
      );
      expect(logDescription.args.data.awKeyHex).to.eq(awKeyHex);
      expect(logDescription.args.data.objKeyHex).to.eq(objKeyHex);
      expect(logDescription.args.data.editionOf).to.eq(BigNumber.from(3));
    });

    it("should batch mint 107 tokens", async () => {
      const token = media.connect(deployerWallet);
      const timestamp = new Date().getTime();

      const max = 107;

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(max),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [...Array(max).keys()].map((i) => tokenURI),
          [...Array(max).keys()].map((i) => metadataURI),
          [...Array(max).keys()].map((i) =>
            getBytes32FromString(`content hash ${i + 1}`)
          ),
          [...Array(max).keys()].map((i) =>
            getBytes32FromString(`metadata hash ${i + 1}`)
          ),
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(max),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;
      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + max).to.eq(tokenCount2);
    });

    it("should correctly set MintData", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(3),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + 3).to.eq(tokenCount2);

      let mediaData: MediaData = await token.tokenMediaData(0);

      expect(mediaData.awKeyHex).eq(awKeyHex);
      expect(mediaData.objKeyHex).eq(objKeyHex);
      expect(mediaData.editionOf).eq(BigNumber.from(3));
      expect(mediaData.editionNumber).eq(BigNumber.from(1));

      mediaData = await token.tokenMediaData(1);
      expect(mediaData.awKeyHex).eq(awKeyHex);
      expect(mediaData.objKeyHex).eq(objKeyHex);
      expect(mediaData.editionOf).eq(BigNumber.from(3));
      expect(mediaData.editionNumber).eq(BigNumber.from(2));

      mediaData = await token.tokenMediaData(2);
      expect(mediaData.awKeyHex).eq(awKeyHex);
      expect(mediaData.objKeyHex).eq(objKeyHex);
      expect(mediaData.editionOf).eq(BigNumber.from(3));
      expect(mediaData.editionNumber).eq(BigNumber.from(3));
    });

    it("should not allow to use signature several times", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-nonce");
    });

    it("should not be able to mint the same arObject twice", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const timestamp2 = new Date().getTime();

      const sig2 = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp2),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp2),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig2
        )
      ).rejectedWith("Media: mintArObject arObject hash already been minted");
    });

    it("should ensure that all arrays have the same length", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(3),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [contentHashBytes, justAnotherContentHashBytes],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [metadataHashBytes, otherMetadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");
    });

    it("should only mint if edition size and length of data arrays match", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(2),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [justAnotherContentHashBytes],
          [justAnotherMetadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(2),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");

      const sig2 = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(3),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig2
        )
      ).eventually.fulfilled;
    });

    it("should mint an ArObject as editon of 3 token for a given creator with a valid signature and no initial ask", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(3),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI, tokenURI, tokenURI],
          [metadataURI, metadataURI, metadataURI],
          [
            contentHashBytes,
            otherContentHashBytes,
            justAnotherContentHashBytes,
          ],
          [
            metadataHashBytes,
            otherMetadataHashBytes,
            justAnotherMetadataHashBytes,
          ],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(3),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();

      expect(tokenCount1 + 3).to.eq(tokenCount2);
    });

    it("should not allow to be executed by non contract owner", async () => {
      const token = media.connect(otherWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Ownable: caller is not the owner");
    });

    it("should not of signer and passed on creator are different", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          otherWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: Signature invalid");
    });

    it("should not mint for a differnt key hash", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const awKeyHex = ethers.utils.formatBytes32String(artworkKey);
      const awKeyHash = sha256(awKeyHex);
      // const awKeyHexBytes = ethers.utils.arrayify(awKeyHash);

      const objKeyHex = ethers.utils.formatBytes32String(arObjectKey);
      const objKeyHash = sha256(objKeyHex);
      // const objKeyHexBytes = ethers.utils.arrayify(objKeyHash);

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          otherWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          otherAwKeyHexBytes,
          otherObjKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: Signature invalid");
    });

    it("should not mint a different edition size", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          otherWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(2),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject invalid-data");
    });

    it("should not mint if flag setInitialAsk differ", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          otherWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          false,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: Signature invalid");
    });

    it("should not mint if flag setInitialAsk is set and initialAsk-ing price == 0", async () => {
      const token = media.connect(deployerWallet);
      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(0),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: mintArObject initialAsk is zero");
    });

    it("should not mint if initialAsk-ing prices differs", async () => {
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(10),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).rejectedWith("Media: Signature invalid");
    });

    it("should set initial ask correctly if flag is true and initialAsk > 0", async () => {
      const token = media.connect(deployerWallet);
      const deployerMarket = market.connect(otherWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        token.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(1),
        true,
        Decimal.new(10),
        BigNumber.from(timestamp),
        await deployerWallet.getChainId()
      );

      const tokenCount1 = (await token.totalSupply()).toNumber();

      await expect(
        mintArObjectWithSig(
          defaultBatchSize,
          token,
          creatorWallet.address,
          [tokenURI],
          [metadataURI],
          [contentHashBytes],
          [metadataHashBytes],
          awKeyHexBytes,
          objKeyHexBytes,
          BigNumber.from(1),
          true,
          Decimal.new(10),
          BigNumber.from(timestamp),
          currency.address,
          {
            prevOwner: Decimal.new(0),
            owner: Decimal.new(0),
            creator: Decimal.new(85),
            platform: Decimal.new(10),
            pool: Decimal.new(5),
          },
          sig
        )
      ).eventually.fulfilled;

      const tokenCount2 = (await token.totalSupply()).toNumber();
      expect(tokenCount1 + 1).to.eq(tokenCount2);

      const ask = await deployerMarket.currentAskForToken(tokenCount1);

      expect(ask.amount.toString()).to.eq(Decimal.new(10).value.toString());
    });
  });

  describe("#transfer", () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should remove the ask after a transfer", async () => {
      const token = media.connect(ownerWallet);
      const otherMarket = market.connect(ownerWallet);

      const auction = market.connect(deployerWallet);
      await setAsk(otherMarket, 0, defaultAsk);

      await expect(
        token.transferFrom(ownerWallet.address, otherWallet.address, 0)
      ).fulfilled;
      const ask = await auction.currentAskForToken(0);
      expect(ask.amount).eq(BigNumber.from(0));
      expect(ask.currency).eq(AddressZero);
    });
  });

  describe("#burn", () => {
    beforeEach(async () => {
      await deploy();
      const token = media.connect(creatorWallet);
      await mint(
        token,
        awKeyHexBytes,
        objKeyHexBytes,
        metadataURI,
        tokenURI,
        contentHashBytes,
        metadataHashBytes,
        {
          prevOwner: Decimal.new(10),
          creator: Decimal.new(90),
          owner: Decimal.new(0),
          platform: Decimal.new(0),
          pool: Decimal.new(0),
        }
      );
    });

    it("should revert when the caller is the owner, but not creator", async () => {
      const creatorToken = media.connect(creatorWallet);
      await creatorToken.transferFrom(
        creatorWallet.address,
        ownerWallet.address,
        0
      );
      const token = media.connect(ownerWallet);
      await expect(token.burn(0)).rejectedWith(
        "Media: owner is not creator of media"
      );
    });

    it("should revert when the caller is approved, but the owner is not the creator", async () => {
      const creatorToken = media.connect(creatorWallet);
      await creatorToken.transferFrom(
        creatorWallet.address,
        ownerWallet.address,
        0
      );
      const token = media.connect(ownerWallet);
      await token.approve(otherWallet.address, 0);

      const otherToken = media.connect(otherWallet);
      await expect(otherToken.burn(0)).rejectedWith(
        "Media: owner is not creator of media"
      );
    });

    it("should revert when the caller is not the owner or a creator", async () => {
      const token = media.connect(otherWallet);

      await expect(token.burn(0)).rejectedWith("Media: Only approved or owner");
    });

    it("should revert if the token id does not exist", async () => {
      const token = media.connect(creatorWallet);

      await expect(token.burn(100)).rejectedWith("Media: nonexistent token");
    });

    it("should clear approvals, remove owner, tokenURI, contentHash and all other token related information", async () => {
      const token = media.connect(creatorWallet);
      await expect(token.approve(otherWallet.address, 0)).fulfilled;

      await expect(token.burn(0)).fulfilled;

      await expect(token.ownerOf(0)).rejectedWith(
        "ERC721: owner query for nonexistent token"
      );

      const totalSupply = await token.totalSupply();
      expect(totalSupply).eq(BigNumber.from(0));

      await expect(token.getApproved(0)).rejectedWith(
        "ERC721: approved query for nonexistent token"
      );

      const tokenURI = await token.tokenURI(0);
      expect(tokenURI).eq("");

      const contentHash = await token.tokenContentHashes(0);
      expect(contentHash).eq(contentHash);

      // TODO: Improve checks
      const previousOwner = await token.previousTokenOwners(0);
      expect(previousOwner).eq(AddressZero);
    });

    it("should clear approvals, set remove owner, should clear approvals, remove owner, tokenURI, contentHash and all other token related information approved", async () => {
      const token = media.connect(creatorWallet);
      await expect(token.approve(otherWallet.address, 0)).fulfilled;

      const otherToken = media.connect(otherWallet);

      await expect(otherToken.burn(0)).fulfilled;

      await expect(token.ownerOf(0)).rejectedWith(
        "ERC721: owner query for nonexistent token"
      );

      const totalSupply = await token.totalSupply();
      expect(totalSupply).eq(BigNumber.from(0));

      await expect(token.getApproved(0)).rejectedWith(
        "ERC721: approved query for nonexistent token"
      );

      const tokenURI = await token.tokenURI(0);
      expect(tokenURI).eq("");

      const contentHash = await token.tokenContentHashes(0);
      expect(contentHash).eq(contentHash);

      const previousOwner = await token.previousTokenOwners(0);
      expect(previousOwner).eq(AddressZero);
    });
  });

  describe("#updateTokenURI", async () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should revert if the token does not exist", async () => {
      const token = media.connect(creatorWallet);

      await expect(token.updateTokenURI(1, "blah blah")).rejectedWith(
        "ERC721: operator query for nonexistent token"
      );
    });

    it("should revert if the caller is not the owner of the token and does not have approval", async () => {
      const token = media.connect(otherWallet);

      await expect(token.updateTokenURI(0, "blah blah")).rejectedWith(
        "Media: Only approved or owner"
      );
    });

    it("should revert if the uri is empty string", async () => {
      const token = media.connect(ownerWallet);
      await expect(token.updateTokenURI(0, "")).rejectedWith(
        "Media: specified uri must be non-empty"
      );
    });

    it("should revert if the token has been burned", async () => {
      const token = media.connect(creatorWallet);

      await mint(
        token,
        awKeyHexBytes,
        objKeyHexBytes,
        metadataURI,
        tokenURI,
        otherContentHashBytes,
        metadataHashBytes,
        {
          prevOwner: Decimal.new(10),
          creator: Decimal.new(90),
          owner: Decimal.new(0),
          platform: Decimal.new(0),
          pool: Decimal.new(0),
        }
      );

      await expect(token.burn(1)).fulfilled;

      await expect(token.updateTokenURI(1, "blah")).rejectedWith(
        "ERC721: operator query for nonexistent token"
      );
    });

    it("should set the tokenURI to the URI passed if the msg.sender is the owner", async () => {
      const token = media.connect(ownerWallet);
      await expect(token.updateTokenURI(0, "blah blah")).fulfilled;

      const tokenURI = await token.tokenURI(0);
      expect(tokenURI).eq("blah blah");
    });

    it("should set the tokenURI to the URI passed if the msg.sender is approved", async () => {
      const token = media.connect(ownerWallet);
      await token.approve(otherWallet.address, 0);

      const otherToken = media.connect(otherWallet);
      await expect(otherToken.updateTokenURI(0, "blah blah")).fulfilled;

      const tokenURI = await token.tokenURI(0);
      expect(tokenURI).eq("blah blah");
    });
  });

  describe("#updateMetadataURI", async () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should revert if the token does not exist", async () => {
      const token = media.connect(creatorWallet);

      await expect(token.updateTokenMetadataURI(1, "blah blah")).rejectedWith(
        "ERC721: operator query for nonexistent token"
      );
    });

    it("should revert if the caller is not the owner of the token or approved", async () => {
      const token = media.connect(otherWallet);

      await expect(token.updateTokenMetadataURI(0, "blah blah")).rejectedWith(
        "Media: Only approved or owner"
      );
    });

    it("should revert if the uri is empty string", async () => {
      const token = media.connect(ownerWallet);
      await expect(token.updateTokenMetadataURI(0, "")).rejectedWith(
        "Media: specified uri must be non-empty"
      );
    });

    it("should revert if the token has been burned", async () => {
      const token = media.connect(creatorWallet);

      await mint(
        token,
        awKeyHexBytes,
        objKeyHexBytes,
        metadataURI,
        tokenURI,
        otherContentHashBytes,
        metadataHashBytes,
        {
          prevOwner: Decimal.new(10),
          creator: Decimal.new(90),
          owner: Decimal.new(0),
          platform: Decimal.new(0),
          pool: Decimal.new(0),
        }
      );

      await expect(token.burn(1)).fulfilled;

      await expect(token.updateTokenMetadataURI(1, "blah")).rejectedWith(
        "ERC721: operator query for nonexistent token"
      );
    });

    it("should set the tokenMetadataURI to the URI passed if msg.sender is the owner", async () => {
      const token = media.connect(ownerWallet);
      await expect(token.updateTokenMetadataURI(0, "blah blah")).fulfilled;

      const tokenURI = await token.tokenMetadataURI(0);
      expect(tokenURI).eq("blah blah");
    });

    it("should set the tokenMetadataURI to the URI passed if the msg.sender is approved", async () => {
      const token = media.connect(ownerWallet);
      await token.approve(otherWallet.address, 0);

      const otherToken = media.connect(otherWallet);
      await expect(otherToken.updateTokenMetadataURI(0, "blah blah")).fulfilled;

      const tokenURI = await token.tokenMetadataURI(0);
      expect(tokenURI).eq("blah blah");
    });
  });

  describe("#permit", () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should allow a wallet to set themselves to approved with a valid signature", async () => {
      const token = media.connect(otherWallet);
      const sig = await signPermit(
        media,
        ownerWallet,
        otherWallet.address,
        token.address,
        0,
        await deployerWallet.getChainId()
      );
      await expect(token.permit(otherWallet.address, 0, sig)).eventually
        .fulfilled;
      await expect(token.getApproved(0)).eventually.eq(otherWallet.address);
    });

    it("should not allow a wallet to set themselves to approved with an invalid signature", async () => {
      const token = media.connect(otherWallet);
      const sig = await signPermit(
        media,
        ownerWallet,
        bidderWallet.address,
        token.address,
        0,
        await deployerWallet.getChainId()
      );
      await expect(token.permit(otherWallet.address, 0, sig)).rejectedWith(
        "Media: permit signature invalid"
      );
      await expect(token.getApproved(0)).eventually.eq(AddressZero);
    });
  });

  describe("#supportsInterface", async () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should return true to supporting new metadata interface", async () => {
      const token = media.connect(otherWallet);
      const interfaceId = ethers.utils.arrayify("0x4e222e66");
      const supportsId = await token.supportsInterface(interfaceId);
      expect(supportsId).eq(true);
    });

    it("should return false to supporting the old metadata interface", async () => {
      const token = media.connect(otherWallet);
      const interfaceId = ethers.utils.arrayify("0x5b5e139f");
      const supportsId = await token.supportsInterface(interfaceId);
      expect(supportsId).eq(false);
    });
  });

  describe("#revokeApproval", async () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should revert if the caller is the owner", async () => {
      const token = media.connect(ownerWallet);
      await expect(token.revokeApproval(0)).rejectedWith(
        "Media: caller not approved address"
      );
    });

    it("should revert if the caller is the creator", async () => {
      const token = media.connect(creatorWallet);
      await expect(token.revokeApproval(0)).rejectedWith(
        "Media: caller not approved address"
      );
    });

    it("should revert if the caller is neither owner, creator, or approver", async () => {
      const token = media.connect(otherWallet);
      await expect(token.revokeApproval(0)).rejectedWith(
        "Media: caller not approved address"
      );
    });

    it("should revoke the approval for token id if caller is approved address", async () => {
      const token = media.connect(ownerWallet);
      await token.approve(otherWallet.address, 0);
      const otherToken = media.connect(otherWallet);
      await expect(otherToken.revokeApproval(0)).fulfilled;
      const approved = await token.getApproved(0);
      expect(approved).eq(ethers.constants.AddressZero);
    });
  });
});
