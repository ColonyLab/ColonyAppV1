import { ethers } from "hardhat";
import { toTokens } from '../../test/utils/testHelpers'

const data = require("../../data/governance-staking-vesting-deployment/test-wallets.json")      // <---- define here file with data to import

const vestingContractAddress = ''

async function main(): Promise<void> {
    const Vesting = await ethers.getContractFactory("Vesting")
    const vesting = await Vesting.attach(vestingContractAddress)

    const groupsData = []

    console.log(`[Import Wallets] Loading groups data from contract...`)
    const groupEvents = await vesting.queryFilter(vesting.filters.GroupDataSet())
    for(const event of groupEvents){
        groupsData[event.args?.groupName] = event.args?.groupId.toString()
    }

    for(let wallet of data){
        if(wallet.group != 'direct_mint' && groupsData[wallet.group] === undefined){
            throw Error(`Unrecognized group in import data file: ${wallet.group}`)
        }
    }

    for(let wallet of data){
        if(wallet.group != 'direct_mint'){
            console.log(`[Import Wallets] Adding new wallet to vesting: ${wallet.address}`)
            const tx = await vesting._setUser(wallet.address, groupsData[wallet.group], toTokens(wallet.amount, 18))
            await tx.wait()
            console.log(`[Import Wallets] Wallet ${wallet.address} has been added: ${tx.hash}\n`)
        }
    }
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })