/**
 *  Deploys the separate Colony Environment contracts
 */

const {ethers} = require("hardhat");

const setupGovernanceToken = async function() {
    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colony = await ColonyGovernanceToken.deploy()
    await colony.deployed()

    return colony
}

module.exports = {
    setupGovernanceToken
}
