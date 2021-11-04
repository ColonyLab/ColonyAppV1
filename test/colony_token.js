const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Colony Token Base", function () {
  it("Token basic properties", async function () {
    const [owner] = await ethers.getSigners()

    const Colony = await ethers.getContractFactory("Colony")
    const colony = await Colony.deploy()
    await colony.deployed()

    expect(await colony.name()).to.equal("Colony")
    expect(await colony.symbol()).to.equal("CLY")


    const expectedSupply = 150 * 1000000
    const decimals = await colony.decimals()
    const totalSupply = await colony.totalSupply()

    const expectedSupplyStr = expectedSupply.toString() + '0'.repeat(decimals)

    expect(decimals).to.equal(18)
    expect(totalSupply).to.equal(expectedSupplyStr)
    expect(totalSupply).to.equal(await colony.balanceOf(owner.address))
  });

  it("Token simple transfer", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    const Colony = await ethers.getContractFactory("Colony")
    const colony = await Colony.deploy()
    await colony.deployed()

    const amount = "12345"
    const tx = await colony.connect(owner).transfer(addr1.address, amount)
    await tx.wait()
    expect(await colony.balanceOf(addr1.address)).to.equal(amount)

    await colony.connect(addr1).transfer(addr2.address, amount)
    expect(await colony.balanceOf(addr2.address)).to.equal(amount)

    await expect(colony.connect(addr1).transfer(addr2.address, amount))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance'")
  });
});
