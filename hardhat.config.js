/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config()
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.WALLET_MNEMONIC
      }
    },
    local: {
      url: process.env.LOCAL_RPC_URL,
      accounts: {
        mnemonic: process.env.WALLET_MNEMONIC
      }
    },
    fuji: {
      url: process.env.FUJI_TESTNET_RPC_URL,
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: {
        mnemonic: process.env.WALLET_MNEMONIC
      }
    },
    mainnet: {
      url: process.env.AVAX_MAINNET_RPC_URL,
      gasPrice: 225000000000,
      chainId: 43114,
      accounts: []
    }
  },

  gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_KEY,
    enabled: (process.env.REPORT_GAS) ? true : false
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};
