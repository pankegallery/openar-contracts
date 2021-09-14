// @ts-ignore
import { ethers } from "hardhat";
import {
  WXDAI,
  Media,
  Market,
} from "../typechain";

import { sha256 } from "ethers/lib/utils";
import Decimal from "../utils/Decimal";
import { BigNumber } from "ethers";

export const THOUSANDTH_ETH = ethers.utils.parseUnits(
  "0.001",
  "ether"
) as BigNumber;
export const TENTH_ETH = ethers.utils.parseUnits("0.1", "ether") as BigNumber;
export const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;
export const TWO_ETH = ethers.utils.parseUnits("2", "ether") as BigNumber;

export const deployWXDAI = async () => {
  return (await (await ethers.getContractFactory("WXDAI")).deploy()) as WXDAI;
};

export const deployMedia = async () => {
  return (await (await ethers.getContractFactory("Media")).deploy()) as Media;
};

export const deployMarket = async (wxdaiAddress: string) => {
  return (await (await ethers.getContractFactory("Market")).deploy(wxdaiAddress)) as Market;
};

// export const mint = async (media: Media) => {
//   const metadataHex = ethers.utils.formatBytes32String("{}");
//   const metadataHash = await sha256(metadataHex);
//   const hash = ethers.utils.arrayify(metadataHash);
//   await media.mint(
//     {
//       tokenURI: "zora.co",
//       metadataURI: "zora.co",
//       contentHash: hash,
//       metadataHash: hash,
//     },
//     {
//       prevOwner: Decimal.new(0),
//       owner: Decimal.new(85),
//       creator: Decimal.new(15),
//     }
//   );
// };

export const revert = (messages: TemplateStringsArray) =>
  `VM Exception while processing transaction: revert ${messages[0]}`;
