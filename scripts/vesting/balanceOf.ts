import { ethers } from 'hardhat'
import { fromTokens } from '../../test/utils/testHelpers'

const governanceTokenAddress = ''
const vestingContractAddress = ''

async function main (): Promise<void> {
  const ColonyGovernanceToken = await ethers.getContractFactory('ColonyGovernanceToken')
  const colony = ColonyGovernanceToken.attach(governanceTokenAddress)

  const vestingBalance = await colony.balanceOf(vestingContractAddress)
  console.log(`Balance of vesting contract: ${fromTokens(vestingBalance.toString(), 18)} tokens`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
