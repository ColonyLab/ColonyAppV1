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

const setupVestingContract = async function(governanceTokenAddress) {
    const ColonyVestingContract = await ethers.getContractFactory("ColonyVesting")
    const colonyVestingContractInstance = await ColonyVestingContract.deploy(governanceTokenAddress)
    await colonyVestingContractInstance.deployed()

    return colonyVestingContractInstance
}

module.exports = {
    setupGovernanceToken,
    setupVestingContract
}
