import { ethers } from 'hardhat'
import { Contract } from '@ethersproject/contracts'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { setupAntToken } from '../scripts/setupContracts'
import { toTokens } from './utils/testHelpers'

let antToken: Contract
let owner: SignerWithAddress, privilegedMinter: SignerWithAddress, tokensReceiver: SignerWithAddress
let decimals: number

describe('ANT Token Base', function (): void {
  beforeEach(async function (): Promise<void> {
    [owner, privilegedMinter, tokensReceiver] = (await ethers.getSigners()).slice(1)
    antToken = await setupAntToken()
  })

  it('ANT Token basic properties', async function (): Promise<void> {
    expect(await antToken.name()).to.equal('ANT Token')
    expect(await antToken.symbol()).to.equal('ANT')

    decimals = await antToken.decimals()
    const totalSupply = await antToken.totalSupply()

    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal('0')
  })

  it('Not priviledged account', async function (): Promise<void> {
    const tokensAmount = toTokens(100)
    // not privileged to mint
    await expect(antToken.connect(privilegedMinter).mint(owner.address, tokensAmount)
    ).to.be.revertedWith('Caller is not privileged')

    // not privileged to burn
    await expect(antToken.connect(privilegedMinter).burn(owner.address, tokensAmount)
    ).to.be.revertedWith('Caller is not privileged')
  })

  it('Priviledged Token minting', async function (): Promise<void> {
    const tokensAmount = toTokens(50)

    await antToken.updatePrivileged(privilegedMinter.address, true)
    await antToken.connect(privilegedMinter).mint(tokensReceiver.address, tokensAmount)

    expect(await antToken.balanceOf(tokensReceiver.address)).to.equal(tokensAmount)

    const totalSupply = await antToken.totalSupply()
    expect(totalSupply.toString()).to.equal(tokensAmount)
  })

  it('Priviledged Token burning.', async function (): Promise<void> {
    const tokensAmount = toTokens(2000)

    await antToken.updatePrivileged(privilegedMinter.address, true)
    await antToken.connect(privilegedMinter).mint(tokensReceiver.address, tokensAmount)

    // burn
    await antToken.connect(privilegedMinter).burn(tokensReceiver.address, tokensAmount)

    expect(await antToken.balanceOf(tokensReceiver.address)).to.equal('0')

    const totalSupply = await antToken.totalSupply()
    expect(totalSupply.toString()).to.equal('0')

    // try to burn more
    await expect(antToken.connect(privilegedMinter).burn(owner.address, tokensAmount)
    ).to.be.revertedWith('ERC20: burn amount exceeds balance')
  })
})
