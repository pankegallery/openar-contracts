// @ts-ignore
import { ethers } from "hardhat";

async function main() {
  const args = require("minimist")(process.argv.slice(2), {
    string: ['toAddress'],
  });

  const path = `${process.cwd()}/.env.local`;

  await require("dotenv").config({ path });

  if (!args.chainId) {
    throw new Error("--chainId chain ID is required");
  }

  if (!args.toAddress) {
    throw new Error("--toAddress is required");
  }

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_ENDPOINT
  );

  const wallet = new ethers.Wallet(
    `0x${process.env.PRIVATE_KEY_CONTRACT}`,
    provider
  );

  const tx = {
    from: wallet.address,
    to: `${args.toAddress}`,
    value: ethers.utils.parseEther("1000"),
    nonce: await provider.getTransactionCount(wallet.address, "latest"),
    gasLimit: ethers.utils.hexlify("0x100000"), // 100000
    gasPrice: await provider.getGasPrice(), // gasPrice,
  };
  
  await wallet.sendTransaction(tx).then((transaction) => {
    console.log("Funds transferred 🔥");
  }).catch((err) => console.error(err));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
