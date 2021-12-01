import { ethers } from 'hardhat'

const vestingContractAddress = ''
const walletToCheck = ''

async function main () {
  const Vesting = await ethers.getContractFactory('Vesting')
  const vesting = Vesting.attach(vestingContractAddress)

  const walletData = await vesting.userConfiguration(walletToCheck)
  console.log('Vested amount', ethers.utils.formatUnits(walletData.vestAmount, 18), 'CLY')
  console.log('Withdrawn amount', ethers.utils.formatUnits(walletData.withdrawnAmount, 18), 'CLY')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
