import { ethers } from "hardhat";
import { toTokens } from '../../test/utils/testHelpers'

const data = require("../../data/governance-staking-vesting-deployment/test-groups.json")      // <---- define here file with data to import

const vestingContractAddress = ''

async function main(): Promise<void> {
    const Vesting = await ethers.getContractFactory("Vesting")
    const vesting = await Vesting.attach(vestingContractAddress)

    for(let group of data){
        console.log(`[Import Groups] Creating new group: ${group.name}`)
        const tx = await vesting._setGroup(group.name, toTokens(group.total_amount, 18), group.offset, group.period)
        await tx.wait()
        console.log(`[Import Groups] Group ${group.name} has been created: ${tx.hash}\n`)
    }
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })