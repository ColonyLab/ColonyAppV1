const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupGovernanceToken } = require("../scripts/setupContracts");
const { toTokens, getEventsFromTransaction, hasEmittedEvent } = require("./utils/testHelpers")

let colonyGovernanceToken;
let owner, addr1, addr2, publicSaleWallet, privateSaleWallet, vestingContract;

describe("Colony Token Base", function () {

  before(async() => {
    [owner, addr1, addr2, publicSaleWallet, privateSaleWallet, vestingContract] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
  })

  it("Governance Token basic properties", async function () {
    expect(await colonyGovernanceToken.name()).to.equal("Colony Token")
    expect(await colonyGovernanceToken.symbol()).to.equal("CLY")

    const decimals = await colonyGovernanceToken.decimals()
    const totalSupply = await colonyGovernanceToken.totalSupply()

    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal('0')
  })

  it("Governance Token initial minting", async function () {
    const tx = colonyGovernanceToken.initialMint(publicSaleWallet.address, privateSaleWallet.address, vestingContract.address);
    await hasEmittedEvent(tx, 'ColonyTokenMinted', []);

    const expectedSupply = '150000000';
    const decimals = await colonyGovernanceToken.decimals()
    const publicSaleWalletBalance = toTokens('10500000', decimals)
    const privateSaleWalletBalance = toTokens('7800000', decimals)
    const vestingContractBalance = toTokens('131700000', decimals)
    const totalSupply = await colonyGovernanceToken.totalSupply()
    const expectedSupplyStr = toTokens(expectedSupply, decimals)

    expect(await colonyGovernanceToken.balanceOf(publicSaleWallet.address)).to.equal(publicSaleWalletBalance);
    expect(await colonyGovernanceToken.balanceOf(privateSaleWallet.address)).to.equal(privateSaleWalletBalance);
    expect(await colonyGovernanceToken.balanceOf(vestingContract.address)).to.equal(vestingContractBalance);

    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal(expectedSupplyStr)
  })

  it("Prevents another token generation.", async function () {
     await expect(
         colonyGovernanceToken.initialMint(publicSaleWallet.address, privateSaleWallet.address, vestingContract.address)
     ).to.be.revertedWith('Tokens have already been minted!');
  })

})
