// @ts-ignore
import { ethers, Wallet } from "hardhat";
import { Market, Market__factory } from "../typechain";
import fs from "fs-extra";

async function main() {
  const args = require("minimist")(process.argv.slice(2));

  if (!args.chainId) {
    throw new Error("--chainId chain ID is required");
  }

  const path = `${process.cwd()}/.env${
    args.chainId === 100 ? ".balance" : args.chainId === 4 ? ".dev" : ".local"
  }`;

  await require("dotenv").config({ path });

  const addressPath = `${process.cwd()}/addresses/${args.chainId}.json`;
  
  // @ts-ignore
  const addressBook = JSON.parse(await fs.readFileSync(addressPath));

  if (!addressBook.market) {
    throw new Error(
      "Market contract is not registered in address book."
    );
  }
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_ENDPOINT
  );

  const wallet: Wallet = new ethers.Wallet(
    `0x${process.env.PRIVATE_KEY_CONTRACT}`,
    provider
  );


  const market = Market__factory.connect(
    addressBook.market,
    wallet
  ) as Market;
  
  const platform = await market.openARPlatform();
  console.log(`Address platform: ${platform}`)
  console.log(`Balance platform: ${ethers.utils.formatEther(await provider.getBalance(platform))}`);

  const pool = await market.openARPool();
  console.log(`Address pool: ${pool}`);
  console.log(`Balance platform: ${ethers.utils.formatEther(await provider.getBalance(pool))}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
