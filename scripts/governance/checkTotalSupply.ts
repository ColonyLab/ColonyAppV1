import { ethers } from 'hardhat'

const governanceTokenAddress = ''

async function main () {
  const ColonyGovernanceToken = await ethers.getContractFactory('ColonyGovernanceToken')
  const colony = ColonyGovernanceToken.attach(governanceTokenAddress)

  const totalSupply = await colony.totalSupply()
  console.log('Total supply: ', ethers.utils.formatUnits(totalSupply, 18), 'CLY')
  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
