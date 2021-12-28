/*
This is a node.js script to generate GridPlus ABI packs, which are generally uploaded to a public S3 bucket and
installable via the GridPlus Web Wallet (wallet.gridplus.io). You will need to have `gridplus-sdk` and `superagent`
installed to run this script.

To add more packs, take a look at the formatting of the existing ones (e.g. `UNISWAP_PACK`) and replicate that format:
* `address` - smart contract address. This script scans mainnet by default, though in theory you could modify
              it to scan contracts on a different network.
* `app`     - the human readable name of the app or set of contracts. This is what gets displayed on web.gridplus.io
* `fname`   - the file name where this will be saved: `./abi_packs/<fname>.json`
* `website` - a URL ideally containing documentation about what these contracts are. Generally this site is hosted
              by the app which deployed/uses the contracts

To run this script, you will need a working Etherscan API key:

> env ETHERSCAN_KEY=<my_etherscan_key> node gridplus_abi_builder.js

If you wish to change which packs are being fetched and built, just change the `PACKS_TO_BUILD` variable near the 
bottom of this script.
*/
import { ABIPack, Contract, TaggedAddress } from "./types";
const fs = require("fs");
const SDK = require("gridplus-sdk").Client;
const superagent = require("superagent");
const parseAbi = new SDK({ crypto: require("crypto") }).parseAbi;
const jsonc = require("jsonc");
const Throttle = require("superagent-throttle");

const CONTRACT_NETWORKS = {
  ethereum: {
    baseUrl: "https://api.etherscan.io",
    apiKey: process.env.ETHERSCAN_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle({
      active: true,
      rate: 5,
      ratePer: 1000,
      concurrent: 1,
    }),
  },
  polygon: {
    baseUrl: "https://api.polygonscan.com",
    apiKey: process.env.POLYGON_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle({
      active: true,
      rate: 5,
      ratePer: 1000,
      concurrent: 1,
    }),
  },
  binance: {
    baseUrl: "https://api.bscscan.com",
    apiKey: process.env.BINANCE_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle({
      active: true,
      rate: 5,
      ratePer: 1000,
      concurrent: 1,
    }),
  },
  avalanche: {
    baseUrl: "https://api.snowtrace.io",
    apiKey: process.env.SNOWTRACE_KEY,
    apiRoute: "api?module=contract&action=getabi&address=",
    throttle: new Throttle({
      active: true,
      rate: 5,
      ratePer: 1000,
      concurrent: 1,
    }),
  },
};
const CONTRACTS_PATH = "./contracts";
const OUTPUT_DIRECTORY_PATH = "./abi_packs";

function getThrottle({ network }: TaggedAddress) {
  const { throttle } = CONTRACT_NETWORKS[network];
  return throttle.plugin();
}

function getNetworkUrl({ address, network }: TaggedAddress) {
  const { baseUrl, apiKey, apiRoute } = CONTRACT_NETWORKS[network];
  return `${baseUrl}/${apiRoute}${address}&apikey=${apiKey}`;
}
function getPackFileName(pack: ABIPack) {
  const formattedName = pack.metadata.name.replace(/\s+/g, "_").toLowerCase();
  return `v${pack.metadata.version}_${formattedName}.json`;
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

function fetchPackData(address: TaggedAddress) {
  return superagent
    .get(getNetworkUrl(address))
    .use(getThrottle(address))
    .then((res: any) => JSON.parse(res.text))
    .then((json: any) => {
      if (json.status === "1") {
        return JSON.parse(json.result);
      } else {
        console.error(`ERROR: ${json.result}`);
        return [];
      }
    })
    .catch(console.error);
}

function parseAddress(address: string) {
  return parseAbi("etherscan", address, true);
}

async function processContractData(contractData: Contract) {
  const defs = await Promise.all(
    contractData.addresses.map((address) =>
      fetchPackData(address).then(parseAddress)
    )
  );

  return {
    defs: defs.flat(),
    metadata: contractData,
  };
}

function writeIndexFile(packs: ABIPack[]) {
  const formattedPackData = packs
    .map((pack) => ({
      ...pack.metadata,
      fname: getPackFileName(pack),
    }))
    .sort((packA, packB) => (packB.priority ?? 0) - (packA.priority ?? 0));
  const dataToWrite = JSON.stringify(formattedPackData);
  fs.writeFileSync(`${OUTPUT_DIRECTORY_PATH}/index.json`, dataToWrite);
  console.log(`Wrote Index`);
}

function writePackData(packs: ABIPack[]) {
  return packs.map((pack) => {
    const dataToWrite = JSON.stringify(pack);
    fs.writeFileSync(getOutputFileLocation(pack), dataToWrite);
    console.log(`${pack.metadata.name} Wrote ${pack.defs.length} defs`);
  });
}

Promise.all(loadContractFiles().map(processContractData)).then((packs) => {
  writePackData(packs);
  writeIndexFile(packs);
});
