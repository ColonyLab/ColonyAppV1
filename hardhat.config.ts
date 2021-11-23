/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import dotenv from 'dotenv';
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "@nomiclabs/hardhat-waffle";

dotenv.config()

const reportGas = process.env.REPORT_GAS?.toLowerCase() === 'true'
const reportSize = process.env.REPORT_SIZE?.toLowerCase() === 'true'

export default {
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
    enabled: reportGas
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: reportSize,
    disambiguatePaths: false,
  }
};