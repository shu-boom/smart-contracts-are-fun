require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const ALCHEMY_GOERLI_URL = process.env.ALCHEMY_GOERLI_URL;
const PRIVATE_KEY_ACCOUNT_DEPLOYER = process.env.PRIVATE_KEY_ACCOUNT_DEPLOYER;
const PRIVATE_KEY_ACCOUNT_ALICE = process.env.PRIVATE_KEY_ACCOUNT_ALICE;


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.2',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    goerli: {
      live: true,
      chainId: 5,
      tags: ["staging"],
      url: ALCHEMY_GOERLI_URL,
      accounts: [PRIVATE_KEY_ACCOUNT_DEPLOYER, PRIVATE_KEY_ACCOUNT_ALICE],
      waitConfirmations: 5,
    }
  }, namedAccounts: {
    deployer: 0,
    alice: 1
  }
};
