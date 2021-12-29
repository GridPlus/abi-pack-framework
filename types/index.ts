export interface TaggedAddress {
  address: string;
  network: "ethereum" | "polygon" | "binance" | "avalanche";
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
  network: string;
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
