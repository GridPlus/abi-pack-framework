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

const fs = require("fs");
const SDK = require("gridplus-sdk").Client;
const superagent = require("superagent");
const parseAbi = new SDK({ crypto: require("crypto") }).parseAbi;
const jsonc = require("jsonc");
const Throttle = require("superagent-throttle");

const METADATA_PATH = "./metadata";
const BASE_URL = "https://pay.gridplus.io:3000/contractData";
const BASE = `https://api.etherscan.io`;
const OUTPUT_DIRECTORY_PATH = "./abi_packs";
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const OUTPUT_FILE_VERSION = process.env.OUTPUT_FILE_VERSION ?? "v2";

const throttle = new Throttle({
  active: true,
  rate: 5,
  ratePer: 1000,
  concurrent: 1,
});

function etherscanUrl(address) {
  return `${BASE}/api?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_KEY}`;
}

function getOutputFileLocation(name) {
  return `${OUTPUT_DIRECTORY_PATH}/${OUTPUT_FILE_VERSION}_${name}.json`;
}

function injestMetadata(path) {
  return jsonc.parse(fs.readFileSync(path).toString());
}

function loadMetadataFiles() {
  return fs
    .readdirSync(METADATA_PATH)
    .map((filename) => `${METADATA_PATH}/${filename}`)
    .map(injestMetadata);
}

function fetchPackData({ address }) {
  return superagent
    .get(etherscanUrl(address))
    .use(throttle.plugin())
    .then((res) => JSON.parse(res.text))
    .then((json) => {
      if (json.status === "1") {
        return JSON.parse(json.result);
      } else {
        console.error(`ERROR: ${json.result}`);
        return [];
      }
    })
    .catch(console.error);
}

function parsePackData(data) {
  return parseAbi("etherscan", data, true);
}

async function processMetadata(metadata) {
  const defs = await Promise.all(
    metadata.map((pack) => fetchPackData(pack).then(parsePackData))
  );

  return {
    defs: defs.flat(),
    metadata,
  };
}

function generateAbiPacks() {
  return loadMetadataFiles().map(processMetadata);
}

function getPackName(pack) {
  if (!pack.metadata) return;
  return pack.metadata[0].app.toLowerCase();
}

function writeIndexFile(packs) {
  const packNames = packs.map(getPackName);
  const dataToWrite = JSON.stringify(packNames);
  fs.writeFileSync(getOutputFileLocation("index"), dataToWrite);
  console.log(`Wrote Index`);
}

function writePackData(packs) {
  return packs.map((pack) => {
    const name = getPackName(pack);
    const dataToWrite = JSON.stringify(pack);
    fs.writeFileSync(getOutputFileLocation(name), dataToWrite);
    console.log(`${name} Wrote ${pack.defs.length} defs`);
  });
}

Promise.all(generateAbiPacks()).then((packs) => {
  writePackData(packs);
  writeIndexFile(packs);
});
