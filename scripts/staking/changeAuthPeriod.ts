import { ethers } from 'hardhat'
import { time } from '../../test/utils/testHelpers'

const stakingContractAddress = ''
const stakingAuthPeriod = time.daysToSeconds(20)

async function main (): Promise<void> {
  const Staking = await ethers.getContractFactory('Staking')
  const staking = Staking.attach(stakingContractAddress)

  await staking.setAuthorizedStakePeriod(stakingAuthPeriod)
  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
