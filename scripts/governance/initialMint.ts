import { ethers } from "hardhat";
import { toTokens } from '../../test/utils/testHelpers'
import { bignumber } from "mathjs"

const data = require("../../data/governance-staking-vesting-deployment/test-wallets.json")      // <---- define here file with data to import

const governanceTokenAddress = ''
const vestingContractAddress = ''

async function main(): Promise<void> {

    const directMintAddresses = []
    const directMintValues = []
    let totalAmountToVest = bignumber(0)
    let totalAmountToMint = bignumber(0)


    console.log('[Initial mint] Loading configuration file...')

    for(let wallet of data){
        if(wallet.group == 'direct_mint'){
            console.log(`[Initial mint] Address ${wallet.address} will receive directly ${wallet.amount} tokens`)

            directMintAddresses.push(wallet.address)
            directMintValues.push(toTokens(wallet.amount, 18))
        }
        else{
            totalAmountToVest = totalAmountToVest.add(wallet.amount)
        }
        totalAmountToMint = totalAmountToMint.add(wallet.amount)

    }
    console.log(`[Initial mint] Address ${vestingContractAddress} will receive directly ${totalAmountToVest} tokens (Vesting contract)`)
    console.log(`\n[Initial mint] Total tokens to mint: ${totalAmountToMint}`)

    directMintAddresses.push(vestingContractAddress)
    directMintValues.push(toTokens(totalAmountToVest.toString(), 18))

    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colony = await ColonyGovernanceToken.attach(governanceTokenAddress)

    await colony.initialMint(directMintAddresses, directMintValues)

    console.log('[Initial mint] Done!')
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })