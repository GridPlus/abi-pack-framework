export type Network = "ethereum" | "polygon" | "binance" | "avalanche";

export interface TaggedAddress {
  address: string;
  network: Network;
  tag: string;
}

export interface Contract {
  name: string;
  desc: string;
  version: string;
  website: string;
  priority?: number;
  addresses: TaggedAddress[];
}

export interface ProcessedContract extends Contract {
  network: Network;
}

export interface Def {
  name: string;
  sig: string;
  params: {
    isArray: boolean;
    arraySz: number;
    name: string;
    latticeTypeIdx: number;
  }[];
}

export interface ABIPack {
  metadata: ProcessedContract;
  defs: Def[];
}

export interface PackData {
  name: string,
  outputs: any[],
  inputs: any[],
  stateMutability: string,
  type: string,
  gas: number
}[]

export type ContractGroupedByNetwork = [
  Network,
  [TaggedAddress, ...TaggedAddress[]]
][];
