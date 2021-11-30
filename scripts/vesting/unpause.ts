import { ethers } from 'hardhat'

const vestingContractAddress = ''

async function main (): Promise<void> {
  const vesting = await ethers.getContractAt('Vesting', vestingContractAddress)

  await vesting._unpauseVesting()
  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
