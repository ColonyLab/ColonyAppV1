const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const { ethers } = require('hardhat')
const { setupGovernanceToken, setupStakingContract } = require('../scripts/setupContracts')
const { toTokens, increaseTime } = require('./utils/testHelpers')

let colonyGovernanceToken
let colonyStaking
let owner, addr1, addr2, publicSaleWallet, privateSaleWallet
let defaultAuthPeriod
let decimals

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

// additional check if both mappings are in sync
const stakedBalanceOf = async (who) => {
  const stake1 = await colonyStaking.stakedBalanceOf(who.address)
  const stake2 = await colonyStaking.recalculatedBalanceOf(who.address)

  if (!stake1.eq(stake2)) {
    throw Error('colonyStaking and stakeDeposits are not in sync!')
  }

  return stake1
}

describe('Colony Staking', function () {
  const stakeAmount = 34560
  const minStake = 50
  const initAmount = 1000000
  const defaultStakesLimit = 100

  beforeEach(async function () {
    [owner, addr1, addr2, publicSaleWallet, privateSaleWallet] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
    decimals = await colonyGovernanceToken.decimals()

    await colonyGovernanceToken.initialMint(
      [publicSaleWallet.address, privateSaleWallet.address],
      [toTokens('5000000', decimals), toTokens('50000000', decimals)]
    )

    // transfer initial token amount to test address
    await colonyGovernanceToken.connect(publicSaleWallet).transfer(addr1.address, toTokens(initAmount))

    // 20 days
    colonyStaking = await setupStakingContract(colonyGovernanceToken.address, toTokens('50', decimals), 20 * 24 * 3600)
    defaultAuthPeriod = parseInt((await colonyStaking.authorizedStakePeriod()).toString())
  })

  it('Stake 0', async function () {
    await expect(colonyStaking.connect(addr1).stake(0)).to.be.revertedWith('Staking: cannot stake 0')
  })

  it('Stake - to small', async function () {
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, 10)
    await expect(colonyStaking.connect(addr1).stake(10)).to.be.revertedWith('Staking: stake too small')
  })

  it('Stake - small after reach min', async function () {
    const minAmount = await colonyStaking.authorizedStakeAmount()

    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, minAmount)
    await colonyStaking.connect(addr1).stake(minAmount)

    // after reaching min amount, adding by any value should be allowed
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, 1)
    await colonyStaking.connect(addr1).stake(1)
  })

  it('Stake missing allowance', async function () {
    await expect(colonyStaking.connect(addr1).stake(stakeAmount))
      .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
  })

  it('Stake', async function () {
    await stake(addr1, stakeAmount)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(stakeAmount))

    // check if amount was extracted in governanceToken
    const expectedBalance = toTokens(initAmount - stakeAmount)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it('Total Stake', async function () {
    await stake(addr1, stakeAmount)
    await stake(publicSaleWallet, 2 * stakeAmount)
    await stake(privateSaleWallet, 7 * stakeAmount)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(stakeAmount))
    expect(await stakedBalanceOf(publicSaleWallet)).to.equal(toTokens(2 * stakeAmount))
    expect(await stakedBalanceOf(privateSaleWallet)).to.equal(toTokens(7 * stakeAmount))

    expect(await colonyStaking.totalStaked()).to.equal(toTokens(10 * stakeAmount))
  })

  it('Unstake 0', async function () {
    await expect(colonyStaking.connect(addr1).unstake(0)).to.be.revertedWith('Staking: cannot unstake 0')
  })

  it('Unstake exceeds', async function () {
    await stake(addr1, stakeAmount)
    await stake(addr1, stakeAmount)

    await expect(colonyStaking.connect(addr1).unstake(toTokens(2 * stakeAmount + 1)))
      .to.be.revertedWith('Staking: amount exceeds balance')
  })

  it('Unstake all', async function () {
    await stake(addr1, stakeAmount)

    const staked = await stakedBalanceOf(addr1)
    await colonyStaking.connect(addr1).unstake(staked)

    expect(await stakedBalanceOf(addr1)).to.equal(0)

    // check if amount was returned to governanceToken
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it('Stake again after unstake all', async function () {
    await stake(addr1, stakeAmount)

    const staked = await stakedBalanceOf(addr1)
    await colonyStaking.connect(addr1).unstake(staked)

    expect(await stakedBalanceOf(addr1)).to.equal(0)

    await stake(addr1, stakeAmount) // stake again after unstake all
    await stake(addr1, stakeAmount)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(2 * stakeAmount))
  })

  it('Unstake partial', async function () {
    const stakeAmount2 = 1000
    await stake(addr1, stakeAmount)

    await unstake(addr1, stakeAmount2)

    const expectedStake = stakeAmount - stakeAmount2
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(expectedStake))

    // check if amount was returned to governanceToken correctly
    const expectedBalance = toTokens(initAmount - expectedStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it('StakeFor', async function () {
    await colonyGovernanceToken.connect(addr1).approve(colonyStaking.address, toTokens(minStake))
    await colonyStaking.connect(addr1).stakeFor(addr2.address, toTokens(minStake))

    expect(await stakedBalanceOf(addr2)).to.equal(toTokens(minStake))

    // check if amount was extracted in governanceToken
    const expectedBalance = toTokens(initAmount - minStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)

    // check if receiver can unstake
    await unstake(addr2, minStake)
    expect(await colonyGovernanceToken.balanceOf(addr2.address)).to.equal(toTokens(minStake))
  })

  it('Multiple stake / unstake', async function () {
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
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(expectedFinalStake))

    // check if amount was returned to governanceToken correctly
    const expectedBalance = toTokens(initAmount - expectedFinalStake)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(expectedBalance)
  })

  it('Multiple stake / unstake 2', async function () {
    const rounds = 5

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
      await unstake(addr1, 10)
    }

    await unstake(addr1, rounds * (minStake - 10))

    expect(await stakedBalanceOf(addr1)).to.equal(0)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it('Multiple stake / unstake 3', async function () {
    await colonyStaking.connect(owner).setMaxNumOfStakes(4)

    const rounds = 5

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // unstake all
    await unstake(addr1, rounds * minStake)

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, 2 * minStake)
    }

    // unstake half
    await unstake(addr1, rounds * minStake)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(rounds * minStake))
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount - rounds * minStake))

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, 3 * minStake)
    }

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(4 * rounds * minStake))
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount - 4 * rounds * minStake))
  })

  it('Unstake partial - gas limit', async function () {
    const rounds = 30
    let totalStaked = 0

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
      totalStaked += minStake
    }

    // stake is stored on array so it is good to check if it exceeds resonable gas limit
    const options = { gasLimit: 150000 }
    await colonyStaking.connect(addr1).unstake(toTokens(totalStaked / 2), options)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(totalStaked / 2))
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount - totalStaked / 2))
  })

  it('Unstake all - gas limit', async function () {
    const rounds = 80

    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // cost of unstake all is optimized and do not depend on stake num
    const options = { gasLimit: 80000 }
    await colonyStaking.connect(addr1).unstake(toTokens(rounds * minStake), options)

    expect(await stakedBalanceOf(addr1)).to.equal(0)
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens(initAmount))
  })

  it('Initial Authorized', async function () {
    // auth stake 50CLY
    expect(await colonyStaking.authorizedStakeAmount()).to.be.equal(toTokens(minStake))

    // auth period 20 days * 86400 seconds in a day
    expect(await colonyStaking.authorizedStakePeriod()).to.be.equal(20 * 86400)
  })

  it('Authorized Stake', async function () {
    await stake(addr1, minStake)
    expect(await colonyStaking.authStakedBalanceOf(addr1.address)).to.be.equal(0) // 0 - needs to wait authPeriod

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.authStakedBalanceOf(addr1.address)).to.be.equal(toTokens(minStake))

    await stake(addr1, minStake)
    await stake(addr1, minStake)
    expect(await colonyStaking.authStakedBalanceOf(addr1.address)).to.be.equal(toTokens(minStake))

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.authStakedBalanceOf(addr1.address)).to.be.equal(toTokens(3 * minStake))
  })

  it('Change Authorized Values', async function () {
    await expect(colonyStaking.connect(addr1).setAuthorizedStakeAmount(toTokens(60)))
      .to.be.revertedWith('Ownable: caller is not the owner')

    await expect(colonyStaking.connect(publicSaleWallet).setAuthorizedStakePeriod(30))
      .to.be.revertedWith('Ownable: caller is not the owner')

    await colonyStaking.connect(owner).setAuthorizedStakeAmount(toTokens(60))
    await colonyStaking.connect(owner).setAuthorizedStakePeriod(25)

    expect(await colonyStaking.authorizedStakeAmount()).to.be.equal(toTokens(60))
    expect(await colonyStaking.authorizedStakePeriod()).to.be.equal(25)
  })

  it('Featured Account', async function () {
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false)

    await stake(addr1, minStake)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(false)

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)
  })

  it('Featured Account - LIFO', async function () {
    await stake(addr1, minStake)

    await increaseTime(defaultAuthPeriod)
    await stake(addr1, 3 * minStake) // new stake

    await unstake(addr1, minStake) // should decrease new stake and still be featured
    expect(await colonyStaking.isAccountAuthorized(addr1.address)).to.be.equal(true)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(3 * minStake))
  })

  it('Featured Account - Change Auth Values', async function () {
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

  it('Check Pausable', async function () {
    await stake(addr1, minStake)

    expect(await colonyStaking.paused()).to.be.equal(false)
    await colonyStaking.connect(owner).pauseStaking()
    await expect(colonyStaking.connect(owner).pauseStaking()).to.be.revertedWith('Pausable: paused')

    await expect(stake(addr1, minStake)).to.be.revertedWith('Pausable: paused')
    await expect(stakeFor(addr1, addr2, minStake)).to.be.revertedWith('Pausable: paused')
    await expect(unstake(addr1, minStake)).to.be.revertedWith('Pausable: paused')

    await colonyStaking.connect(owner).unpauseStaking()
    await expect(colonyStaking.connect(owner).unpauseStaking()).to.be.revertedWith('Pausable: not paused')

    await stake(addr1, minStake) // ok
    await stakeFor(addr1, addr2, minStake) // ok
    await unstake(addr1, minStake) // ok
  })

  it('MaxStakes: Change max number of stakes', async function () {
    expect(await colonyStaking.connect(owner).getMaxNumOfStakes()).to.be.equal(100)
    await colonyStaking.connect(owner).setMaxNumOfStakes(4)

    expect(await colonyStaking.connect(owner).getMaxNumOfStakes()).to.be.equal(4)
    expect(colonyStaking.connect(owner).setMaxNumOfStakes(0)).to.be.revertedWith('should have at least one value')
  })

  it('MaxStakes: realLen == [].len AND realLen < max_stakes', async function () {
    const rounds = 3
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(rounds)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(rounds)
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(defaultStakesLimit)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(rounds * minStake))
  })

  it('MaxStakes: realLen == [].len AND realLen == max_stakes', async function () {
    const stakesLimit = 3
    await colonyStaking.connect(owner).setMaxNumOfStakes(stakesLimit)
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(stakesLimit)

    const rounds = 5
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(stakesLimit)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(stakesLimit)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(rounds * minStake))

    // add 1 stake more
    await stake(addr1, minStake)
    // length didn't changed
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(stakesLimit)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(stakesLimit)
    // balance +1 stake
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens((rounds + 1) * minStake))
  })

  it('MaxStakes: realLen == [].len AND realLen > max_stakes', async function () {
    const rounds = 5
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    const stakesLimit = 3
    await colonyStaking.connect(owner).setMaxNumOfStakes(stakesLimit)
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(stakesLimit)

    // stakesLimit is 3 now, but addr1 already had 5 stakes
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(rounds)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(rounds)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(rounds * minStake))

    // add another 6'th stake
    await stake(addr1, minStake)

    // still 5 stakes
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(rounds)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(rounds)
    // but balance is equal to 6 * stakes
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens((rounds + 1) * minStake))
  })

  it('MaxStakes: realLen != [].len AND realLen < max_stakes', async function () {
    // default stakes limit
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(defaultStakesLimit)

    const rounds = 5
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // unstake 2 values, makes realLen != allocated
    await unstake(addr1, 2 * minStake)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens((rounds - 2) * minStake))

    // add one stake more
    await stake(addr1, minStake)
    const expectedStakesNum = rounds - 2 + 1

    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(expectedStakesNum)
    // allocated is different
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(rounds)

    expect(await stakedBalanceOf(addr1)).to.equal(toTokens((rounds - 2 + 1) * minStake))
  })

  it('MaxStakes: realLen != [].len AND realLen == max_stakes', async function () {
    const rounds = 5
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // unstake 2 values, makes realLen != allocated
    await unstake(addr1, 2 * minStake)

    const stakesLimit = 4
    await colonyStaking.connect(owner).setMaxNumOfStakes(stakesLimit)
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(stakesLimit)

    // add 2 stakes more
    await stake(addr1, minStake)
    await stake(addr1, minStake)

    // stakesLimit
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(stakesLimit)
    expect(await colonyStaking.connect(addr1).getAccountAllocDepositLength(addr1.address)).to.equal(rounds)

    // rounds - 2 + 2
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(rounds * minStake))
  })

  it('MaxStakes: realLen != [].len AND realLen > max_stakes', async function () {
    const rounds = 7
    for (let i = 0; i < rounds; i++) {
      await stake(addr1, minStake)
    }

    // unstake 2 values, makes realLen != allocated
    await unstake(addr1, 2 * minStake)
    let expectedBalance = (rounds - 2) * minStake

    const stakesLimit = 2 // limit(2) < realLen(5)
    await colonyStaking.connect(owner).setMaxNumOfStakes(stakesLimit)
    expect(await colonyStaking.getMaxNumOfStakes()).to.equal(stakesLimit)

    // add 1 take more (array length should remain 5)
    await stake(addr1, minStake)
    expectedBalance = expectedBalance + minStake

    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(rounds - 2)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(expectedBalance))

    // unstake 1 value (2 stakes in one arr element)
    await unstake(addr1, 2 * minStake)
    // and stake 2 more
    await stake(addr1, minStake)
    await stake(addr1, minStake)

    // len decreased by one
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(rounds - 3)
    // but balance remain the same
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(expectedBalance))

    // unstake all
    await unstake(addr1, expectedBalance)
    expect(await stakedBalanceOf(addr1)).to.equal(0)
    // and add 4 stakes
    await stake(addr1, minStake)
    await stake(addr1, minStake)
    await stake(addr1, minStake)
    await stake(addr1, minStake)
    expectedBalance = 4 * minStake

    // hits and stay with stakesLimit
    expect(await colonyStaking.connect(addr1).getAccountRealDepositLength(addr1.address)).to.equal(stakesLimit)
    expect(await stakedBalanceOf(addr1)).to.equal(toTokens(expectedBalance))
  })

  it('timeRemainingAuthorization - not authorized', async function () {
    expect(await colonyStaking.timeRemainingAuthorization(addr1.address)).to.eql([false, BigNumber.from(0)])
  })

  it('timeRemainingAuthorization - authorized', async function () {
    const epsilon = 20

    await stake(addr1, minStake)
    const remainTuple = await colonyStaking.timeRemainingAuthorization(addr1.address)
    expect(remainTuple[0]).to.equal(true)
    expect(remainTuple[1]).to.be.above(defaultAuthPeriod - epsilon).and.to.be.below(defaultAuthPeriod + epsilon)

    await increaseTime(defaultAuthPeriod)
    expect(await colonyStaking.timeRemainingAuthorization(addr1.address)).to.eql([true, BigNumber.from(0)])
  })

  it('timeRemainingAuthorization - change auth values', async function () {
    const epsilon = 20

    await stake(addr1, minStake)
    await increaseTime(defaultAuthPeriod)

    const periodIncrease = 100000
    await colonyStaking.connect(owner).setAuthorizedStakePeriod(defaultAuthPeriod + 100000)

    const remainTuple = await colonyStaking.timeRemainingAuthorization(addr1.address)
    expect(remainTuple[0]).to.equal(true)
    // defaultAuthPeriod already pass
    expect(remainTuple[1]).to.be.above(periodIncrease - epsilon).and.to.be.below(periodIncrease + epsilon)

    await colonyStaking.connect(owner).setAuthorizedStakeAmount(toTokens(2 * minStake))
    expect(await colonyStaking.timeRemainingAuthorization(addr1.address)).to.eql([false, BigNumber.from(0)])
  })

  it('timeRemainingAuthorization - multiple stakes', async function () {
    const epsilon = 20

    const rounds = 10
    for (let i = 0; i < 10; i++) {
      await increaseTime(defaultAuthPeriod / rounds) // 1/10 of auth period
      await stake(addr1, minStake)
    }

    // decrease period
    const halfOfthePeriod = defaultAuthPeriod / 2
    await colonyStaking.connect(owner).setAuthorizedStakePeriod(halfOfthePeriod)
    // increase auth amount to all stakes
    await colonyStaking.connect(owner).setAuthorizedStakeAmount(toTokens(minStake * rounds))

    const remainTuple = await colonyStaking.timeRemainingAuthorization(addr1.address)
    expect(remainTuple[0]).to.equal(true)
    // defaultAuthPeriod already pass
    expect(remainTuple[1]).to.be.above(halfOfthePeriod - epsilon).and.to.be.below(halfOfthePeriod + epsilon)
  })
})
