import { ethers } from 'hardhat'

const merkleDistributorAddress = ''
const rescueDestinationAddress = ''

async function main (): Promise<void> {
  const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor')
  const distributior = MerkleDistributor.attach(merkleDistributorAddress)

  const tx = await distributior.rescue(rescueDestinationAddress)
  await tx.wait()

  console.log(`Rescue done. Tx hash: ${tx.hash}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
