import { ethers } from 'hardhat'
import { Contract } from '@ethersproject/contracts'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { setupGovernanceToken } from '../scripts/setupContracts'
import { hasEmittedEvent, toTokens } from './utils/testHelpers'

let colonyGovernanceToken: Contract
let publicSaleWallet: SignerWithAddress, privateSaleWallet: SignerWithAddress, seedWallet: SignerWithAddress,
  providingLiquidityWallet: SignerWithAddress, vestingContract: SignerWithAddress
let decimals: number

describe('Colony Token Base', function (): void {
  before(async function (): Promise<void> {
    [publicSaleWallet, privateSaleWallet, vestingContract, seedWallet, providingLiquidityWallet] = (await ethers.getSigners()).slice(1)
    colonyGovernanceToken = await setupGovernanceToken()
  })

  it('Governance Token basic properties', async function (): Promise<void> {
    expect(await colonyGovernanceToken.name()).to.equal('Colony Token')
    expect(await colonyGovernanceToken.symbol()).to.equal('CLY')

    decimals = await colonyGovernanceToken.decimals()
    const totalSupply = await colonyGovernanceToken.totalSupply()

    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal('0')
  })

  it('Governance Token initial minting', async function (): Promise<void> {
    const tx = colonyGovernanceToken.initialMint(
      [publicSaleWallet.address, privateSaleWallet.address, vestingContract.address, seedWallet.address, providingLiquidityWallet.address],
      [toTokens('10500000', decimals), toTokens('7800000', decimals), toTokens('131700000', decimals), 0, 0]
    )
    await hasEmittedEvent(tx, 'ColonyTokenMinted', [])

    const expectedSupply = '150000000'
    const publicSaleWalletBalance = toTokens('10500000', decimals)
    const privateSaleWalletBalance = toTokens('7800000', decimals)
    const vestingContractBalance = toTokens('131700000', decimals)
    const totalSupply = await colonyGovernanceToken.totalSupply()
    const expectedSupplyStr = toTokens(expectedSupply, decimals)

    expect(await colonyGovernanceToken.balanceOf(publicSaleWallet.address)).to.equal(publicSaleWalletBalance)
    expect(await colonyGovernanceToken.balanceOf(privateSaleWallet.address)).to.equal(privateSaleWalletBalance)
    expect(await colonyGovernanceToken.balanceOf(vestingContract.address)).to.equal(vestingContractBalance)

    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal(expectedSupplyStr)
  })

  it('Prevents another token generation.', async function (): Promise<void> {
    await expect(
      colonyGovernanceToken.initialMint(
        [publicSaleWallet.address, privateSaleWallet.address, vestingContract.address, seedWallet.address, providingLiquidityWallet.address],
        [toTokens('10500000', decimals), toTokens('7800000', decimals), toTokens('131700000', decimals), 0, 0]
      )
    ).to.be.revertedWith('Tokens have already been minted!')
  })
})
