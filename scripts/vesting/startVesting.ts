import { ethers } from 'hardhat'

const vestingContractAddress = ''
const returnWalletAddress = ''

async function main () {
  const Vesting = await ethers.getContractFactory('Vesting')
  const vesting = Vesting.attach(vestingContractAddress)

  await vesting._startVesting(0, returnWalletAddress)
  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
