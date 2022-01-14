import { utils } from 'ethers'
import { ethers } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import airdropData from '../../data/mocks/airdrop-distribution-data-sample.json'

const merkleDistributorAddress = ''
const claimingAddress = ''

async function main (): Promise<void> {
  const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor')
  const distributior = MerkleDistributor.attach(merkleDistributorAddress)

  const elements = airdropData.map((x) =>
    utils.solidityKeccak256(['address', 'uint256'], [x.account, x.amount])
  )

  const addressIndex = airdropData.findIndex(x => { return x.account === claimingAddress })
  const leaf = elements[addressIndex]

  const merkleTree = new MerkleTree(elements, keccak256, { sort: true })
  const proof = merkleTree.getHexProof(leaf)

  const tx = await distributior.claim(airdropData[addressIndex].account, airdropData[addressIndex].amount, proof)
  await tx.wait()

  console.log(`Claim done. Tx hash: ${tx.hash}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
