const { toTokens } = require("../../test/utils/testHelpers")
const { bignumber } = require("mathjs")

const data = require("../../data/governance-staking-vesting-deployment/test-wallets.json")      // <---- define here file with data to import

const governanceTokenAddress = '0x66ac5b974fF2941c1de7A33232e8A2bb069C71De'
const vestingContractAddress = '0xE10EC8d4dBaF84847301351f31FdEf9c37E401aa'

async function main() {

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