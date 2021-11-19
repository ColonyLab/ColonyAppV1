const { toTokens } = require("../../test/utils/testHelpers")

const data = require("../../data/governance-staking-vesting-deployment/test-groups.json")      // <---- define here file with data to import

const vestingContractAddress = '0x4ed8139E29e25f445e4E08B40c331d128e3F4179'

async function main() {
    const Vesting = await ethers.getContractFactory("Vesting")
    const vesting = await Vesting.attach(vestingContractAddress)

    for(let group of data){
        console.log(`[Import Groups] Creating new group: ${group.name}`)
        tx = await vesting._setGroup(group.name, toTokens(group.total_amount, 18), group.offset, group.period)
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