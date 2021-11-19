/**
 *  Deploys the separate Colony Environment contracts
 */

const {ethers} = require("hardhat");

const setupGovernanceToken = async function() {
    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colonyGovernanceTokenInstance = await ColonyGovernanceToken.deploy()
    await colonyGovernanceTokenInstance.deployed()

    return colonyGovernanceTokenInstance
}

const setupTestGovernanceToken = async function() {
    const TestGovernanceToken = await ethers.getContractFactory("TestGovernanceToken")
    const testGovernanceTokenInstance = await TestGovernanceToken.deploy()
    await testGovernanceTokenInstance.deployed()

    return testGovernanceTokenInstance
}

const setupVestingContract = async function(governanceTokenAddress) {
    const VestingContract = await ethers.getContractFactory("Vesting")
    const vestingContractInstance = await VestingContract.deploy(governanceTokenAddress)
    await vestingContractInstance.deployed()

    return vestingContractInstance
}

const setupStakingContract = async function(governanceTokenAddress, minTreshold, minPeriod) {
    const ColonyStakingContract = await ethers.getContractFactory("Staking")
    const staking = await ColonyStakingContract.deploy(governanceTokenAddress, minTreshold, minPeriod)
    await staking.deployed()

    return staking
} 

module.exports = {
    setupGovernanceToken,
    setupTestGovernanceToken,
    setupVestingContract,
    setupStakingContract
}
