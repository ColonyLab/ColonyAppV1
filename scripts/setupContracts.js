/**
 *  Deploys the separate Colony Environment contracts
 */

const {ethers} = require("hardhat");
const { toTokens } = require("../test/utils/testHelpers")

const setupGovernanceToken = async function() {
    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colonyGovernanceTokenInstance = await ColonyGovernanceToken.deploy()
    await colonyGovernanceTokenInstance.deployed()

    return colonyGovernanceTokenInstance
}

const setupVestingContract = async function(governanceTokenAddress) {
    const ColonyVestingContract = await ethers.getContractFactory("ColonyVesting")
    const colonyVestingContractInstance = await ColonyVestingContract.deploy(governanceTokenAddress)
    await colonyVestingContractInstance.deployed()

    return colonyVestingContractInstance
}

const setupStakingContract = async function(governanceTokenInstance) {
    decimals = await governanceTokenInstance.decimals()

    const ColonyStakingContract = await ethers.getContractFactory("Staking")

    const twentyDays = 20 * 86400
    const staking = await ColonyStakingContract.deploy(governanceTokenInstance.address,toTokens(50, decimals), twentyDays)
    await staking.deployed()

    return staking
}

module.exports = {
    setupGovernanceToken,
    setupVestingContract,
    setupStakingContract
}
