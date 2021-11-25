/**
 *  Automates the deployment of whole Colony Environment with default settings
 */

import { setupGovernanceToken, setupVestingContract, setupStakingContract } from '../setupContracts'
import { toTokens } from '../../test/utils/testHelpers'

async function main (): Promise<void> {
  const colonyGovernanceToken = await setupGovernanceToken()
  console.log('[ DEPLOYMENT ] Governance Token Contract : ', colonyGovernanceToken.address)

  const colonyVestingContract = await setupVestingContract(colonyGovernanceToken.address, 180 * 24 * 60 * 60)
  console.log('[ DEPLOYMENT ] Vesting Contract          : ', colonyVestingContract.address)

  const colonyStakingContract = await setupStakingContract(colonyGovernanceToken.address, toTokens('50', 18), 20 * 24 * 60 * 60)
  console.log('[ DEPLOYMENT ] Staking Contract          : ', colonyStakingContract.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
