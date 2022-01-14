import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { toTokens, time } from '../../test/utils/testHelpers'
import { StakingMock } from './misc/stakingMock'
// import { printStakeEvents } from './misc/events'
import { getCombinedStakeEventsCovalenthq } from './misc/eventsCovalenthq'
import {
  generateAuthAccountsReport,
  generateAuthAccountsWithBalancesReport,
  generateDepositsReport
} from './misc/reports'

// defaults, but can be changed to perform a custom check
const stakingAuthAmount = BigNumber.from(toTokens(50))
const stakingAuthPeriod = time.daysToSeconds(20)

// blockNumber or 'latest'
const snapshotBlockNumberString: string = 'latest'

async function main (): Promise<void> {
  const staking = new StakingMock(stakingAuthAmount, stakingAuthPeriod)
  let snapshotBlockNumber: number

  if (snapshotBlockNumberString === 'latest') {
    const latestBlock = await ethers.provider.getBlock('latest')
    snapshotBlockNumber = latestBlock.number
  } else {
    snapshotBlockNumber = +snapshotBlockNumberString
  }

  const stakeEvents = await getCombinedStakeEventsCovalenthq(snapshotBlockNumber)
  staking.loadEvents(stakeEvents)

  // Generating and saving results
  await generateAuthAccountsReport(staking, snapshotBlockNumber)
  await generateAuthAccountsWithBalancesReport(staking, snapshotBlockNumber)
  await generateDepositsReport(staking, snapshotBlockNumber)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
