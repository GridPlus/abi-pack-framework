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

const fs = require('fs')
const SDK = require('gridplus-sdk').Client
const superagent = require('superagent')
const parseAbi = new SDK({ crypto: require('crypto') }).parseAbi;

const BASE_URL = 'https://pay.gridplus.io:3000/contractData'
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;

//-------
// PACKS:
//-------
const OPYN_PACK = [

  // Opyn: https://opyn.gitbook.io/opyn/get-started/abis-smart-contract-addresses
  {
    address: '0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef', // v3 exchange
    app: 'Opyn',
    fname: 'opyn',
    website: 'https://opyn.gitbook.io/opyn/get-started/abis-smart-contract-addresses',
  },

  {
    address: '0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E', // OtokenFactory
    app: 'Opyn',
    fname: 'opyn',
    website: 'https://opyn.gitbook.io/opyn/get-started/abis-smart-contract-addresses',
  },
  {
    address: '0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72', // Controller
    app: 'Opyn',
    fname: 'opyn',
    website: 'https://opyn.gitbook.io/opyn/get-started/abis-smart-contract-addresses',
  },
  {
    address: '0x8f7Dd610c457FC7Cb26B0f9Db4e77581f94F70aC', // Payable Proxy (operator)
    app: 'Opyn',
    fname: 'opyn',
    website: 'https://opyn.gitbook.io/opyn/get-started/abis-smart-contract-addresses',
  },
];
  
const UNISWAP_PACK = [ // Includes both v2 and v3
  // Uniswap: https://uniswap.org/docs/v2/smart-contracts/factory
  {
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // V2 router
    app: 'Uniswap',
    fname: 'uniswap',
    website: 'https://uniswap.org/docs/v2/smart-contracts/factory',
  },
  {
    address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Factory
    app: 'Uniswap',
    fname: 'uniswap',
    website: 'https://uniswap.org/docs/v2/smart-contracts/factory',
  },
  {
    address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17', // UNI-V2 UNIETH LP
    app: 'Uniswap',
    fname: 'uniswap',
    website: 'https://uniswap.org/docs/v2/smart-contracts/factory',
  },
  {
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI token
    app: 'Uniswap',
    fname: 'uniswap',
    website: 'https://uniswap.org/docs/v2/smart-contracts/factory',
  },
  {
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // v3 SwapRouter
    app: 'UniSwap',
    fname: 'uniswap',
    website: 'https://github.com/Uniswap/uniswap-v3-periphery/blob/main/deploys.md',
  },
  {
    address: '0xA5644E29708357803b5A882D272c41cC0dF92B34', // v3 Migrator
    app: 'UniSwap',
    fname: 'uniswap',
    website: 'https://github.com/Uniswap/uniswap-v3-periphery/blob/main/deploys.md',
  },
]
  
const SUSHISWAP_PACK = [
  // SushiSwap: https://dev.sushi.com/sushiswap/contracts
  {
    address: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd', // MasterChef
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0xef0881ec094552b2e128cf945ef17a6752b4ec5d',
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts', // MasterChefV2
  },
  {
    address: '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272', // SushiBar
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', // SushiToken
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0xE11fc0B43ab98Eb91e9836129d1ee7c3Bc95df50', // SushiMaker
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0x08C82f7513C7952A95029FE3B1587B1FA52DACed', // Kashi SushiMaker
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0x16E58463eb9792Bc236d8860F5BC69A81E26E32B', // SushiRoll
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', // SushiV2Factory
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },
  {
    address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiV2Router02
    app: 'SushiSwap',
    fname: 'sushiswap',
    website: 'https://dev.sushi.com/sushiswap/contracts',
  },

]

const AAVE_PACK = [
  // AAVE: https://docs.aave.com/developers/getting-started/deployed-contracts
  {
    address: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // LendingPool
    app: 'Aave',
    fname: 'aave',
    website: 'https://docs.aave.com/developers/getting-started/deployed-contracts',
  },  
  {
    address: '0xDcD33426BA191383f1c9B431A342498fdac73488', // WETH Gateway
    app: 'Aave',
    fname: 'aave',
    website: 'https://docs.aave.com/developers/getting-started/deployed-contracts',
  },
]
  /*
  // COMPOUND ABIS ARE NOT FULLY FETCHED FROM ETHERSCAN AND I DONT REALLY UNDERSTAND WHY
  // THE SITE HAS ABIS WHICH WE CAN USE, BUT THE PROCESS FOR LOADING WILL NEED TO BE DIFFERENT
  // FOR NOW I AM JUST GOING TO REMOVE IT FROM THIS PACK
  // Compound: https://compound.finance/docs#networks
  {
    address: '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
    app: 'Compound',
    website: 'https://compound.finance/docs#networks',
  },
  {
    address: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', // Comptroller
    app: 'Compound',
    website: 'https://compound.finance/docs#networks',
  },
  {
    address: '0xc0da01a04c3f3e0be433606045bb7017a7323e38', // Governance
    app: 'Compound',
    website: 'https://compound.finance/docs#networks',
  },
  */
const YEARN_PACK = [
  // Yearn: https://docs.yearn.finance/developers/deployed-contracts-registry
  // -- v2 Yield Tokens
  {
    address: '0x16de59092dAE5CcF4A1E6439D611fd0653f0Bd01', // yDAIv2
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },
  {
    address: '0x83f798e925BcD4017Eb265844FDDAbb448f1707D', // yUSDTv2
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },
  {
    address: '0x04Aa51bbcB46541455cCF1B8bef2ebc5d3787EC9', // yWBTCv2
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },

  // -- v3 Yield Tokens
  {
    address: '0xC2cB1040220768554cf699b0d863A3cd4324ce32', // yDAIv3
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },

  // -- Vaults
  {
    address: '0xe1237aa7f535b0cc33fd973d66cbf830354d16c7', // yWETH.sol
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },

  // -- Strategies
  
  // -- Delegated Vault Contracts
  {
    address: '0x29e240cfd7946ba20895a7a02edb25c210f9f324', // yDelegatedVault.sol (aLINK)
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },

  // -- Governance
  {
    address: '0xba37b002abafdd8e89a1995da52740bbc013d992', // Governance Staking V2
    app: 'Yearn',
    fname: 'yearn',
    website: 'https://docs.yearn.finance/developers/deployed-contracts-registry',
  },
]

const MAKER_PACK = [
  // Maker: https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json
  // (idk what any of these do lol)
  // '0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B', // MCD_VAT -- contains int256 (unsupported)  
  // '0x5ef30b9986345249bc32d8928B7ee64DE9435E39', // CDP_MANAGER -- contains int256 (unsupported)
  {
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', // MCD_GOV
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0x0a3f6849f78076aefaDf113F5BED87720274dDC0', // MCD_ADM
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0x19c0976f590D67707E62397C87829d896Dc0f1F1', // MCD_JUB
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xa5679C04fc3d9d8b0AaB1F0ab83555b301cA70Ea', // MCD_CAT
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xA950524441892A31ebddF91d3cEEFa04Bf454466', // MCD_VOW
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0x9759A6Ac90977b93B58547b4A71c78317f391A28', // MCD_JOIN_DAI
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xC4269cC7acDEdC3794b221aA4D9205F564e27f0d', // MCD_FLAP
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xC7Bdd1F2B16447dcf3dE045C4a039A60EC2f0ba3', // MCD_IAM_AUTO_LINE
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4', // PROXY_REGISTRY
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // ETH
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0x2F0b23f53734252Bda2277357e97e1517d6B042A', // MCD_JOIN_ETH_A -- all MCD_JOIN contracts have same ABI 
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
  {
    address: '0xF32836B9E1f47a0515c6Ec431592D5EbC276407f', // MCD_FLIP_ETH_A
    app: 'Maker',
    fname: 'maker',
    website: 'https://changelog.makerdao.com/releases/mainnet/1.2.6/contracts.json'
  },
]

const CURVE_PACK = [
   // Curve: https://curve.readthedocs.io/addresses-overview.html

  // -- Base Pools
  {
    address: '0x49849C98ae39Fff122806C06791Fa73784FB3675', // CurveTokenV1.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', // CurveTokenV2.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
    {
    address: '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900', // CurveTokenV3.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2', // CurveContractV1.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  // '0xb6c057591E073249F2D9D88Ba59a46CFC9B59EdB', // DepositBUSD.vy -- contains int128 (unsupported)
  // '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE', // StableSwapAave.vy -- contains int128 (unsupported)

  // -- Meta Pools
  // '0x071c661B4DeefB59E2a3DdB20Db036821eeE8F4b', // StableSwapBBTC.vy -- contains int128 (unsupported)
  // '0xC45b2EEe6e09cA176Ca3bB5f7eEe7C47bF93c756', // DepositBBTC.vy -- contains int128 (unsupported)

  // -- Liquidity Gauges
  {
    address: '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d', // LiquidityGaugeV2.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A', // LiquidityGague.sol
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0xAEA6c312f4b3E04D752946d329693F7293bC2e6D', // LiquidityGaugeReward.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },

  // -- Curve DAO
  // '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB', // GaugeController.vy -- contains int128 (unsupported)
  {
    address: '0xD533a949740bb3306d119CC777fa900bA034cd52', // ERC2CRV.sol
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc', // FeeDistributor.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x519AFB566c05E00cfB9af73496D00217A630e4D5', // GaugeProxy.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0', // Minter.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x6e8f6D1DA6232d5E40b0B8758A0145D6C5123eB7', // PoolProxy.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2', // VotingEscrow.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
  {
    address: '0x575ccd8e2d300e2377b43478339e364000318e2c', // VestingEscrow.vy
    app: 'Curve',
    fname: 'curve',
    website: 'https://curve.readthedocs.io/addresses-overview.html',
  },
]

const GNOSIS_PACK = [ // reference: https://etherscan.io/accounts/label/gnosis-safe
  {
    address: '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B', // Proxy Factory 1.1.1
    app: 'Gnosis Safe',
    fname: 'gnosis',
    website: 'https://docs.gnosis.io/safe/docs/contracts_architecture'
  },
  {
    address: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185', // Mastercopy 1.2.0
    app: 'Gnosis Safe',
    fname: 'gnosis',
    website: 'https://docs.gnosis.io/safe/docs/contracts_architecture'
  },
  {
    address: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD', // Multi Send 1.1.1
    app: 'Gnosis Safe',
    fname: 'gnosis',
    website: 'https://docs.gnosis.io/safe/docs/contracts_architecture'
  }
]


function getContractData(addr, cb) {
  const BASE = `https://api.etherscan.io`;
    const url = `${BASE}/api?module=contract&action=getabi&address=${addr}&apikey=${ETHERSCAN_KEY}`;
    superagent.get(url)
    .end((err, data) => {
      if (err)
        return cb(err.toString())
      const result = JSON.parse(data.text)
      if (result.message !== "OK")
        return cb(result.result)
      return cb(null, JSON.parse(result.result))
    })
}

function buildData(pack, cb, defs=[], metadata=[]) {
  if (pack.length === 0)
    return cb(defs, metadata)
  const d = pack.shift();
  getContractData(d.address, (err, _defs) => {
    if (err) {
      console.error(`Error for ${d.address}: ${err}`)
    } else if (!_defs) {
      console.error('Did not receive response for ', addr)
    } else {
      const newDefs = parseAbi('etherscan', _defs, true);
      if (newDefs.length > 0) {
        defs = defs.concat(newDefs)
        metadata.push(d)
      }
      return buildData(pack, cb, defs, metadata);
    }
  })
}

function getPacks(packs, cb) {
  if (packs.length === 0)
    return cb();
  const pack = packs.shift()
  const name = pack[0].app.toLowerCase();
  buildData(pack, (defs, metadata) => {
    fs.writeFileSync(`./abi_packs/v2_${name}.json`, JSON.stringify({ metadata, defs }))
    console.log(`${pack} Wrote ${defs.length} defs`)
    return getPacks(packs, cb)
  })
}

//-------
// SCRIPT 
//-------
const PACKS_TO_BUILD = [
  UNISWAP_PACK, SUSHISWAP_PACK, YEARN_PACK, AAVE_PACK, MAKER_PACK, GNOSIS_PACK, CURVE_PACK, OPYN_PACK
];
getPacks(PACKS_TO_BUILD, () => {
  console.log('Done.')
});


// Extra constant: mapping from type index to type name (for use with gridplus-sdk + lattice firmware)
const TYPE_MAP = {
    '1': 'ABI_ADDRESS',
    '2': 'ABI_BOOL',
    '3': 'ABI_UINT8',
    '4': 'ABI_UINT16',
    '5': 'ABI_UINT24',
    '6': 'ABI_UINT32',
    '7': 'ABI_UINT40',
    '8': 'ABI_UINT48',
    '9': 'ABI_UINT56',
    '10': 'ABI_UINT64',
    '11': 'ABI_UINT72',
    '12': 'ABI_UINT80',
    '13': 'ABI_UINT88',
    '14': 'ABI_UINT96',
    '15': 'ABI_UINT104',
    '16': 'ABI_UINT112',
    '17': 'ABI_UINT120',
    '18': 'ABI_UINT128',
    '19': 'ABI_UINT136',
    '20': 'ABI_UINT144',
    '21': 'ABI_UINT152',
    '22': 'ABI_UINT160',
    '23': 'ABI_UINT168',
    '24': 'ABI_UINT176',
    '25': 'ABI_UINT184',
    '26': 'ABI_UINT192',
    '27': 'ABI_UINT200',
    '28': 'ABI_UINT208',
    '29': 'ABI_UINT216',
    '30': 'ABI_UINT224',
    '31': 'ABI_UINT232',
    '32': 'ABI_UINT240',
    '33': 'ABI_UINT248',
    '34': 'ABI_UINT256',
    // Skip signed int types
    '67': 'ABI_UINT',
    '69': 'ABI_BYTES1',
    '70': 'ABI_BYTES2',
    '71': 'ABI_BYTES3',
    '72': 'ABI_BYTES4',
    '73': 'ABI_BYTES5',
    '74': 'ABI_BYTES6',
    '75': 'ABI_BYTES7',
    '76': 'ABI_BYTES8',
    '77': 'ABI_BYTES9',
    '78': 'ABI_BYTES10',
    '79': 'ABI_BYTES11',
    '80': 'ABI_BYTES12',
    '81': 'ABI_BYTES13',
    '82': 'ABI_BYTES14',
    '83': 'ABI_BYTES15',
    '84': 'ABI_BYTES16',
    '85': 'ABI_BYTES17',
    '86': 'ABI_BYTES18',
    '87': 'ABI_BYTES19',
    '88': 'ABI_BYTES20',
    '89': 'ABI_BYTES21',
    '90': 'ABI_BYTES22',
    '91': 'ABI_BYTES23',
    '92': 'ABI_BYTES24',
    '93': 'ABI_BYTES25',
    '94': 'ABI_BYTES26',
    '95': 'ABI_BYTES27',
    '96': 'ABI_BYTES28',
    '97': 'ABI_BYTES29',
    '98': 'ABI_BYTES30',
    '99': 'ABI_BYTES31',
    '100': 'ABI_BYTES32',
    '101': 'ABI_BYTES',
    '102': 'ABI_STRING',
    '103': 'ABI_TUPLE1',
    '104': 'ABI_TUPLE2',
    '105': 'ABI_TUPLE3',
    '106': 'ABI_TUPLE4',
    '107': 'ABI_TUPLE5',
    '108': 'ABI_TUPLE6',
    '109': 'ABI_TUPLE7',
    '110': 'ABI_TUPLE8',
    '111': 'ABI_TUPLE9',
    '112': 'ABI_TUPLE10',
    '113': 'ABI_TUPLE11',
    '114': 'ABI_TUPLE12',
    '115': 'ABI_TUPLE13',
    '116': 'ABI_TUPLE14',
    '117': 'ABI_TUPLE15',
    '118': 'ABI_TUPLE16',
    '119': 'ABI_TUPLE17',  // Firmware currently cannot support tuples larger than this
};