import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { toTokens, time } from '../../test/utils/testHelpers'
import { StakingPeriods } from './misc/stakingPeriods'
import { getCombinedStakeEventsCovalenthq } from './misc/eventsCovalenthq'
import { generateBonusesReport, generateFullSharesReport, generateAirdropVestingShares, generateAirdropResult } from './misc/reports'

// defaults, but can be changed to perform a custom check
const stakingAuthAmount = BigNumber.from(toTokens(50))
const stakingAuthPeriod = time.daysToSeconds(20)
const airdroppedAmount = toTokens('1000000', 18)

// period used to calculate average stake for account
const averageStakeSizePeriodLimit = time.daysToSeconds(20)

// blockNumber or 'latest'
const snapshotBlockNumberString: string = 'latest'

// also the variable from which AuthPeriod will be counted
const airdropTimestamp = 1644624000

async function main (): Promise<void> {
  const staking = new StakingPeriods(stakingAuthAmount, stakingAuthPeriod, airdropTimestamp, averageStakeSizePeriodLimit)
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
  await generateBonusesReport(staking, snapshotBlockNumber)
  await generateFullSharesReport(staking, snapshotBlockNumber)
  await generateAirdropVestingShares(staking, snapshotBlockNumber)
  await generateAirdropResult(staking, snapshotBlockNumber, airdroppedAmount)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
