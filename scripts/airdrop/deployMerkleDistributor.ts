import { utils } from 'ethers'
import { ethers } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import airdropData from '../../data/mocks/airdrop-distribution-data-sample.json'
import { time } from '../../test/utils/testHelpers'

const distributedTokenAddress = ''
const distributionStartTimestamp = 0
const distributionRescueDelay = time.daysToSeconds(1)

async function main (): Promise<void> {
  const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor')

  const elements = airdropData.map((x) =>
    utils.solidityKeccak256(['address', 'uint256'], [x.account, x.amount])
  )

  const merkleTree = new MerkleTree(elements, keccak256, { sort: true })
  const root = merkleTree.getHexRoot()

  const distributor = await MerkleDistributor.deploy(root, distributedTokenAddress, distributionStartTimestamp, distributionRescueDelay)
  await distributor.deployed()

  console.log(`Deployment done. Tx hash: ${distributor.deployTransaction.hash}`)
  console.log('MerkleDistributor address:', distributor.address)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
