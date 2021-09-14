import { BigNumber, BigNumberish, Bytes } from 'ethers';

export type DecimalValue = { value: BigNumber };

export type BidShares = {
  owner: DecimalValue;
  prevOwner: DecimalValue;
  creator: DecimalValue;
  platform: DecimalValue;
  pool: DecimalValue;
};

export type MintData = {
  awKeyHex: Bytes;
  objKeyHex: Bytes;
  tokenURI: string;
  metadataURI: string;
  contentHash: Bytes;
  metadataHash: Bytes;
  editionOf: BigNumberish;
  editionNumber: BigNumberish;
};


export type MintArObjectData = {
  awKeyHex: Bytes;
  objKeyHex: Bytes;
  editionOf: BigNumber;
  initialAsk: BigNumber;
  mintArObjectNonce: BigNumber;
  currency: string;
  setInitialAsk: boolean;
};

export type MediaData = {
  awKeyHex: string;
  objKeyHex: string;
  editionOf: BigNumberish;
  editionNumber: BigNumberish;
};

export type Ask = {
  currency: string;
  amount: BigNumberish;
};

export type Bid = {
  currency: string;
  amount: BigNumberish;
  bidder: string;
  recipient: string;
  sellOnShare: { value: BigNumberish };
};

export type PlatformCuts = {
  firstSalePlatform: DecimalValue;
  firstSalePool: DecimalValue;
  furtherSalesPlatform: DecimalValue;
  furtherSalesPool: DecimalValue;
  furtherSalesCreator: DecimalValue;
};