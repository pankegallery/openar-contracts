import { BigNumber, BigNumberish, Bytes } from 'ethers';

export type DecimalValue = { value: BigNumber };


export type EIP712Sig = {
  deadline: BigNumberish;
  v: any;
  r: any;
  s: any;
};


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
  editionOf: BigNumber;
  editionNumber: BigNumber;
};

export type MintArObjectData = {
  awKeyHex: Bytes;
  objKeyHex: Bytes;
  editionOf: BigNumber;
  initialAsk: BigNumber;
  batchSize: BigNumber;
  batchOffset: BigNumber;
  mintArObjectNonce: BigNumber;
  currency: string;
  setInitialAsk: boolean;
};

export type MediaData = {
  awKeyHex: string;
  objKeyHex: string;
  editionOf: BigNumber;
  editionNumber: BigNumber;
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