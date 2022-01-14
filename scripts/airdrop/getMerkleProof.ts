import { utils } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import airdropData from '../../data/stake-snapshots/islander-distribution.json'

const claimingAddress = ''

async function main (): Promise<void> {
  const elements = airdropData.map((x) =>
    utils.solidityKeccak256(['address', 'uint256'], [x.account, x.amount])
  )

  const addressIndex = airdropData.findIndex(x => { return x.account === claimingAddress.toLowerCase() })
  const leaf = elements[addressIndex]

  const merkleTree = new MerkleTree(elements, keccak256, { sort: true })
  const proof = merkleTree.getHexProof(leaf)

  console.log('Account:')
  console.log(airdropData[addressIndex].account)
  console.log('')
  console.log('Amount:')
  console.log(airdropData[addressIndex].amount)
  console.log('')
  console.log('Merkleproof:')
  console.log(proof)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
