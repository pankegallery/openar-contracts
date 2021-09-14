// @ts-ignore
import { ethers } from "hardhat";
import chai, { expect } from "chai";
import asPromised from "chai-as-promised";
import { BigNumber, BigNumberish, Bytes, Wallet } from "ethers";
import { AddressZero, MaxUint256, WeiPerEther } from "@ethersproject/constants";
import {
  deployMarket,
  deployMedia,
  deployWXDAI,
  deployCurrency,
  mint,
  ONE_ETH,
  TENTH_ETH,
  HUNDREDTH_ETH,
  THOUSANDTH_ETH,
  TWO_ETH,
  toNumWei,
  signMintArObject,
  mintArObjectWithSig,
} from "./utils";
import Decimal from "../utils/Decimal";
import { WXDAI, Market, Media, BaseERC20 } from "../typechain";
import { PlatformCuts, BidShares, Ask, Bid } from "./types";
import { sha256 } from "ethers/lib/utils";

import { generateWallets } from "../utils/generateWallets";

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

describe("MarketIntegration", () => {
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

  let defaultBidSharesFurtherSale = {
    prevOwner: Decimal.new(0),
    owner: Decimal.new(85),
    creator: platformCuts.furtherSalesCreator,
    platform: platformCuts.furtherSalesPlatform,
    pool: platformCuts.furtherSalesPool,
  };

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

  async function approveCurrency(spender: string, owner: Wallet) {
    await currency.connect(owner).approve(spender, MaxUint256);
  }

  async function mintCurrency(to: string, value: BigNumber) {
    await currency.connect(deployerWallet).mint(to, value);
  }

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

  async function setupAuction(currencyAddr: string, tokenId = 0) {
    const asCreator = media.connect(creatorWallet);

    const marketAsCreator = market.connect(creatorWallet);
    const marketAsPrevOwner = market.connect(prevOwnerWallet);
    const marketAsOwner = market.connect(ownerWallet);
    const marketAsBidder = market.connect(bidderWallet);
    const marketAsOther = market.connect(otherWallet);

    // TODO: we should be able to do this away ...
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
      defaultBid(currencyAddr, prevOwnerWallet.address),
      tokenId
    );

    await acceptBid(
      marketAsCreator,
      tokenId,
      defaultBid(currencyAddr, prevOwnerWallet.address)
    );

    await setBid(
      marketAsOwner,
      defaultBid(currencyAddr, ownerWallet.address),
      tokenId
    );
    await acceptBid(
      marketAsPrevOwner,
      tokenId,
      defaultBid(currencyAddr, ownerWallet.address)
    );

    await setBid(
      marketAsBidder,
      defaultBid(currencyAddr, bidderWallet.address),
      tokenId
    );

    await setBid(
      marketAsOther,
      defaultBid(currencyAddr, otherWallet.address),
      tokenId
    );
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

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset", []);

    await setWallets();

    await deploy();
  });

  describe('#setBidShares', () => {
    beforeEach(async () => {
      await deploy();
      const asCreator = media.connect(creatorWallet);
      const asOther = media.connect(otherWallet);

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

      await mint(
        asOther,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it('should reject if called directly', async () => {
      const auction = market.connect(creatorWallet);
      await expect(
        setBidShares(auction, defaultTokenId, defaultBidSharesFurtherSale)
      ).rejectedWith('Market: Only media contract');
    });
  });

  describe('#setAsk', () => {
    beforeEach(async () => {
      await deploy();
      const asCreator = media.connect(creatorWallet);
      const asOther = media.connect(otherWallet);

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

      await mint(
        asOther,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it('should set the ask', async () => {
      const auction = market.connect(creatorWallet);
      await expect(setAsk(auction, 0, defaultAsk)).fulfilled;
    });

    it('should set the ask in native currency', async () => {
      const auction = market.connect(creatorWallet);
      await expect(setAsk(auction, 0, { ...defaultAsk, currency: AddressZero }))
        .fulfilled;
    });

    it('should reject if the ask is 0', async () => {
      const auction = market.connect(creatorWallet);
      await expect(
        setAsk(auction, 0, { ...defaultAsk, amount: 0 })
      ).rejectedWith('Market: Ask needs to be > 0');
    });

    it('should reject if the ask amount is invalid and cannot be split', async () => {
      const auction = market.connect(creatorWallet);
      await expect(
        setAsk(auction, 0, { ...defaultAsk, amount: 101 })
      ).rejectedWith('Market: Ask invalid for share splitting');
    });

    it('should emit an event if the ask is set', async () => {
      const auction = market.connect(otherWallet);

      const block = await ethers.provider.getBlockNumber();
      await setAsk(auction, defaultTokenId, defaultAsk);
      const events = await auction.queryFilter(
        auction.filters.AskCreated(null, null),
        block
      );

      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(defaultTokenId));
      expect(logDescription.args.ask.amount).to.eq(defaultAsk.amount);
      expect(logDescription.args.ask.currency).to.eq(defaultAsk.currency);
    });

    it('should emit an event if the ask is set in native currency', async () => {
      const auction = market.connect(otherWallet);

      const block = await ethers.provider.getBlockNumber();
      await setAsk(auction, defaultTokenId, {
        ...defaultAsk,
        currency: AddressZero,
      });
      const events = await auction.queryFilter(
        auction.filters.AskCreated(null, null),
        block
      );

      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(defaultTokenId));
      expect(logDescription.args.ask.amount).to.eq(defaultAsk.amount);
      expect(logDescription.args.ask.currency).to.eq(AddressZero);
    });

    it('should reject if the ask is too low', async () => {
      const auction = market.connect(otherWallet);

      await expect(
        setAsk(auction, defaultTokenId, {
          amount: 1,
          currency: AddressZero,
        })
      ).rejectedWith('Market: Ask invalid for share splitting');
    });
  });

  describe('#setAskForBatch', () => {

    beforeEach(async () => {
      await deploy();

      const asPrevOwner = media.connect(prevOwnerWallet);

      await mintCurrency(creatorWallet.address, ONE_ETH.mul(10000));
      await mintCurrency(prevOwnerWallet.address, ONE_ETH.mul(10000));
      await approveCurrency(market.address, creatorWallet);
      await approveCurrency(market.address, prevOwnerWallet);

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
          token,
          creatorWallet.address,
          [tokenURI, tokenURI],
          [metadataURI, tokenURI],
          [contentHashBytes, otherContentHashBytes],
          [metadataHashBytes, otherMetadataHashBytes],
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
      ).fulfilled;

      await mint(
        asPrevOwner,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it('should set the asks for one token', async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(setAskForBatch(creatorMarket, [0], objKeyHexBytes, defaultAsk))
        .fulfilled;
    });

    it('should set the asks for multiple token', async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(setAskForBatch(creatorMarket, [0, 1], objKeyHexBytes, defaultAsk))
        .fulfilled;
    });

    it('should set the asks for multiple token in native currency', async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(
        setAskForBatch(creatorMarket, [0, 1], objKeyHexBytes, {
          ...defaultAsk,
          currency: AddressZero,
        })
      ).fulfilled;
    });

    it('should reject if objKeyHexBytes does not match', async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(
        setAskForBatch(creatorMarket, [0, 1], otherObjKeyHexBytes, defaultAsk)
      ).rejectedWith('Market: setAskForBatch only specified objKeyHex');
    });

    it('should reject if called with tokenId that is not owned by the caller', async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(
        setAskForBatch(creatorMarket, [2], justAnotherObjKeyHexBytes, defaultAsk)
      ).rejectedWith('setAskForBatch Only approved or owner');
    });
  });

  describe('#removeAsk', () => {
    beforeEach(async () => {
      await deploy();
      const asCreator = media.connect(creatorWallet);
      const asOther = media.connect(otherWallet);

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

      await mint(
        asOther,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it('should remove the ask', async () => {
      const marketCreator = market.connect(creatorWallet);

      await setAsk(marketCreator, 0, defaultAsk);
      await expect(removeAsk(marketCreator, 0)).fulfilled;

      const ask = await marketCreator.currentAskForToken(0);
      expect(ask.amount).eq(BigNumber.from(0));
      expect(ask.currency).eq(AddressZero);
    });

    it('should remove the ask in native currency', async () => {
      const marketCreator = market.connect(creatorWallet);

      await setAsk(marketCreator, 0, { ...defaultAsk, currency: AddressZero });

      await expect(removeAsk(marketCreator, 0)).fulfilled;
      const ask = await marketCreator.currentAskForToken(0);
      expect(toNumWei(ask.amount)).eq(0);
      expect(ask.currency).eq(AddressZero);
    });

    it('should emit an Ask Removed event', async () => {
      const token = media.connect(creatorWallet);
      const marketCreator = market.connect(creatorWallet);
      await setAsk(marketCreator, 0, defaultAsk);
      const block = await ethers.provider.getBlockNumber();
      const tx = await removeAsk(marketCreator, 0);

      const events = await marketCreator.queryFilter(
        marketCreator.filters.AskRemoved(0, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = marketCreator.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(0));
      expect(logDescription.args.ask.amount).to.eq(defaultAsk.amount);
      expect(logDescription.args.ask.currency).to.eq(defaultAsk.currency);
    });

    it('should emit an Ask Removed event native currency', async () => {
      const token = media.connect(creatorWallet);
      const marketCreator = market.connect(creatorWallet);
      await setAsk(marketCreator, 0, { ...defaultAsk, currency: AddressZero });
      const block = await ethers.provider.getBlockNumber();
      const tx = await removeAsk(marketCreator, 0);

      const events = await marketCreator.queryFilter(
        marketCreator.filters.AskRemoved(0, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = marketCreator.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(0);
      expect(logDescription.args.ask.amount).to.eq(defaultAsk.amount);
      expect(logDescription.args.ask.currency).to.eq(AddressZero);
    });

    it('should not be callable by anyone that is not owner or approved', async () => {
      const marketCreator = market.connect(creatorWallet);
      const marketOther = market.connect(otherWallet);
      await setAsk(marketCreator, 0, defaultAsk);

      await expect(removeAsk(marketOther, 0)).rejectedWith(
        'Market: Only media caller, approved, or owner'
      );
    });
  });

  describe("#removeAskForBatch", () => {
    beforeEach(async () => {
      await deploy();

      const asPrevOwner = media.connect(prevOwnerWallet);
      await mintCurrency(creatorAddress, ONE_ETH.mul(10000));
      await mintCurrency(prevOwnerAddress, ONE_ETH.mul(10000));
      await approveCurrency(market.address, creatorWallet);
      await approveCurrency(market.address, prevOwnerWallet);
      const token = media.connect(deployerWallet);

      const timestamp = new Date().getTime();

      const sig = await signMintArObject(
        media,
        creatorWallet,
        media.address,
        awKeyHash,
        objKeyHash,
        BigNumber.from(2),
        false,
        Decimal.new(0),
        BigNumber.from(timestamp),
        await prevOwnerWallet.getChainId()
      );
      await expect(
        mintArObjectWithSig(
          token,
          creatorWallet.address,
          [tokenURI, tokenURI],
          [metadataURI, tokenURI],
          [contentHashBytes, otherContentHashBytes],
          [metadataHashBytes, otherMetadataHashBytes],
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
      ).fulfilled;
      await mint(
        asPrevOwner,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it("should remove the asks for one token", async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(
        setAskForBatch(creatorMarket, [0], objKeyHexBytes, defaultAsk)
      ).fulfilled;
      await expect(removeAskForBatch(creatorMarket, [0])).fulfilled;
    });

    it("should remove the asks for multiple token", async () => {
      const creatorMarket = market.connect(creatorWallet);
      await expect(
        setAskForBatch(creatorMarket, [0, 1], objKeyHexBytes, defaultAsk)
      ).fulfilled;
      await expect(removeAskForBatch(creatorMarket, [0, 1])).fulfilled;
    });

    it("should reject if called with tokenId that is not owned by the caller", async () => {
      const creatorMarket = market.connect(creatorWallet);
      const tokenPrev = market.connect(prevOwnerWallet);

      await expect(
        setAskForBatch(tokenPrev, [2], justAnotherObjKeyHexBytes, defaultAsk)
      ).fulfilled;

      await expect(removeAskForBatch(creatorMarket, [2])).rejectedWith(
        "removeAskForBatch Only approved or owner"
      );
    });
  });

  describe("#setBid", () => {
    beforeEach(async () => {
      await deploy();

      const asCreator = media.connect(creatorWallet);
      const asOther = media.connect(otherWallet);

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

      await mint(
        asOther,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

  it("should revert if the bidder does not have a high enough allowance for their bidding currency", async () => {
    const auction = market.connect(bidderWallet);
    await expect(
      setBid(
        auction,
        defaultBid(currency.address, bidderWallet.address),
        defaultTokenId
      )
    ).rejectedWith("SafeERC20: ERC20 operation did not succeed");
  });

  it("should revert if the bidder does not have a high enough allowance for their native currency", async () => {
    const auction = market.connect(bidderWallet);

    const balance = await ethers.provider.getBalance(bidderWallet.address);

    await expect(
      setNativeBid(
        auction,
        { ...defaultNativeBid(bidderWallet.address), amount: balance.add(1) },
        defaultTokenId,
        balance.add(1)
      )
    ).rejected;
  });

  it("should revert if the token bidder does not have the currentcy approved", async () => {
    const marketBidder = market.connect(bidderWallet);
    await expect(
      marketBidder.setBid(
        0,
        defaultBid(currency.address, bidderWallet.address)
      )
    ).rejectedWith("SafeERC20: ERC20 operation did not succeed");
  });

  it("should revert if the token bidder does not have a high enough balance for their bidding currency", async () => {
    const marketBidder = market.connect(bidderWallet);
    await approveCurrency(market.address, bidderWallet);
    await expect(
      marketBidder.setBid(
        0,
        defaultBid(currency.address, bidderWallet.address)
      )
    ).rejectedWith("SafeERC20: ERC20 operation did not succeed");
  });

  it("should revert if the bidder does not have enough tokens to bid with", async () => {
    const bid = defaultBid(currency.address, bidderWallet.address);
    const auction = market.connect(bidderWallet);
    await mintCurrency(bid.bidder, BigNumber.from(1000));
    await approveCurrency(auction.address, bidderWallet);

    await expect(setBid(auction, bid, defaultTokenId)).rejectedWith(
      "SafeERC20: ERC20 operation did not succeed"
    );
  });

  it("should revert if the bid recipient is 0 address", async () => {
    const auction = market.connect(bidderWallet);
    const bid = defaultBid(currency.address, bidderWallet.address);
    await mintCurrency(bid.bidder, bid.amount);
    await approveCurrency(auction.address, bidderWallet);

    await expect(
      setBid(auction, { ...bid, recipient: AddressZero }, defaultTokenId)
    ).rejectedWith("Market: bid recipient cannot be 0 address");
  });

  it("should revert if the native bid recipient is 0 address", async () => {
    const auction = market.connect(bidderWallet);
    const bid = defaultNativeBid(bidderWallet.address);

    await expect(
      setNativeBid(
        auction,
        { ...bid, recipient: AddressZero },
        defaultTokenId,
        BigNumber.from(bid.amount)
      )
    ).rejectedWith("Market: bid recipient cannot be 0 address");
  });

  it("should revert if the bidder bids 0 tokens", async () => {
    const auction = market.connect(bidderWallet);
    const bid = defaultBid(currency.address, bidderWallet.address);
    await mintCurrency(bid.bidder, bid.amount);
    await approveCurrency(auction.address, bidderWallet);

    await expect(
      setBid(auction, { ...bid, amount: 0 }, defaultTokenId)
    ).rejectedWith("Market: cannot bid amount of 0");
  });

    it("should revert if the bidder bids 0 native coins", async () => {
      const auction = market.connect(bidderWallet);
      const bid = defaultNativeBid(bidderWallet.address);

      await expect(
        setNativeBid(
          auction,
          { ...bid, amount: 0 },
          defaultTokenId,
          BigNumber.from(0)
        )
      ).rejectedWith("Market: cannot bid amount of 0");
    });

    it("should only take exactly the bid's amount from the bidder's wallet", async () => {
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(5000));
      await approveCurrency(market.address, bidderWallet);
      const beforeBalance = await currency
        .connect(bidderWallet)
        .balanceOf(bid.bidder);

      await expect(auction.setBid(defaultTokenId, bid)).fulfilled;

      const afterBalance = await currency
        .connect(bidderWallet)
        .balanceOf(bid.bidder);

      expect(beforeBalance.sub(afterBalance)).eq(ONE_ETH);
    });

    it("should only take exactly the bid's native coin amount from the bidder's wallet", async () => {
      const auction = market.connect(bidderWallet);
      const bid = defaultNativeBid(bidderWallet.address);

      const beforeBalance = await ethers.provider.getBalance(
        bidderWallet.address
      );

      await expect(
        auction.setBid(defaultTokenId, bid, {
          value: bid.amount,
        })
      ).eventually.fulfilled;

      const afterBalance = await ethers.provider.getBalance(
        bidderWallet.address
      );

      expect(smallify(beforeBalance.sub(afterBalance))).to.be.approximately(
        smallify(bid.amount),
        smallify(HUNDREDTH_ETH)
      );
    });

    it("should increase the contract's wxdai (wrapped native coin) holdings by bid amount", async () => {
      const auction = market.connect(bidderWallet);
      const bid = defaultNativeBid(bidderWallet.address);

      const wxdaiBidder = wxdai.connect(bidderWallet);

      const beforeBalance = await wxdaiBidder.balanceOf(market.address);

      const block = await ethers.provider.getBlockNumber();
      const tx = await auction.setBid(
        defaultTokenId,
        { ...bid, amount: TWO_ETH.mul(10) },
        { value: TWO_ETH.mul(10) }
      );

      const afterBalance = await wxdaiBidder.balanceOf(market.address);

      expect(afterBalance.sub(TWO_ETH.mul(10)).toString()).eq(
        beforeBalance.toString()
      );
    });

    it("should automatically transfer the token if the ask is met", async () => {
      const marketBidder = market.connect(bidderWallet);
      const token = media.connect(bidderWallet);
      const marketOther = market.connect(otherWallet);

      await setAsk(marketOther, 1, {
        ...defaultAsk,
        currency: currency.address,
      });

      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(bid.amount));
      await approveCurrency(marketBidder.address, bidderWallet);

      await expect(
        marketBidder.setBid(
          1,
          defaultBid(currency.address, bidderWallet.address)
        )
      ).fulfilled;

      await expect(token.ownerOf(1)).eventually.eq(bidderWallet.address);
    });

    it("should automatically transfer the token if the native ask is met", async () => {
      const marketBidder = market.connect(bidderWallet);
      const token = media.connect(bidderWallet);
      const marketOther = market.connect(otherWallet);

      await expect(
        setAsk(marketOther, 1, {
          ...defaultAsk,
          currency: AddressZero,
          amount: ONE_ETH,
        })
      ).fulfilled;

      const bid = defaultNativeBid(bidderWallet.address);

      await expect(
        marketBidder.setBid(1, { ...bid, amount: ONE_ETH }, { value: ONE_ETH })
      ).fulfilled;
      await expect(token.ownerOf(1)).eventually.eq(bidderWallet.address);
    });

    it("should set a valid bid", async () => {
      const auction = market.connect(bidderWallet);

      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(bid.amount));
      await approveCurrency(auction.address, bidderWallet);

      const beforeBalance = await currency
        .connect(bidderWallet)
        .balanceOf(bid.bidder);

      await expect(setBid(auction, bid, defaultTokenId)).fulfilled;

      const afterBalance = await currency
        .connect(bidderWallet)
        .balanceOf(bid.bidder);
      const bidOnChain = await auction.bidForTokenBidder(
        1,
        bidderWallet.address
      );
      expect(bidOnChain.currency).eq(currency.address);
      expect(bidOnChain.amount).eq(bid.amount);
      expect(bidOnChain.bidder).eq(bid.bidder);
      expect(beforeBalance).eq(afterBalance.add(bid.amount));
    });

    it("should set a bid", async () => {
      const marketBidder = market.connect(bidderWallet);
      await approveCurrency(market.address, bidderWallet);
      await mintCurrency(bidderWallet.address, ONE_ETH.mul(10));
      await expect(
        marketBidder.setBid(
          0,
          defaultBid(currency.address, bidderWallet.address)
        )
      ).fulfilled;
      const balance = await currency
        .connect(bidderWallet)
        .balanceOf(bidderWallet.address);
      expect(balance).eq(ONE_ETH.mul(9));
    });

    it("should accept a valid bid larger than the ask", async () => {
      const auction = market.connect(bidderWallet);

      const bid = defaultBid(currency.address, bidderWallet.address);

      const largerValidBid = {
        amount: 130000000,
        currency: currency.address,
        bidder: bidderWallet.address,
        recipient: otherWallet.address,
        spender: bidderWallet.address,
        sellOnShare: Decimal.new(10),
      };

      await mintCurrency(
        largerValidBid.bidder,
        ONE_ETH.mul(largerValidBid.amount)
      );
      await approveCurrency(auction.address, bidderWallet);

      const beforeBalance = toNumWei(
        await currency.connect(bidderWallet).balanceOf(bid.bidder)
      );

      await expect(setBid(auction, largerValidBid, defaultTokenId)).fulfilled;

      const afterBalance = toNumWei(
        await currency.connect(bidderWallet).balanceOf(largerValidBid.bidder)
      );
      const bidOnChain = await auction.bidForTokenBidder(
        1,
        bidderWallet.address
      );
      expect(bidOnChain.currency).eq(currency.address);
      expect(toNumWei(bidOnChain.amount)).eq(largerValidBid.amount);
      expect(bid.bidder).eq(largerValidBid.bidder);
      expect(beforeBalance).eq(afterBalance + largerValidBid.amount);
    });

    it("should refund the original bid if the bidder bids again", async () => {
      const auction = market.connect(bidderWallet);

      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(5000));
      await approveCurrency(auction.address, bidderWallet);

      const bidderBalance = await currency
        .connect(bidderWallet)
        .balanceOf(bidderWallet.address);

      const block = await ethers.provider.getBlockNumber();

      await setBid(auction, bid, defaultTokenId);

      const events = await auction.queryFilter(
        auction.filters.BidCreated(null, null),
        block
      );

      await expect(
        setBid(auction, { ...bid, amount: bid.amount.mul(2) }, defaultTokenId)
      ).eventually.fulfilled;

      const afterBalance = toNumWei(
        await currency.connect(bidderWallet).balanceOf(bidderWallet.address)
      );

      expect(afterBalance).eq(toNumWei(bidderBalance.sub(bid.amount.mul(2))));
    });

    it("should refund the original native bid if the bidder bids again", async () => {
      const auction = market.connect(prevOwnerWallet);

      const beforeBalance = await ethers.provider.getBalance(
        prevOwnerWallet.address
      );

      const bid = defaultNativeBid(prevOwnerWallet.address);

      let block = await ethers.provider.getBlockNumber();

      await expect(
        auction.setBid(
          defaultTokenId,
          { ...bid, amount: ONE_ETH.mul(10) },
          {
            value: ONE_ETH.mul(10),
          }
        )
      ).eventually.fulfilled;

      const betweenBalance = await ethers.provider.getBalance(
        prevOwnerWallet.address
      );

      expect(smallify(beforeBalance.sub(betweenBalance))).to.be.approximately(
        smallify(ONE_ETH.mul(10)),
        smallify(HUNDREDTH_ETH)
      );

      await expect(
        auction.setBid(
          defaultTokenId,
          { ...bid, amount: ONE_ETH.mul(20) },
          {
            value: ONE_ETH.mul(20),
          }
        )
      ).eventually.fulfilled;

      const afterBalance = await ethers.provider.getBalance(
        prevOwnerWallet.address
      );

      expect(smallify(beforeBalance.sub(afterBalance))).to.be.approximately(
        smallify(ONE_ETH.mul(20)),
        smallify(HUNDREDTH_ETH)
      );
    });

    it("should emit a bid event", async () => {
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);

      await mintCurrency(bid.bidder, ONE_ETH.mul(5000));
      await approveCurrency(auction.address, bidderWallet);

      const block = await ethers.provider.getBlockNumber();
      await setBid(auction, bid, defaultTokenId);

      const events = await auction.queryFilter(
        auction.filters.BidCreated(null, null),
        block
      );

      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(defaultTokenId));
      expect(logDescription.args.bid.amount).to.eq(bid.amount);
      expect(logDescription.args.bid.currency).to.eq(bid.currency);
      expect(logDescription.args.bid.sellOnShare.value).to.eq(
        bid.sellOnShare.value
      );
    });

    it("should automatically transfer the token and correctly set new bidshares if platformcut enforcement is enabled", async () => {
      const marketBidder = market.connect(bidderWallet);
      const token = media.connect(bidderWallet);
      const marketOther = market.connect(otherWallet);
      await setAsk(marketOther, 1, {
        ...defaultAsk,
        currency: currency.address,
      });

      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(5000));
      await approveCurrency(marketBidder.address, bidderWallet);

      await expect(
        marketBidder.setBid(
          1,
          defaultBid(currency.address, bidderWallet.address)
        )
      ).fulfilled;

      await expect(token.ownerOf(1)).eventually.eq(bidderWallet.address);

      const bidShares = await marketBidder.bidSharesForToken(1);
      expect(bidShares.platform.value.toString()).eq(
        platformCuts.furtherSalesPlatform.value.toString()
      );
      expect(bidShares.pool.value.toString()).eq(
        platformCuts.furtherSalesPool.value.toString()
      );
      expect(bidShares.creator.value.toString()).eq(
        platformCuts.furtherSalesCreator.value.toString()
      );
    });

    it("should automatically transfer the token if and correctly set new bidshares if platformcut enforcement is disabled", async () => {
      const deployerMarket = market.connect(deployerWallet);
      await deployerMarket.configureEnforcePlatformCuts(false);

      const marketBidder = market.connect(bidderWallet);
      const token = media.connect(bidderWallet);

      const marketOther = market.connect(otherWallet);

      await setAsk(marketOther, 1, {
        ...defaultAsk,
        currency: currency.address,
      });

      const bid = defaultBid(currency.address, bidderWallet.address);
      await mintCurrency(bid.bidder, ONE_ETH.mul(5000));
      await approveCurrency(market.address, bidderWallet);

      await expect(
        marketBidder.setBid(
          1,
          defaultBid(currency.address, bidderWallet.address)
        )
      ).fulfilled;

      await expect(token.ownerOf(1)).eventually.eq(bidderWallet.address);

      const bidShares = await marketBidder.bidSharesForToken(1);

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
        Decimal.new(90)
          .value.sub(platformCuts.firstSalePlatform.value)
          .sub(platformCuts.firstSalePool.value)
          .toString()
      );
      expect(bidShares.prevOwner.value.toString()).eq(
        Decimal.new(10).value.toString()
      );
    });
  });

  describe('#removeBid', () => {

    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it('should revert if the bidder has not placed a bid', async () => {
      const nonBidderMarket = market.connect(nonBidderWallet);

      await expect(removeBid(nonBidderMarket, 0)).rejectedWith(
        'Market: cannot remove bid amount of 0'
      );
    });

    it('should revert if the tokenId has not yet ben created', async () => {
      const otherMarket = market.connect(otherWallet);

      await expect(removeBid(otherMarket, 100)).rejectedWith(
        'Market: token with that id has not been created'
      );
    });

    it('should remove a bid and refund the bidder', async () => {
      const otherMarket = market.connect(otherWallet);

      const beforeBalance = await currency.connect(otherWallet).balanceOf(otherAddress);

      const otherBid = await otherMarket.bidForTokenBidder(0, otherWallet.address);

      await expect(removeBid(otherMarket, 0)).fulfilled;
      const afterBalance = await currency.connect(otherWallet).balanceOf(otherAddress);;

      expect(smallify(afterBalance.sub(beforeBalance))).eq(smallify(otherBid.amount));
    });

    it('should not be able to remove a bid twice', async () => {
      const otherMarket = market.connect(otherWallet);
      await removeBid(otherMarket, 0);

      await expect(removeBid(otherMarket, 0)).rejectedWith(
        'Market: cannot remove bid amount of 0'
      );
    });

    it('should remove a bid, even if the token is burned', async () => {
      const asOwner = media.connect(ownerWallet);
      const asCreator = media.connect(creatorWallet);
      const marketOther = market.connect(otherWallet);

      await asOwner.transferFrom(ownerWallet.address, creatorWallet.address, 0);

      await asCreator.burn(0);

      const beforeBalance = await currency.connect(otherWallet).balanceOf(otherAddress);

      await expect(marketOther.removeBid(0)).fulfilled;

      const afterBalance = await currency.connect(otherWallet).balanceOf(otherAddress);
      expect(smallify(afterBalance.sub(beforeBalance))).eq(smallify(defaultBid(currency.address, otherAddress).amount));
    });
  });

  describe("#removeBid native currency", () => {
    beforeEach(async () => {
      await deploy();

      const asCreator = media.connect(creatorWallet);
      const asOther = media.connect(otherWallet);

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

      await mint(
        asOther,
        justAnotherAwKeyHexBytes,
        justAnotherObjKeyHexBytes,
        metadataURI,
        tokenURI,
        justAnotherContentHashBytes,
        justAnotherMetadataHashBytes,
        defaultBidSharesMint
      );
    });

    it("should remove a bid and refund the bidder", async () => {
      const marketBidder = market.connect(bidderWallet);

      const beforeBalance = await ethers.provider.getBalance(
        bidderWallet.address
      );

      const bid = defaultNativeBid(bidderWallet.address);

      await expect(
        marketBidder.setBid(
          0,
          { ...bid, amount: ONE_ETH.mul(100) },
          {
            value: ONE_ETH.mul(100),
          }
        )
      ).eventually.fulfilled;

      const betweenBalance = await ethers.provider.getBalance(
        bidderWallet.address
      );

      expect(smallify(beforeBalance.sub(betweenBalance))).to.be.approximately(
        smallify(ONE_ETH.mul(100)),
        smallify(TENTH_ETH)
      );

      await expect(marketBidder.removeBid(0)).eventually.fulfilled;

      const afterBalance = await ethers.provider.getBalance(
        bidderWallet.address
      );

      expect(smallify(beforeBalance)).to.be.approximately(
        smallify(afterBalance),
        smallify(TENTH_ETH)
      );
    });

    it("should remove a bid, even if the token is burned", async () => {
      const marketCreator = media.connect(creatorWallet);
      const marketOther = market.connect(otherWallet);
      
      const bid = defaultNativeBid(otherAddress);

      await expect(marketOther.setBid(
        0,
        bid,
        {
          value: bid.amount,
        }
      )).eventually.fulfilled;

      await marketCreator.burn(0);
      const beforeBalance = await ethers.provider.getBalance(
        otherWallet.address
      );
      await expect(marketOther.removeBid(0)).fulfilled;
      const afterBalance = await ethers.provider.getBalance(
        otherWallet.address
      );

      expect(smallify(beforeBalance)).to.be.approximately(
        smallify(afterBalance.sub(defaultNativeBid(otherAddress).amount)),
        smallify(TENTH_ETH)
      );
    });
  });

  describe("#acceptBid platformCuts enabled", () => {
    beforeEach(async () => {
      await deploy();
      await setupAuction(currency.address);
    });

    it("should accept a bid, pay out correctly, and set correct bidshare", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const auction = market.connect(bidderWallet);
      const marketBidder = market.connect(bidderWallet);
      const bid = {
        ...defaultBid(
          currency.address,
          bidderWallet.address,
          otherWallet.address
        ),
        amount: ONE_ETH.mul(100),
        sellOnShare: Decimal.new(15),
      };

      await setBid(marketBidder, bid, 0);

      const beforeOwnerBalance = await currency
        .connect(ownerWallet)
        .balanceOf(ownerAddress);
      const beforePrevOwnerBalance = await currency
        .connect(prevOwnerWallet)
        .balanceOf(prevOwnerAddress);
      const beforeCreatorBalance = await currency
        .connect(creatorWallet)
        .balanceOf(creatorAddress);
      const beforePoolBalance = await currency
        .connect(poolWallet)
        .balanceOf(poolAddress);
      const beforePlatformBalance = await currency
        .connect(platformWallet)
        .balanceOf(platformAddress);

      await expect(marketOwner.acceptBid(0, bid)).fulfilled;
      const newOwner = await token.ownerOf(0);

      const afterOwnerBalance = await currency
        .connect(ownerWallet)
        .balanceOf(ownerAddress);
      const afterPrevOwnerBalance = await currency
        .connect(prevOwnerWallet)
        .balanceOf(prevOwnerAddress);
      const afterCreatorBalance = await currency
        .connect(creatorWallet)
        .balanceOf(creatorAddress);
      const afterPoolBalance = await currency
        .connect(poolWallet)
        .balanceOf(poolAddress);
      const afterPlatformBalance = await currency
        .connect(platformWallet)
        .balanceOf(platformAddress);

      const bidShares = await auction.bidSharesForToken(0);

      expect(newOwner).eq(otherWallet.address);
      expect(afterOwnerBalance).eq(beforeOwnerBalance.add(ONE_ETH.mul(75)));
      expect(afterPrevOwnerBalance).eq(
        beforePrevOwnerBalance.add(ONE_ETH.mul(10))
      );
      expect(afterCreatorBalance).eq(beforeCreatorBalance.add(ONE_ETH.mul(5)));
      expect(afterPoolBalance).eq(beforePoolBalance.add(ONE_ETH.mul(5)));
      expect(afterPlatformBalance).eq(
        beforePlatformBalance.add(ONE_ETH.mul(5))
      );
      expect(toNumWei(bidShares.owner.value)).eq(70 * 10 ** 18);
      expect(toNumWei(bidShares.prevOwner.value)).eq(15 * 10 ** 18);
      expect(toNumWei(bidShares.creator.value)).eq(5 * 10 ** 18);
      expect(toNumWei(bidShares.platform.value)).eq(5 * 10 ** 18);
      expect(toNumWei(bidShares.pool.value)).eq(5 * 10 ** 18);
    });

    it("should emit a bid finalized event if the bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);
      const block = await ethers.provider.getBlockNumber();
      await setBid(marketBidder, bid, 0);
      await marketOwner.acceptBid(0, bid);
      const events = await auction.queryFilter(
        auction.filters.BidFinalized(null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(0));
      expect(logDescription.args.bid.amount).to.eq(bid.amount);
      expect(logDescription.args.bid.currency).to.eq(bid.currency);
      expect(toNumWei(logDescription.args.bid.sellOnShare.value)).to.eq(
        toNumWei(bid.sellOnShare.value)
      );
      expect(logDescription.args.bid.bidder).to.eq(bid.bidder);
    });

    it("should emit a bid shares updated event if the bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);
      const block = await ethers.provider.getBlockNumber();
      await setBid(marketBidder, bid, 0);
      await marketOwner.acceptBid(0, bid);
      const events = await auction.queryFilter(
        auction.filters.BidShareUpdated(null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);

      expect(toNumWei(logDescription.args.tokenId)).to.eq(0);
      expect(toNumWei(logDescription.args.bidShares.prevOwner.value)).to.eq(
        10000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.owner.value)).to.eq(
        75000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.creator.value)).to.eq(
        5000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.pool.value)).to.eq(
        5000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.platform.value)).to.eq(
        5000000000000000000
      );
    });

    it("should revert if not called by the owner", async () => {
      const token = media.connect(ownerWallet);
      const marketOther = market.connect(otherWallet);
      await expect(
        marketOther.acceptBid(0, {
          ...defaultBid(currency.address, otherWallet.address),
        })
      ).rejectedWith("Market: Only approved or owner");
    });

    it("should revert if a non-existent bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      await expect(
        marketOwner.acceptBid(0, {
          ...defaultBid(currency.address, AddressZero),
        })
      ).rejectedWith("Market: cannot accept bid of 0");
    });

    it("should revert if an invalid bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const bid = {
        ...defaultBid(currency.address, bidderWallet.address),
        amount: 99,
      };
      await setBid(marketBidder, bid, 0);

      await expect(marketOwner.acceptBid(0, bid)).rejectedWith(
        "Market: Bid invalid for share splitting"
      );
    });

    // TODO: test the front running logic
  });

  describe("#acceptBid platformCuts disabled", () => {
    beforeEach(async () => {
      await deploy();

      const marketDeployer = market.connect(deployerWallet);
      await marketDeployer.configureEnforcePlatformCuts(false);

      await setupAuction(currency.address);
    });

    it("should accept a bid, pay out correctly, and set correct bidshare", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const auction = market.connect(bidderWallet);
      const marketBidder = market.connect(bidderWallet);

      const bid = {
        ...defaultBid(
          currency.address,
          bidderWallet.address,
          otherWallet.address
        ),
        amount: ONE_ETH.mul(100),
        sellOnShare: Decimal.new(15),
      };

      await setBid(marketBidder, bid, 0);

      const beforeOwnerBalance = await currency
        .connect(ownerWallet)
        .balanceOf(ownerAddress);
      const beforePrevOwnerBalance = await currency
        .connect(prevOwnerWallet)
        .balanceOf(prevOwnerAddress);
      const beforeCreatorBalance = await currency
        .connect(creatorWallet)
        .balanceOf(creatorAddress);
      const beforePoolBalance = await currency
        .connect(poolWallet)
        .balanceOf(poolAddress);
      const beforePlatformBalance = await currency
        .connect(platformWallet)
        .balanceOf(platformAddress);

      await expect(marketOwner.acceptBid(0, bid)).fulfilled;
      const newOwner = await token.ownerOf(0);

      const afterOwnerBalance = await currency
        .connect(ownerWallet)
        .balanceOf(ownerAddress);
      const afterPrevOwnerBalance = await currency
        .connect(prevOwnerWallet)
        .balanceOf(prevOwnerAddress);
      const afterCreatorBalance = await currency
        .connect(creatorWallet)
        .balanceOf(creatorAddress);
      const afterPoolBalance = await currency
        .connect(poolWallet)
        .balanceOf(poolAddress);
      const afterPlatformBalance = await currency
        .connect(platformWallet)
        .balanceOf(platformAddress);

      const bidShares = await auction.bidSharesForToken(0);

      expect(newOwner).eq(otherWallet.address);
      expect(afterOwnerBalance).eq(beforeOwnerBalance.add(ONE_ETH.mul(75)));
      expect(afterPrevOwnerBalance).eq(
        beforePrevOwnerBalance.add(ONE_ETH.mul(10))
      );
      expect(afterCreatorBalance).eq(beforeCreatorBalance);
      expect(afterPoolBalance).eq(beforePoolBalance.add(ONE_ETH.mul(5)));
      expect(afterPlatformBalance).eq(
        beforePlatformBalance.add(ONE_ETH.mul(10))
      );

      expect(toNumWei(bidShares.owner.value)).eq(70 * 10 ** 18);
      expect(toNumWei(bidShares.prevOwner.value)).eq(15 * 10 ** 18);
      expect(toNumWei(bidShares.creator.value)).eq(0);
      expect(toNumWei(bidShares.platform.value)).eq(10 * 10 ** 18);
      expect(toNumWei(bidShares.pool.value)).eq(5 * 10 ** 18);
    });

    it("should emit a bid finalized event if the bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);
      const block = await ethers.provider.getBlockNumber();
      await setBid(marketBidder, bid, 0);
      await marketOwner.acceptBid(0, bid);
      const events = await auction.queryFilter(
        auction.filters.BidFinalized(null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId).to.eq(BigNumber.from(0));
      expect(logDescription.args.bid.amount).to.eq(bid.amount);
      expect(logDescription.args.bid.currency).to.eq(bid.currency);
      expect(toNumWei(logDescription.args.bid.sellOnShare.value)).to.eq(
        toNumWei(bid.sellOnShare.value)
      );
      expect(logDescription.args.bid.bidder).to.eq(bid.bidder);
    });

    it("should emit a bid shares updated event if the bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const auction = market.connect(bidderWallet);
      const bid = defaultBid(currency.address, bidderWallet.address);
      const block = await ethers.provider.getBlockNumber();
      await setBid(marketBidder, bid, 0);
      await marketOwner.acceptBid(0, bid);
      const events = await auction.queryFilter(
        auction.filters.BidShareUpdated(null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = auction.interface.parseLog(events[0]);

      expect(toNumWei(logDescription.args.tokenId)).to.eq(0);
      expect(toNumWei(logDescription.args.bidShares.prevOwner.value)).to.eq(
        10000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.owner.value)).to.eq(
        75000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.creator.value)).to.eq(0);
      expect(toNumWei(logDescription.args.bidShares.pool.value)).to.eq(
        5000000000000000000
      );
      expect(toNumWei(logDescription.args.bidShares.platform.value)).to.eq(
        10000000000000000000
      );
    });

    it("should revert if not called by the owner", async () => {
      const token = media.connect(ownerWallet);
      const marketOther = market.connect(otherWallet);
      await expect(
        marketOther.acceptBid(0, {
          ...defaultBid(currency.address, otherWallet.address),
        })
      ).rejectedWith("Market: Only approved or owner");
    });

    it("should revert if a non-existent bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      await expect(
        marketOwner.acceptBid(0, {
          ...defaultBid(currency.address, AddressZero),
        })
      ).rejectedWith("Market: cannot accept bid of 0");
    });

    it("should revert if an invalid bid is accepted", async () => {
      const token = media.connect(ownerWallet);
      const marketOwner = market.connect(ownerWallet);
      const marketBidder = market.connect(bidderWallet);
      const bid = {
        ...defaultBid(currency.address, bidderWallet.address),
        amount: 99,
      };
      await setBid(marketBidder, bid, 0);

      await expect(marketOwner.acceptBid(0, bid)).rejectedWith(
        "Market: Bid invalid for share splitting"
      );
    });

    // TODO: test the front running logic
  });
});
