// @ts-ignore
import { ethers } from "hardhat";
import {
  WXDAI,
  Media,
  BaseERC20,
  Market,
} from "../typechain";

import {ContractTransaction} from "ethers";

import {
  fromRpcSig,
} from 'ethereumjs-util';
import { sha256 } from "ethers/lib/utils";
import Decimal from "../utils/Decimal";
import { BigNumber, Bytes, BigNumberish, Wallet } from "ethers";
import { MintData, BidShares, MintArObjectData } from "./types";
import sigUtils from 'eth-sig-util';
import { BytesLike } from 'ethers/lib/utils';
import { MediaFactory } from "@zoralabs/core/dist/typechain";

export const THOUSANDTH_ETH = ethers.utils.parseUnits(
  "0.001",
  "ether"
) as BigNumber;
export const HUNDREDTH_ETH = ethers.utils.parseUnits("0.01", "ether") as BigNumber;
export const TENTH_ETH = ethers.utils.parseUnits("0.1", "ether") as BigNumber;
export const ONE_ETH = ethers.utils.parseUnits("1", "ether") as BigNumber;
export const TWO_ETH = ethers.utils.parseUnits("2", "ether") as BigNumber;

export function toNumWei(val: BigNumber) {
  return parseFloat(ethers.utils.formatUnits(val, 'wei'));
}

export const deployWXDAI = async () => {
  return (await (await ethers.getContractFactory("WXDAI")).deploy()) as WXDAI;
};

export const deployMedia = async () => {
  return (await (await ethers.getContractFactory("Media")).deploy()) as Media;
};

export const deployMarket = async (wxdaiAddress: string) => {
  return (await (await ethers.getContractFactory("Market")).deploy(wxdaiAddress)) as Market;
};

export const deployCurrency = async () => {
  return (await (await ethers.getContractFactory("BaseERC20")).deploy(
    'test',
    'TEST',
    18
  )) as BaseERC20;
}

export const mint = async (
  media: Media,
  awKeyHex: Bytes,
  objKeyHex: Bytes,
  metadataURI: string,
  tokenURI: string,
  contentHash: Bytes,
  metadataHash: Bytes,
  shares: BidShares,
  editionOfBN?: BigNumber,
  editionNumberBN?: BigNumber
) => {
  const data: MintData = {
    tokenURI,
    metadataURI,
    awKeyHex,
    objKeyHex,
    contentHash,
    metadataHash,
    editionOf: typeof editionOfBN !== 'undefined'
      ? editionOfBN
      : BigNumber.from(1),
    editionNumber: typeof editionNumberBN !== 'undefined'
      ? editionNumberBN
      : BigNumber.from(1),
  };
  
  return media.mint(data, shares);
}

export const revert = (messages: TemplateStringsArray) =>
  `VM Exception while processing transaction: revert ${messages[0]}`;


export type EIP712Sig = {
  deadline: BigNumberish;
  v: any;
  r: any;
  s: any;
};

export async function signPermit(
  media: Media,
  owner: Wallet,
  toAddress: string,
  tokenAddress: string,
  tokenId: number,
  chainId: number
) {
  return new Promise<EIP712Sig>(async (res, reject) => {
    let nonce;
    //const mediaContract =  MediaFactory.connect(tokenAddress, owner);
    // const mediaContract =  (await ethers.getContractFactory("Media")).connect(tokenAddress);

    try {
      nonce = (
        await media.permitNonces(owner.address, tokenId)
      ).toNumber();
    } catch (e) {
      console.error('NONCE', e);
      reject(e);
      return;
    }

    const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24; // 24 hours
    const name = await media.name();

    try {
      
      const sig = sigUtils.signTypedData(Buffer.from(owner.privateKey.slice(2), 'hex'), {
        data: {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Permit: [
              { name: 'spender', type: 'address' },
              { name: 'tokenId', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit',
          domain: {
            name,
            version: '1',
            chainId,
            verifyingContract: media.address,
          },
          message: {
            spender: toAddress,
            tokenId,
            nonce,
            deadline,
          },
        },
      });
      const response = fromRpcSig(sig);
      res({
        r: response.r,
        s: response.s,
        v: response.v,
        deadline: deadline.toString(),
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

export async function signMintWithSig(
  media: Media,
  owner: Wallet,
  tokenAddress: string,
  awKeyHash: BytesLike,
  objKeyHash: BytesLike,
  contentHash: BytesLike,
  metadataHash: BytesLike,
  creatorShareBN: BigNumber,
  nonce: BigNumber,
  chainId: number
) {
  return new Promise<EIP712Sig>(async (res, reject) => {
    // const mediaContract = MediaFactory.connect(tokenAddress, owner);
    // const mediaContract = (await ethers.getContractFactory("Media")).connect(tokenAddress, owner);
    const creatorShare = creatorShareBN.toString();

    const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24; // 24 hours
    const name = await media.name();
   
    try {
      const sig = sigUtils.signTypedData(Buffer.from(owner.privateKey.slice(2), 'hex'), {
        data: {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            MintWithSig: [
              { name: 'awKeyHash', type: 'bytes32' },
              { name: 'objKeyHash', type: 'bytes32' },
              { name: 'contentHash', type: 'bytes32' },
              { name: 'metadataHash', type: 'bytes32' },
              { name: 'creatorShare', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'MintWithSig',
          domain: {
            name,
            version: '1',
            chainId,
            verifyingContract: media.address,
          },
          message: {
            awKeyHash,
            objKeyHash,
            contentHash,
            metadataHash,
            creatorShare,
            nonce: nonce.toNumber(),
            deadline,
          },
        },
      });
      const response = fromRpcSig(sig);
      res({
        r: response.r,
        s: response.s,
        v: response.v,
        deadline: deadline.toString(),
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

export async function signMintArObject(
  media: Media,
  owner: Wallet,
  tokenAddress: string,
  awKeyHash: BytesLike,
  objKeyHash: BytesLike,
  editionOfBN: BigNumber,
  setInitialAsk: boolean,
  initialAskDecimal: Decimal,
  nonceBN: BigNumber,
  chainId: number
) {
  return new Promise<EIP712Sig>(async (res, reject) => {
    // const mediaContract = MediaFactory.connect(tokenAddress, owner);

    const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24; // 24 hours
    const name = await media.name();

    const editionOf = editionOfBN.toString();
    const initialAsk = initialAskDecimal.value.toString();
    const nonce = nonceBN.toString();

    
    try {
      const sig = sigUtils.signTypedData(Buffer.from(owner.privateKey.slice(2), 'hex'), {
        data: {
          types: {
            EIP712Domain: [
              { name: 'name',               type: 'string' },
              { name: 'version',            type: 'string' },
              { name: 'chainId',            type: 'uint256' },
              { name: 'verifyingContract',  type: 'address' },
            ],
            MintArObject: [
              { name: 'awKeyHash',      type: 'bytes32' },
              { name: 'objKeyHash',     type: 'bytes32' },
              { name: 'editionOf',      type: 'uint256' },
              { name: 'setInitialAsk',  type: 'bool' },
              { name: 'initialAsk',     type: 'uint256' },
              { name: 'nonce',          type: 'uint256' },
              { name: 'deadline',       type: 'uint256' },
            ],
          },
          primaryType: 'MintArObject',
          domain: {
            name,
            version: '1',
            chainId,
            verifyingContract: media.address,
          },
          message: {
            awKeyHash,
            objKeyHash,
            editionOf,
            setInitialAsk,
            initialAsk,
            nonce,
            deadline,
          },
        },
      });
      const response = fromRpcSig(sig);
      res({
        r: response.r,
        s: response.s,
        v: response.v,
        deadline: deadline.toString(),
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

export async function mintWithSig(
  token: Media,
  creator: string,
  awKeyHex: Bytes,
  objKeyHex: Bytes,
  tokenURI: string,
  metadataURI: string,
  contentHash: Bytes,
  metadataHash: Bytes,
  shares: BidShares,
  nonce: BigNumber,
  sig: EIP712Sig,
  editionOfBN?: BigNumber,
  editionNumberBN?: BigNumber
) {
  const data: MintData = {
    tokenURI,
    metadataURI,
    awKeyHex,
    objKeyHex,
    contentHash,
    metadataHash,
    editionOf: typeof editionOfBN !== 'undefined'
      ? editionOfBN
      : BigNumber.from(1),
    editionNumber: typeof editionNumberBN !== 'undefined'
      ? editionNumberBN
      : BigNumber.from(1),
  };

  return token.mintWithSig(creator, data, shares, nonce, sig);
}


export async function mintArObjectWithSig(
  batchSize: number,
  token: Media,
  creator: string,
  tokenURIs: string[],
  metadataURIs: string[],
  contentHashes: Bytes[],
  metadataHashes: Bytes[],
  awKeyHex: Bytes,
  objKeyHex: Bytes,
  editionOf: BigNumber,
  setInitialAsk: boolean,
  initialAsk: Decimal,
  nonceBN: BigNumber,
  currencyAddr: string,
  shares: BidShares,
  sig: EIP712Sig
) {
  let offset = 0;

  return new Promise(async (resolve, reject) => {
    while (offset < editionOf.toNumber()) {
      let nextBatchSize = batchSize;
      if (offset + batchSize > editionOf.toNumber()) 
        nextBatchSize = editionOf.toNumber() % batchSize;
      
      const data: MintArObjectData = {
        awKeyHex,
        objKeyHex,
        editionOf,
        initialAsk: initialAsk.value,
        batchSize: BigNumber.from(nextBatchSize),
        batchOffset: BigNumber.from(offset),
        mintArObjectNonce: nonceBN,
        currency: currencyAddr,
        setInitialAsk,
      };

      await token.mintArObject(
        creator,
        tokenURIs.slice(offset, offset + nextBatchSize),
        metadataURIs.slice(offset, offset + nextBatchSize),
        contentHashes.slice(offset, offset + nextBatchSize),
        metadataHashes.slice(offset, offset + nextBatchSize),
        data,
        shares,
        sig
      ).catch((err) => reject(err));
  
      offset += batchSize;
    }

    resolve(true);
  })
  
}