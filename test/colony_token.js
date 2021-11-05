const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupGovernanceToken } = require("../scripts/setupContracts");
const { toTokens } = require("./utils/testHelpers")
const {exp} = require("mathjs");

let colonyGovernanceToken;
let owner, addr1, addr2;

describe("Colony Token Base", function () {

  before(async() => {
    [owner, addr1, addr2] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
  })

  it("Token basic properties", async function () {
    expect(await colonyGovernanceToken.name()).to.equal("Colony")
    expect(await colonyGovernanceToken.symbol()).to.equal("CLY")

    const expectedSupply = 150 * 1000000
    const decimals = await colonyGovernanceToken.decimals()
    const totalSupply = await colonyGovernanceToken.totalSupply()
    const expectedSupplyStr = toTokens(expectedSupply, decimals)


    expect(decimals).to.equal(18)
    expect(totalSupply.toString()).to.equal(expectedSupplyStr)
    expect(totalSupply).to.equal(await colonyGovernanceToken.balanceOf(owner.address))
  })

  it("Token simple transfer", async function () {
    const amount = "12345"
    const tx = await colonyGovernanceToken.connect(owner).transfer(addr1.address, amount)
    await tx.wait()
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(amount)

    await colonyGovernanceToken.connect(addr1).transfer(addr2.address, amount)
    expect(await colonyGovernanceToken.balanceOf(addr2.address)).to.equal(amount)

    await expect(colonyGovernanceToken.connect(addr1).transfer(addr2.address, amount))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance'")
  })

})
