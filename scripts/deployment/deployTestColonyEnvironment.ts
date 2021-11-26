/**
 *  Automates the deployment of whole Colony Environment with default settings
 */

import { setupTestGovernanceToken, setupVestingContract, setupStakingContract } from '../setupContracts'
import { time, toTokens } from '../../test/utils/testHelpers'

const vestingCloseOffset = time.hoursToSeconds(2)
const vestingCloseMargin = time.minutesToSeconds(30)

const stakingAuthTokenAmount = toTokens('50', 18)
const stakingAuthTokenPeriod = 5 * 60

async function main (): Promise<void> {
  const colonyGovernanceToken = await setupTestGovernanceToken()
  console.log('[ DEPLOYMENT ] Governance Token Contract : ', colonyGovernanceToken.address)

  const colonyVestingContract = await setupVestingContract(colonyGovernanceToken.address, vestingCloseOffset, vestingCloseMargin)
  console.log('[ DEPLOYMENT ] Vesting Contract          : ', colonyVestingContract.address)

  const colonyStakingContract = await setupStakingContract(colonyGovernanceToken.address, stakingAuthTokenAmount, stakingAuthTokenPeriod)
  console.log('[ DEPLOYMENT ] Staking Contract          : ', colonyStakingContract.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
