/**
 *  Automates the deployment of whole Colony Environment with default settings
 */

import { setupGovernanceToken, setupVestingContract, setupStakingContract } from '../setupContracts'
import { time, toTokens } from '../../test/utils/testHelpers'

const vestingCloseOffset = time.daysToSeconds(180)
const vestingCloseMargin = time.daysToSeconds(2)

const stakingAuthTokenAmount = toTokens('50', 18)
const stakingAuthTokenPeriod = time.daysToSeconds(20)

async function main (): Promise<void> {
  const colonyGovernanceToken = await setupGovernanceToken()
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
