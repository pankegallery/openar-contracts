import { utils } from "ethers";

export const getBytes32FromString = (str: string) => {
  return utils.arrayify(utils.formatBytes32String(str));
}