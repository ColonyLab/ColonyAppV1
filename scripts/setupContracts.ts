/**
 *  Deploys the separate Colony Environment contracts
 */

import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";

export async function setupGovernanceToken(): Promise<Contract> {
    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colonyGovernanceTokenInstance = await ColonyGovernanceToken.deploy()
    await colonyGovernanceTokenInstance.deployed()

    return colonyGovernanceTokenInstance
}

export async function  setupTestGovernanceToken(): Promise<Contract> {
    const TestGovernanceToken = await ethers.getContractFactory("TestGovernanceToken")
    const testGovernanceTokenInstance = await TestGovernanceToken.deploy()
    await testGovernanceTokenInstance.deployed()

    return testGovernanceTokenInstance
}

export async function  setupVestingContract(governanceTokenAddress: string): Promise<Contract> {
    const VestingContract = await ethers.getContractFactory("Vesting")
    const vestingContractInstance = await VestingContract.deploy(governanceTokenAddress)
    await vestingContractInstance.deployed()

    return vestingContractInstance
}

export async function  setupStakingContract(governanceTokenAddress: String, minTreshold: string | number, minPeriod: string | number): Promise<Contract> {
    const ColonyStakingContract = await ethers.getContractFactory("Staking")
    const staking = await ColonyStakingContract.deploy(governanceTokenAddress, minTreshold, minPeriod)
    await staking.deployed()

    return staking
} 

