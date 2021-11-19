const { fromTokens } = require("../../test/utils/testHelpers")

const governanceTokenAddress = '0xB002B6114C315d54c87B762EaAb9A2857A8324b1'
const vestingContractAddress = '0x52d371267E576f5E44f47eCEbd3Ab023bD7DE20d'

async function main() {
    const ColonyGovernanceToken = await ethers.getContractFactory("ColonyGovernanceToken")
    const colony = await ColonyGovernanceToken.attach(governanceTokenAddress)
    
    const vestingBalance = await colony.balanceOf(vestingContractAddress)
    console.log(`Balance of vesting contract: ${fromTokens(vestingBalance.toString(), 18)} tokens`)
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })