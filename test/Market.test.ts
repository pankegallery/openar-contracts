// @ts-ignore
import { ethers } from "hardhat";
import chai, { expect } from "chai";
import asPromised from "chai-as-promised";
import { BigNumber, Wallet } from "ethers";
import {
  deployMarket,
  deployMedia,
  deployWXDAI,
  // mint,
  ONE_ETH,
  TENTH_ETH,
  THOUSANDTH_ETH,
  TWO_ETH,
} from "./utils";
import Decimal from '../utils/Decimal';
import { WXDAI, Market, Media } from '../typechain';
import { PlatformCuts, BidShares, Ask, Bid } from "./types";
import { generateWallets } from "../utils/generateWallets";

chai.use(asPromised);

// helper function so we can parse numbers and do approximate number calculations, to avoid annoying gas calculations
const smallify = (bn: BigNumber) => bn.div(THOUSANDTH_ETH).toNumber();

const maxEditionOf = 100;

describe("Market", () => {
  let market: Market;
  let media: Media;
  let wxdai: WXDAI;
  
  let deployerWallet,
    bidderWallet,
    prevOwnerWallet,
    otherWallet,
    platformWallet,
    poolWallet,
    creatorWallet,
    nonBidderWallet,
    ownerWallet,
    mintWallet: Wallet;
  let deployerAddress,
    bidderAddress,
    prevOwnerAddress,
    otherAddress,
    platformAddress,
    poolAddress,
    creatorAddress,
    nonBidderAddress,
    ownerAddress,
    mintAddress: string;

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

    await media.configure(market.address, maxEditionOf);
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
      mintWallet
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
      mintAddress
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
        mintWallet
      ].map((s) => s.getAddress())
    );
  }

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset", []);

    await setWallets();

    await deploy();
  });

  describe('#configure', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configure(
          nonBidderWallet.address
        )
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {
      await expect(
        market.connect(deployerWallet).configure(
          nonBidderWallet.address
        )
      ).eventually.fulfilled;

      const tokenContractAddress = await market.connect(deployerWallet).mediaContract();

      expect(tokenContractAddress).eq(nonBidderWallet.address);
    });
  });

  describe('#configurePlatformAddress', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configurePlatformAddress(
          platformWallet.address
        )
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {
      await expect(
        market.connect(deployerWallet).configurePlatformAddress(
          nonBidderWallet.address
        )
      ).eventually.fulfilled;

      expect(await market.openARPlatform()).eq(nonBidderWallet.address);
    });
  });
  
  describe('#configurePoolAddress', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configurePoolAddress(
          platformWallet.address
        )
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {
      await expect(
        market.connect(deployerWallet).configurePoolAddress(
          nonBidderWallet.address
        )
      ).eventually.fulfilled;

      expect(await market.openARPool()).eq(nonBidderWallet.address);
    });
  });

  describe('#configureMintAddress', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configureMintAddress(
          platformWallet.address
        )
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {
      await expect(
        market.connect(deployerWallet).configureMintAddress(
          nonBidderWallet.address
        )
      ).eventually.fulfilled;

      expect(await market.openARMint()).eq(nonBidderWallet.address);
    });
  });

  describe('#configurePlatformCuts', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configurePlatformCuts(platformCuts)
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {

      const pCutsToSet = {
        firstSalePlatform: Decimal.new(1),
        firstSalePool: Decimal.new(2),
        furtherSalesPlatform: Decimal.new(3),
        furtherSalesPool: Decimal.new(4),
        furtherSalesCreator: Decimal.new(5),
      }


      await expect(
        market.connect(deployerWallet).configurePlatformCuts(pCutsToSet)
      ).eventually.fulfilled;
      
      const pCuts = await market.platformCuts();

      expect(pCuts.firstSalePlatform.value).eq(pCutsToSet.firstSalePlatform.value);
      expect(pCuts.firstSalePool.value).eq(pCutsToSet.firstSalePool.value);
      expect(pCuts.furtherSalesPlatform.value).eq(pCutsToSet.furtherSalesPlatform.value);
      expect(pCuts.firstSalePlatform.value).eq(pCutsToSet.firstSalePlatform.value);
      expect(pCuts.furtherSalesCreator.value).eq(pCutsToSet.furtherSalesCreator.value);      
    });
  });

  describe('#configureEnforcePlatformCuts', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should revert if not called by the owner', async () => {
      await expect(
        market.connect(otherWallet).configureEnforcePlatformCuts(false)
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be callable by the owner', async () => {
      await expect(
        market.connect(deployerWallet).configureEnforcePlatformCuts(false)
      ).eventually.fulfilled;
   
      const state = await market.enforcePlatformCuts();
      
      expect(state).eq(false);
    });
  });

  describe('#ownwership', () => {
    beforeEach(async () => {
      await deploy();
    });

    it('should be able to renounce ownership', async () => {
      await expect(
        market.connect(deployerWallet).renounceOwnership()
      ).eventually.fulfilled;

      await expect(
        market.connect(deployerWallet).configure(
          nonBidderWallet.address
        )
      ).eventually.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be able to transfer ownership', async () => {
      await expect(
        market.connect(deployerWallet).transferOwnership(
          otherWallet.address
        )
      ).eventually.fulfilled;

      await expect(
        market.connect(otherWallet).configure(
          nonBidderWallet.address
        )
      ).eventually.fulfilled;
    });
  });

  describe('#setBidShares', () => {
    beforeEach(async () => {
      await market.connect(deployerWallet).configure(
        otherAddress
      );
    });

    
    it('should reject if not called by the media address', async () => {
      await expect(
        market.connect(bidderWallet).setBidShares(0, defaultBidSharesMint)
      ).rejectedWith('Market: Only media contract');
    });

    it('should set the bid shares if called by the media address', async () => {
      const mediaMarket = market.connect(otherWallet);

      await expect(
        mediaMarket.setBidShares(0, defaultBidSharesMint)
      ).eventually.fulfilled;

      const auctionBidShare = await mediaMarket.bidSharesForToken(0);

      const tokenBidShares: BidShares = Object.keys(
        auctionBidShare
      ).reduce(
        (acc, key) => {
        if (!["platform", "pool", "creator", "owner", "prevOwner"].includes(`${key}`))
          return acc;

        return {
            ...acc,
            [key]: auctionBidShare[key].value.toString(),
          }
        }, {} as BidShares);
      
      expect(tokenBidShares.platform).eq(
        defaultBidSharesMint.platform.value.toString()
      );
      expect(tokenBidShares.pool).eq(
        defaultBidSharesMint.pool.value.toString()
      );
      expect(tokenBidShares.creator).eq(
        defaultBidSharesMint.creator.value.toString()
      );
      expect(tokenBidShares.owner).eq(
        defaultBidSharesMint.owner.value.toString()
      );
      expect(tokenBidShares.prevOwner).eq(
        defaultBidSharesMint.prevOwner.value.toString()
      );
    });

    it('should emit an event when bid shares are updated', async () => {
      const mediaMarket = market.connect(otherWallet);

      const block = await ethers.provider.getBlockNumber();

      await expect(
        mediaMarket.setBidShares(0, defaultBidSharesMint)
      ).eventually.fulfilled;


      const events = await mediaMarket.queryFilter(
        mediaMarket.filters.BidShareUpdated(null, null),
        block
      );
      expect(events.length).eq(1);
      const logDescription = mediaMarket.interface.parseLog(events[0]);
      expect(logDescription.args.tokenId.toString()).to.eq("0");
      expect(logDescription.args.bidShares.prevOwner.value.toString()).to.eq(
        defaultBidSharesMint.prevOwner.value.toString());
      expect(logDescription.args.bidShares.creator.value.toString()).to.eq(
        defaultBidSharesMint.creator.value.toString());
      expect(logDescription.args.bidShares.owner.value.toString()).to.eq(
        defaultBidSharesMint.owner.value.toString());
      expect(logDescription.args.bidShares.platform.value.toString()).to.eq(
        defaultBidSharesMint.platform.value.toString());
      expect(logDescription.args.bidShares.pool.value.toString()).to.eq(
        defaultBidSharesMint.pool.value.toString());
    });

    it('should not reject if the bid shares are invalid but platformcut is enforced', async () => {
      
      const mediaMarket = market.connect(otherWallet);

      await market.connect(deployerWallet).configureEnforcePlatformCuts(true);

      const invalidBidShares = {
        prevOwner: Decimal.new(0),
        owner: Decimal.new(0),
        creator: Decimal.new(101),
        platform: Decimal.new(101),
        pool: Decimal.new(101),
      };

      await expect(
        mediaMarket.setBidShares(0, invalidBidShares)
      ).not.rejectedWith('Market: Invalid bid shares, must sum to 100');
    });

    it('should reject if the bid shares are invalid and platformcut is not enforced', async () => {
      const mediaMarket = market.connect(otherWallet);

      await market.connect(deployerWallet).configureEnforcePlatformCuts(false);

      const invalidBidShares = {
        prevOwner: Decimal.new(0),
        owner: Decimal.new(0),
        creator: Decimal.new(101),
        platform: Decimal.new(101),
        pool: Decimal.new(101),
      };

      await expect(
        mediaMarket.setBidShares(0, invalidBidShares)
      ).rejectedWith('Market: Invalid bid shares, must sum to 100');
    });
  });
});
