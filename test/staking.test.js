const { expect } = require("chai")
const { ethers } = require("hardhat")
const { setupGovernanceToken, setupStakingContract } = require("../scripts/setupContracts")
const { toTokens, fromTokens, increaseTime, hasEmittedEvent } = require("./utils/testHelpers")
const {exp} = require("mathjs")

let colonyGovernanceToken
let colonyStaking
let owner, addr1, addr2, publicSaleWallet, privateSaleWallet, vestingContract
let defaultAuthPeriod

const stake = async (who, stakeAmount) => {
  const tokensAmount = toTokens(stakeAmount)

  // require allowance on token
  await colonyGovernanceToken.connect(who)
    .approve(colonyStaking.address, tokensAmount)

  await colonyStaking.connect(who).stake(tokensAmount)
}

const stakeFor = async (sender, receiver, stakeAmount) => {
  const tokensAmount = toTokens(stakeAmount)

  // require allowance on token
  await colonyGovernanceToken.connect(sender)
    .approve(colonyStaking.address, tokensAmount)

  await colonyStaking.connect(sender).stakeFor(receiver.address, tokensAmount)
}

const unstake = async (who, unstakeAmount) => {
    await colonyStaking.connect(who).unstake(toTokens(unstakeAmount))
}

describe("Colony Staking", function () {
  const stakeAmount = 34560
  const minStake = 50
  const initAmount = 1000000

  beforeEach(async() => {
    [owner, addr1, addr2, publicSaleWallet, privateSaleWallet, vestingContract] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
    decimals = await colonyGovernanceToken.decimals()

    await colonyGovernanceToken.initialMint(
        [publicSaleWallet.address, privateSaleWallet.address],
        [toTokens('5000000', decimals), toTokens('50000000', decimals)]
    );

    // transfer initial token amount to test address
    await colonyGovernanceToken.connect(publicSaleWallet).transfer(addr1.address, toTokens(initAmount))

    colonyStaking = await setupStakingContract(colonyGovernanceToken.address, toTokens('50', decimals), 20*24*60*60)
    defaultAuthPeriod = parseInt((await colonyStaking.authorizedStakePeriod()).toString())
  })

  it("Stake 0", async function () {
    await expect(colonyStaking.connect(addr1).stake(0)).to.be.revertedWith("Staking: cannot stake 0")
  })

  it("Stake - to small", async function () {
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, 10)
    await expect(colonyStaking.connect(addr1).stake(10)) .to.be.revertedWith("Staking: stake too small")
  })

  it("Stake - small after reach min", async function () {
    const minAmount = await colonyStaking.authorizedStakeAmount()

    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, minAmount)
    await colonyStaking.connect(addr1).stake(minAmount)


    // after reaching min amount, adding by any value should be allowed
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, 1)
    await colonyStaking.connect(addr1).stake(1)
  })

  it("Stake missing allowance", async function () {
    await expect(colonyStaking.connect(addr1).stake(stakeAmount))
      .to.be.revertedWith("ERC20: transfer amount exceeds allowance")
  })

  it("Stake", async function () {
    await stake(addr1, stakeAmount)

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(stakeAmount))

    // check if amount was extracted in governanceToken
    const expectedBalance = toTokens(initAmount - stakeAmount)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it("Total Stake", async function () {
    await stake(addr1, stakeAmount)
    await stake(publicSaleWallet, 2*stakeAmount)
    await stake(privateSaleWallet, 7*stakeAmount)

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(stakeAmount))
    expect(await colonyStaking.stakeBalanceOf(publicSaleWallet.address)).to.equal(toTokens(2*stakeAmount))
    expect(await colonyStaking.stakeBalanceOf(privateSaleWallet.address)).to.equal(toTokens(7*stakeAmount))

    expect(await colonyStaking.totalStaked()).to.equal(toTokens(10*stakeAmount))
  })

  it("Unstake 0", async function () {
    await expect(colonyStaking.connect(addr1).unstake(0)).to.be.revertedWith("Staking: cannot unstake 0")
  })

  it("Unstake exceeds", async function () {
    await stake(addr1, stakeAmount)
    await stake(addr1, stakeAmount)

    await expect(colonyStaking.connect(addr1).unstake(toTokens(2*stakeAmount + 1)))
      .to.be.revertedWith("Unstake: amount exceeds balance")
  })

  it("Unstake all", async function () {
    await stake(addr1, stakeAmount)

    const staked = await colonyStaking.stakeBalanceOf(addr1.address)
    await colonyStaking.connect(addr1).unstake(staked)

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(0)

    // check if amount was returned to governanceToken
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it("Stake again after unstake all", async function () {
    await stake(addr1, stakeAmount)

    const staked = await colonyStaking.stakeBalanceOf(addr1.address)
    await colonyStaking.connect(addr1).unstake(staked)

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(0)

    await stake(addr1, stakeAmount) // stake again after unstake all
    await stake(addr1, stakeAmount)
    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(2*stakeAmount))
  })

  it("Unstake partial", async function () {
    const stakeAmount2 = 1000
    await stake(addr1, stakeAmount)

    await unstake(addr1, stakeAmount2)

    const expectedStake = stakeAmount - stakeAmount2
    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(expectedStake))

    // check if amount was returned to governanceToken correctly
    const expectedBalance = toTokens(initAmount - expectedStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it("StakeFor", async function () {
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, toTokens(minStake))
    await colonyStaking.connect(addr1).stakeFor(addr2.address, toTokens(minStake))

    expect(await colonyStaking.stakeBalanceOf(addr2.address)).to.equal(toTokens(minStake))

    // check if amount was extracted in governanceToken
    const expectedBalance = toTokens(initAmount - minStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)

    // check if receiver can unstake
    await unstake(addr2, minStake)
    expect(await colonyGovernanceToken.balanceOf(addr2.address)).to.equal(toTokens(minStake))
  })

  it("Multiple stake / unstake", async function () {
    const stake1 = minStake
    const stake2 = 60
    const stake3 = 1000
    const stake4 = 10

    const unstake1 = 30
    const unstake2 = 100
    const unstake3 = 500
    const unstake4 = 10

    await stake(addr1, stake1)
    await stake(addr1, stake2)
    await unstake(addr1, unstake1)
    await stake(addr1, stake3)
    await unstake(addr1, unstake2)
    await unstake(addr1, unstake3)
    await stake(addr1, stake4)
    await unstake(addr1, unstake4)

    const expectedFinalStake = (stake1 + stake2 + stake3 + stake4 - unstake1 - unstake2 - unstake3 - unstake4)
    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(expectedFinalStake))

    // check if amount was returned to governanceToken correctly
    const expectedBalance = toTokens(initAmount - expectedFinalStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it("Multiple stake / unstake 2", async function () {
    const rounds = 5

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
      await unstake(addr1, 10)
    }

    await unstake(addr1, rounds * (minStake - 10))

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(0)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it("Unstake partial - gas limit", async function () {
    const rounds = 20
    let totalStaked = 0

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
      totalStaked += minStake
    }

    // stake is stored on array so it is good to check if it exceeds resonable gas limit
    const options = { gasLimit: 450000 }
    await colonyStaking.connect(addr1).unstake(toTokens(totalStaked/2), options)

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(totalStaked/2))
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount - totalStaked/2))
  })

  it("Unstake all - gas limit", async function () {
    const rounds = 40

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // unstake all it's a bit more optimal than partial (but still require to check balance, which could be heavy)
    const options = { gasLimit: 450000 }
    await colonyStaking.connect(addr1).unstake(toTokens(rounds*minStake))

    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(0)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it("Initial Authorized", async function () {
    // auth stake 50CLY
    expect(await colonyStaking.authorizedStakeAmount()).to.be.equal(toTokens(minStake))

    // auth period 20 days * 86400 seconds in a day
    expect(await colonyStaking.authorizedStakePeriod()).to.be.equal(20 * 86400)
  })

  it("Authorized Stake", async function () {
    await stake(addr1, minStake)
    expect(await colonyStaking.authStakeBalanceOf(addr1.address)).to.be.equal(0) // 0 - needs to wait authPeriod

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.authStakeBalanceOf(addr1.address)).to.be.equal(toTokens(minStake))

    await stake(addr1, minStake)
    await stake(addr1, minStake)
    expect(await colonyStaking.authStakeBalanceOf(addr1.address)).to.be.equal(toTokens(minStake))

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.authStakeBalanceOf(addr1.address)).to.be.equal(toTokens(3*minStake))
  })

  it("Change Authorized Values", async function () {
    await expect(colonyStaking.connect(addr1).setAuthorizedStakeAmount(toTokens(60)))
      .to.be.revertedWith("Ownable: caller is not the owner")

    await expect(colonyStaking.connect(publicSaleWallet).setAuthorizedStakePeriod(30))
      .to.be.revertedWith("Ownable: caller is not the owner")

    await colonyStaking.connect(owner).setAuthorizedStakeAmount(toTokens(60))
    await colonyStaking.connect(owner).setAuthorizedStakePeriod(25)

    expect(await colonyStaking.authorizedStakeAmount()).to.be.equal(toTokens(60))
    expect(await colonyStaking.authorizedStakePeriod()).to.be.equal(25)
  })

  it("Featured Account", async function () {
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false)

    await stake(addr1, minStake)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false)

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)
  })

  it("Featured Account - LIFO", async function () {
    await stake(addr1, minStake)

    await increaseTime(defaultAuthPeriod)
    await stake(addr1, 3*minStake) // new stake

    await unstake(addr1, minStake) // should decrease new stake and still be featured
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)
    expect(await colonyStaking.stakeBalanceOf(addr1.address)).to.equal(toTokens(3*minStake))
  })

  it("Featured Account - Change Auth Values", async function () {
    await stake(addr1, minStake)
    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)

    await colonyStaking.connect(owner).setAuthorizedStakeAmount(toTokens(60))
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false) // missing stake

    await stake(addr1, 10) // stake difference
    await increaseTime(defaultAuthPeriod)

    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)

    const tenDays = 100 * 86400
    await colonyStaking.connect(owner).setAuthorizedStakePeriod(defaultAuthPeriod + tenDays)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false)

    await increaseTime(defaultAuthPeriod + tenDays)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)
  })

  it("Check Pausable", async function () {
    await stake(addr1, minStake)

    expect(await colonyStaking.paused()).to.be.equal(false)
    await colonyStaking.connect(owner).pauseStaking()
    await expect(colonyStaking.connect(owner).pauseStaking()).to.be.revertedWith("Pausable: paused")

    await expect(stake(addr1, minStake)).to.be.revertedWith("Pausable: paused")
    await expect(stakeFor(addr1, addr2, minStake)).to.be.revertedWith("Pausable: paused")
    await expect(unstake(addr1, minStake)).to.be.revertedWith("Pausable: paused")

    await colonyStaking.connect(owner).unpauseStaking()
    await expect(colonyStaking.connect(owner).unpauseStaking()).to.be.revertedWith("Pausable: not paused")

    await stake(addr1, minStake) // ok
    await stakeFor(addr1, addr2, minStake) // ok
    await unstake(addr1, minStake) // ok
  })
})
