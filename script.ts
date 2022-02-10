import flatten from "lodash/flatten";
import groupBy from "lodash/groupBy";
import {
  ABIPack,
  Contract,
  ContractGroupedByNetwork,
  Def,
  Network,
  PackData,
  TaggedAddress
} from "./types";
const fs = require("fs");
const SDK = require("gridplus-sdk").Client;
const superagent = require("superagent");
const parseAbi = new SDK({ crypto: require("crypto") }).parseAbi;
const jsonc = require("jsonc");
const Throttle = require("superagent-throttle");

const CONTRACTS_PATH = "./contracts";
const OUTPUT_DIRECTORY_PATH = "./abi_packs";
const DEFAULT_NETWORK = "ethereum";
const DEFAULT_THROTTLE = {
  active: true,
  rate: 5,
  ratePer: 1000,
  concurrent: 1,
};
const CONTRACT_NETWORKS = {
  ethereum: {
    baseUrl: "https://api.etherscan.io",
    apiKey: process.env.ETHERSCAN_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle(DEFAULT_THROTTLE),
  },
  polygon: {
    baseUrl: "https://api.polygonscan.com",
    apiKey: process.env.POLYGON_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle(DEFAULT_THROTTLE),
  },
  binance: {
    baseUrl: "https://api.bscscan.com",
    apiKey: process.env.BINANCE_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle(DEFAULT_THROTTLE),
  },
  avalanche: {
    baseUrl: "https://api.snowtrace.io",
    apiKey: process.env.SNOWTRACE_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle(DEFAULT_THROTTLE),
  },
};

function getNetworkConfig(network: Network) {
  return CONTRACT_NETWORKS[network] ?? CONTRACT_NETWORKS[DEFAULT_NETWORK];
}

function getThrottle({ network }: TaggedAddress) {
  const { throttle } = getNetworkConfig(network);
  return throttle.plugin();
}

function getNetworkUrl({ address, network }: TaggedAddress) {
  const { baseUrl, apiKey, apiRoute } = getNetworkConfig(network);
  return `${baseUrl}/${apiRoute}${address}&apikey=${apiKey}`;
}

function getPackFileName(pack: ABIPack) {
  const formattedName = pack.metadata.name.replace(/\s+/g, "_").toLowerCase();
  return `v${pack.metadata.version}_${formattedName}_${pack.metadata.network}.json`;
}

function getOutputFileLocation(pack: ABIPack) {
  return `${OUTPUT_DIRECTORY_PATH}/${getPackFileName(pack)}`;
}

function injestMetadata(path: string) {
  return jsonc.parse(fs.readFileSync(path).toString());
}

function loadContractFiles(): Contract[] {
  return fs
    .readdirSync(CONTRACTS_PATH)
    .map((filename: string) => `${CONTRACTS_PATH}/${filename}`)
    .map(injestMetadata);
}

function fetchPackData(address: TaggedAddress): Promise<PackData> {
  return superagent
    .get(getNetworkUrl(address))
    .use(getThrottle(address))
    .then((res: any) => JSON.parse(res.text))
    .then((json: any) => {
      if (json.status === "1") {
        console.info(`Successfully fetched address ${address.address}`);
        return JSON.parse(json.result);
      } else {
        console.error(
          `Failed to fetch address ${address.address}. ERROR: ${json.result}`
        );
        return [];
      }
    })
    .catch(console.error);
}

function groupContractByNetwork(contract: Contract) {
  return Object.entries(
    groupBy(contract.addresses, "network")
  ) as ContractGroupedByNetwork;
}

function parsePackData(packData: PackData): Def {
  return parseAbi("etherscan", packData, true);
}

function generateMetadata(contract: Contract, network: Network) {
  return {
    ...contract,
    network,
    addresses: contract.addresses.filter(
      (address) => address.network === network
    ),
  };
}

function generateDefs(addresses: TaggedAddress[]) {
  return Promise.all(
    addresses.map((address) => fetchPackData(address).then(parsePackData))
  ).then(flatten);
}

async function processContract(contract: Contract): Promise<ABIPack[]> {
  return Promise.all(
    groupContractByNetwork(contract).map(async ([network, addresses]) => ({
      metadata: generateMetadata(contract, network),
      defs: await generateDefs(addresses),
    }))
  );
}

function writeIndexFile(packs: ABIPack[][]) {
  const formattedPackData = packs
    .flat()
    .map((pack) => ({
      ...pack.metadata,
      fname: getPackFileName(pack),
    }))
    .sort((packA, packB) => (packB.priority ?? 0) - (packA.priority ?? 0));
  const dataToWrite = JSON.stringify(formattedPackData);
  fs.writeFileSync(`${OUTPUT_DIRECTORY_PATH}/index.json`, dataToWrite);
  console.log(`Wrote Index for ${formattedPackData.length} ABI packs`);
}

function writePackData(packs: ABIPack[]) {
  return packs.map((pack) => {
    const dataToWrite = JSON.stringify(pack);
    fs.writeFileSync(getOutputFileLocation(pack), dataToWrite);
    console.log(`${pack.metadata.name} Wrote ${pack.defs.length} defs`);
  });
}

function outputDataToFiles(packsByNetwork: ABIPack[][]) {
  packsByNetwork.forEach(writePackData);
  writeIndexFile(packsByNetwork);
}

Promise.all(loadContractFiles().map(processContract)).then(outputDataToFiles);
