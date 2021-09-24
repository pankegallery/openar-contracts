// @ts-ignore
import { ethers } from "hardhat";
import fs from "fs-extra";
import {
  Market,
  Media,
  WXDAI,
  Market__factory,
  Media__factory,
} from "../typechain";
import { BigNumber, Wallet } from "ethers";
import Decimal from "../utils/Decimal";

type DecimalValue = { value: BigNumber };

type PlatformCuts = {
  firstSalePlatform: DecimalValue;
  firstSalePool: DecimalValue;
  furtherSalesPlatform: DecimalValue;
  furtherSalesPool: DecimalValue;
  furtherSalesCreator: DecimalValue;
};

let platformCuts: PlatformCuts = {
  firstSalePlatform: Decimal.new(10),
  firstSalePool: Decimal.new(5),
  furtherSalesPlatform: Decimal.new(5),
  furtherSalesPool: Decimal.new(5),
  furtherSalesCreator: Decimal.new(5),
};

async function main() {
  const args = require("minimist")(process.argv.slice(2));

  if (!args.chainId) {
    throw new Error("--chainId chain ID is required");
  }

  const path = `${process.cwd()}/.env${
    args.chainId === 100 ? ".prod" : args.chainId === 4 ? ".dev" : ".local"
  }`;

  await require("dotenv").config({ path });

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_ENDPOINT
  );

  const wallet = new ethers.Wallet(
    `0x${process.env.PRIVATE_KEY_CONTRACT}`,
    provider
  );
  const addressPath = `${process.cwd()}/addresses/${args.chainId}.json`;

  // @ts-ignore
  const addressBook = JSON.parse(await fs.readFileSync(addressPath));

  if (addressBook.media) {
    throw new Error(
      "Media already in address book, it must be moved before deploying."
    );
  }

  if (addressBook.market) {
    throw new Error(
      "Market already in address book, it must be moved before deploying."
    );
  }

  let txReceipt, tx;
  // local chain let's deploy a new wxdai contract
  if (args.chainId === 31337) {
    // We get the contract to deploy
    const WxDai = (await ethers.getContractFactory("WXDAI", wallet)) as WXDAI;

    tx = await WxDai.deploy();
    console.log(`Wxdai deploying to ${tx.address}. Awaiting confirmation...`);
    await tx.deployed();
    console.log(`Wxdai deployed!`);
    txReceipt = await provider.getTransactionReceipt(tx.deployTransaction.hash);
    console.log("Wxdai deploy gas usage: ", txReceipt.gasUsed.toNumber());

    addressBook.wxdai = tx.address;
  } else {
    if (!args.wxdai) {
      throw new Error(
        "--wxdai address to deployed native coin wrapper contract is required"
      );
    }

    addressBook.wxdai = args.wxdai;
  }

  // We get the contract to deploy
  const Market = (await ethers.getContractFactory("Market", wallet)) as Market;

  const market = await Market.deploy(addressBook.wxdai);
  console.log(`Market deploying to ${tx.address}. Awaiting confirmation...`);
  await market.deployed();
  console.log(`Market deployed!`);
  addressBook.market = market.address;
  txReceipt = await provider.getTransactionReceipt(
    market.deployTransaction.hash
  );
  console.log("Market deploy gas usage: ", txReceipt.gasUsed.toNumber());

  // We get the contract to deploy
  const Media = (await ethers.getContractFactory("Media", wallet)) as Media;

  const media = await Media.deploy();
  console.log(`Media deploying to ${tx.address}. Awaiting confirmation...`);
  await media.deployed();
  console.log(`Media deployed!`);
  addressBook.media = media.address;
  txReceipt = await provider.getTransactionReceipt(
    media.deployTransaction.hash
  );
  console.log("Media deploy gas usage: ", txReceipt.gasUsed.toNumber());

  const deployerMarket = market.connect(wallet);
  const deployerMedia = market.connect(wallet);

  console.log("Configuring Market...");

  tx = await market.configure(addressBook.media);
  console.log(`Market configure() tx: ${tx.hash}`);
  await tx.wait();

  tx = await market.configurePlatformAddress(
    `0x${process.env.ETH_ADDRESS_PLATFORM}`
  );
  console.log(`Market configurePlatformAddress() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());

  tx = await market.configurePoolAddress(`0x${process.env.ETH_ADDRESS_POOL}`);
  console.log(`Market configurePoolAddress() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());

  tx = await market.configureMintAddress(`0x${process.env.ETH_ADDRESS_MINT}`);
  console.log(`Market configureMintAddress() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());

  tx = await market.configurePlatformCuts(platformCuts);
  console.log(`Market configurePlatformCuts() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());

  tx = await market.configureEnforcePlatformCuts(true);
  console.log(`Market configureEnforcePlatformCuts() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());

  console.log(`Market configured.`);

  console.log("Configuring Media...");

  tx = await media.configure(addressBook.market, 100);
  console.log(`Media configure() tx: ${tx.hash}`);
  await tx.wait();
  txReceipt = await provider.getTransactionReceipt(tx.hash);
  console.log("Gas usage: ", txReceipt.gasUsed.toNumber());
  console.log(`Media configured.`);

  console.log(`Market: ${addressBook.market}`);
  console.log(`Media: ${addressBook.media}`);

  await fs.writeFile(addressPath, JSON.stringify(addressBook, null, 2));

  console.log("Contracts deployed 📿");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
