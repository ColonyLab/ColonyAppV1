import { ethers } from 'hardhat'
import { toTokens } from '../../test/utils/testHelpers'

async function main (): Promise<void> {
  const TokenMock = await ethers.getContractFactory('TokenMock')

  const tokenMock1 = await TokenMock.deploy('Cool Token', 'CL', toTokens('1000000000', 18))
  await tokenMock1.deployed()

  const tokenMock2 = await TokenMock.deploy('Amazing Token', 'AT', toTokens('1000000000', 18))
  await tokenMock2.deployed()

  const tokenMock3 = await TokenMock.deploy('Moon Token', 'MT', toTokens('1000000000', 18))
  await tokenMock3.deployed()

  console.log('Token 1:', tokenMock1.address)
  console.log('Token 2:', tokenMock2.address)
  console.log('Token 3:', tokenMock3.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
