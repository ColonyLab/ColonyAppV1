/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config()
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');

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
