import { ethers } from 'hardhat'
import { toTokens } from '../../test/utils/testHelpers'

import data from '../../data/governance-staking-vesting-deployment/test-groups.json' // <---- define here file with data to import

const vestingContractAddress = ''

async function main (): Promise<void> {
  const Vesting = await ethers.getContractFactory('Vesting')
  const vesting = Vesting.attach(vestingContractAddress)

  for (const group of data) {
    console.log(`[Import Groups] Creating new group: ${group.name}`)
    const tx = await vesting._setGroup(
      group.name,
      toTokens(group.total_amount, 18),
      group.offset,
      group.period,
      toTokens(group.initial_unlock, 18)
    )
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
