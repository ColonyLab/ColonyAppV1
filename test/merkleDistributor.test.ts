import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, utils } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import { MerkleDistributor } from '../typechain-types'
import airdropData from '../data/mocks/airdrop-distribution-data-sample.json'
import { time, toTokens } from './utils/testHelpers'

describe('MerkleDistributor', function () {
  let merkleTree: MerkleTree
  let distributor: MerkleDistributor

  const elements = airdropData.map((x) =>
    utils.solidityKeccak256(['address', 'uint256'], [x.account, x.amount])
  )

  beforeEach(async function (): Promise<void> {
    merkleTree = new MerkleTree(elements, keccak256, { sort: true })
    const root = merkleTree.getHexRoot()

    const TokenMock = await ethers.getContractFactory('TokenMock')
    const token = await TokenMock.deploy('Test Token', 'TT', toTokens('1000000000', 18))
    await token.deployed()

    const Distributor = await ethers.getContractFactory('MerkleDistributor')
    distributor = await Distributor.deploy(root, token.address, 0, time.daysToSeconds(5))
    await distributor.deployed()

    await token.transfer(distributor.address, airdropData.reduce((x, y) => { return x.add(y.amount) }, BigNumber.from(0)))
  })

  it('should claim successfully for valid proof', async function () {
    const leaf = elements[0]
    const proof = merkleTree.getHexProof(leaf)

    await expect(distributor.claim(airdropData[0].account, airdropData[0].amount, proof))
      .to.emit(distributor, 'Claimed')
      .withArgs(airdropData[0].account, airdropData[0].amount)
  })

  it('should throw for invalid amount or address', async function () {
    // incorrect amount
    const leaf = elements[0]
    const proof = merkleTree.getHexProof(leaf)
    await expect(
      distributor.claim(airdropData[0].account, '2000000000000000000', proof)
    ).to.be.revertedWith('Invalid proof')

    // random address
    await expect(
      distributor.claim(
        '0x827c1d9292f767f0e7a14965512d9e3020a1dbaf',
        airdropData[0].amount,
        proof
      )
    ).to.be.revertedWith('Invalid proof')
  })

  it('should throw for invalid proof', async function () {
    await expect(
      distributor.claim(airdropData[0].account, airdropData[0].amount, [])
    ).to.be.revertedWith('Invalid proof')
  })

  it('should throw for double claim', async function () {
    const leaf = elements[0]
    const proof = merkleTree.getHexProof(leaf)

    await expect(distributor.claim(airdropData[0].account, airdropData[0].amount, proof))
      .to.emit(distributor, 'Claimed')
      .withArgs(airdropData[0].account, airdropData[0].amount)

    await expect(distributor.claim(airdropData[0].account, airdropData[0].amount, proof))
      .to.be.revertedWith('Already claimed')
  })
})
