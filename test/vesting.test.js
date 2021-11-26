const { expect } = require('chai')
const { ethers } = require('hardhat')
const { setupGovernanceToken, setupVestingContract } = require('../scripts/setupContracts')
const { toTokens, hasEmittedEvent, increaseTime } = require('./utils/testHelpers')

let colonyGovernanceToken, vestingContract
let owner, mockAddress, addr1, addr2, addr3, addr4
let decimals

describe('Vesting Contract - main vesting process tests', function () {
  before(async function () {
    [owner, mockAddress, addr1, addr2, addr3, addr4] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
    vestingContract = await setupVestingContract(colonyGovernanceToken.address, 0, 0)
    await colonyGovernanceToken.initialMint(
      [mockAddress.address, vestingContract.address],
      [toTokens('200', decimals), toTokens('500', decimals)]
    )
    decimals = parseInt((await colonyGovernanceToken.decimals()).toString())
  })

  it('Disallow vesting start before conditions are met', async function () {
    const tx1 = vestingContract._startVesting(1214, owner.address)
    await expect(tx1).to.be.revertedWith("'Invalid vesting start!")

    const tx2 = vestingContract._startVesting(0, owner.address)
    await expect(tx2).to.be.revertedWith('No groups configured!')
  })

  it('Add a group with no distribution offset', async function () {
    const name = 'No starting offset group'
    const distributionAmount = toTokens('150', decimals)
    const distributionStartOffset = 0
    const distributionLength = 10000
    const groupId = 0
    const initialRelease = 0

    const tx = vestingContract._setGroup(
      name,
      distributionAmount,
      distributionStartOffset,
      distributionLength,
      initialRelease
    )
    await hasEmittedEvent(
      tx,
      'GroupDataSet',
      [
        groupId,
        name,
        distributionAmount,
        distributionStartOffset,
        distributionLength,
        initialRelease
      ]
    )

    const newGroup = await vestingContract.groupsConfiguration(0)
    expect(newGroup.name).to.equal(name)
    expect(newGroup.distributionAmount).to.equal(distributionAmount)
    expect(newGroup.distributionStartOffset).to.equal(distributionStartOffset)
    expect(newGroup.distributionLength).to.equal(distributionLength)
    expect(newGroup.initialRelease).to.equal(initialRelease)
  })

  it('Add a group with distribution offset', async function () {
    const name = 'Group with offset'
    const distributionAmount = toTokens('300', decimals)
    const distributionStartOffset = 1000
    const distributionLength = 20000
    const groupId = 1
    const initialRelease = 0

    const tx = vestingContract._setGroup(
      name,
      distributionAmount,
      distributionStartOffset,
      distributionLength,
      initialRelease
    )
    await hasEmittedEvent(
      tx,
      'GroupDataSet',
      [
        groupId,
        name,
        distributionAmount,
        distributionStartOffset,
        distributionLength,
        initialRelease
      ]
    )

    const newGroup = await vestingContract.groupsConfiguration(1)
    expect(newGroup.name).to.equal(name)
    expect(newGroup.distributionAmount).to.equal(distributionAmount)
    expect(newGroup.distributionStartOffset).to.equal(distributionStartOffset)
    expect(newGroup.distributionLength).to.equal(distributionLength)
    expect(newGroup.initialRelease).to.equal(initialRelease)
  })

  it('Add a group with Initial release', async function () {
    const name = 'Group with offset'
    const distributionAmount = toTokens('6', decimals)
    const distributionStartOffset = 0
    const distributionLength = 2000
    const groupId = 2
    const initialRelease = toTokens('0.1', decimals)

    const tx = vestingContract._setGroup(
      name,
      distributionAmount,
      distributionStartOffset,
      distributionLength,
      initialRelease
    )
    await hasEmittedEvent(
      tx,
      'GroupDataSet',
      [
        groupId,
        name,
        distributionAmount,
        distributionStartOffset,
        distributionLength,
        initialRelease
      ]
    )

    const newGroup = await vestingContract.groupsConfiguration(2)
    expect(newGroup.name).to.equal(name)
    expect(newGroup.distributionAmount).to.equal(distributionAmount)
    expect(newGroup.distributionStartOffset).to.equal(distributionStartOffset)
    expect(newGroup.distributionLength).to.equal(distributionLength)
    expect(newGroup.initialRelease).to.equal(initialRelease)
  })

  it('Prevents adding a group with distribution amount higher than contract balance', async function () {
    const name = 'Not a very nice group'
    const distributionAmount = toTokens('400', decimals)
    const distributionStartOffset = 1000
    const distributionLength = 20000
    const initialRelease = 0

    const tx = vestingContract._setGroup(
      name,
      distributionAmount,
      distributionStartOffset,
      distributionLength,
      initialRelease
    )
    await expect(tx).to.be.revertedWith('Distribution amount too big!')
  })

  it('Add user (addr1) to group without offset', async function () {
    const address = addr1.address
    const groupId = 0
    const vestAmount = toTokens('50', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    const group = await vestingContract.groupsConfiguration(groupId)
    expect(group.vestedAmount).to.equal(vestAmount)
  })

  it('Add user (addr2) to group with offset', async function () {
    const address = addr2.address
    const groupId = 1
    const vestAmount = toTokens('100', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    const group = await vestingContract.groupsConfiguration(groupId)
    expect(group.vestedAmount).to.equal(vestAmount)
  })

  it('Add user (addr3) to group with offset', async function () {
    const address = addr3.address
    const groupId = 1
    const vestAmount = toTokens('5', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    const group = await vestingContract.groupsConfiguration(groupId)
    expect(group.vestedAmount).to.equal(toTokens('105', decimals))
  })

  it('Add user (addr4) to group with initial release', async function () {
    const address = addr4.address
    const groupId = 2
    const vestAmount = toTokens('6', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    const group = await vestingContract.groupsConfiguration(groupId)
    expect(group.vestedAmount).to.equal(toTokens('6', decimals))
  })

  it('Should update user vesting amount (addr3) properly', async function () {
    const address = addr3.address
    const groupId = 1
    const vestAmount = toTokens('15', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    const group = await vestingContract.groupsConfiguration(groupId)
    expect(group.vestedAmount).to.equal(toTokens('115', decimals))
  })

  it('Should properly move user to another group (addr3)', async function () {
    const address = addr3.address
    const groupId = 0
    const vestAmount = toTokens('15', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await hasEmittedEvent(
      tx,
      'UserDataSet',
      [
        address,
        groupId,
        vestAmount
      ]
    )

    const user = await vestingContract.userConfiguration(address)
    expect(user.groupId).to.equal(groupId)
    expect(user.vestAmount).to.equal(vestAmount)
    expect(user.withdrawnAmount).to.equal('0')

    // check group vesting amount for new group
    const group0 = await vestingContract.groupsConfiguration(groupId)
    expect(group0.vestedAmount).to.equal(toTokens('65', decimals))
    // check group vesting amount for old group
    const group1 = await vestingContract.groupsConfiguration(1)
    expect(group1.vestedAmount).to.equal(toTokens('100', decimals))
  })

  it('Prevents adding user to a group with vesting amount higher than group distribution amount', async function () {
    const address = addr4.address
    const groupId = 0
    const vestAmount = toTokens('250', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await expect(tx).to.be.revertedWith('Vesting amount too high!')
  })

  it('Prevents adding user to a non-existent group', async function () {
    const address = addr4.address
    const groupId = 3
    const vestAmount = toTokens('250', decimals)

    const tx = vestingContract._setUser(
      address,
      groupId,
      vestAmount
    )
    await expect(tx).to.be.revertedWith('Invalid groupId!')
  })

  it('Start the vesting and check return wallet balance', async function () {
    const balanceBefore = await colonyGovernanceToken.balanceOf(owner.address)
    expect(balanceBefore).to.equal(0)

    await vestingContract._startVesting(0, owner.address)
    const balanceAfter = await colonyGovernanceToken.balanceOf(owner.address)

    expect(balanceAfter).to.equal(toTokens('329', decimals))
  })

  it('Non-existent user has a claim = 0', async function () {
    const availableClaim = await vestingContract.checkClaim(addr1.address)
    expect(availableClaim).to.equal(0)
  })

  it('Existing users should have claim = 0 when vesting starts', async function () {
    const addr1AvailableClaim = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim).to.equal(0)

    const addr2AvailableClaim = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim).to.equal(0)
  })

  it('Checks the initial claim (Addr4)', async function () {
    const addr4AvailableClaim = await vestingContract.checkClaim(addr4.address)
    expect(addr4AvailableClaim).to.equal(toTokens('0.6', decimals))
  })

  it('Perform claims for addr4 with initial claim', async function () {
    const addr4ClaimTx1 = vestingContract.connect(addr4).claim(toTokens('0.6', decimals))
    await hasEmittedEvent(
      addr4ClaimTx1,
      'TokensClaimed',
      [
        addr4.address,
        2,
        toTokens('0.6', decimals)
      ]
    )
    const addr4AvailableClaim = await vestingContract.checkClaim(addr4.address)
    expect(addr4AvailableClaim).to.be.closeTo(toTokens('0', decimals), toTokens('0.1', decimals))
    const balance1 = await colonyGovernanceToken.balanceOf(addr4.address)
    expect(balance1).to.equal(toTokens('0.6', decimals))
  })

  it('Check claim after 500s for addr1 and addr2', async function () {
    await increaseTime(500)

    const addr1AvailableClaim = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim).to.be.closeTo(toTokens('2.5', decimals), toTokens('0.1', decimals))

    // vesting for addr2 has not started yet
    const addr2AvailableClaim = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim).to.equal(0)
  })

  it('Check claim after 1000s for addr1 and addr2', async function () {
    await increaseTime(500)

    const addr1AvailableClaim = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim).to.be.closeTo(toTokens('5', decimals), toTokens('0.1', decimals))

    // vesting for addr2 has not started yet
    const addr2AvailableClaim = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim).to.be.closeTo(toTokens('0', decimals), toTokens('0.1', decimals))
  })

  it('Check claim after 1500s for addr1 and addr2', async function () {
    await increaseTime(500)

    const addr1AvailableClaim = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim).to.be.closeTo(toTokens('7.5', decimals), toTokens('0.1', decimals))

    const addr2AvailableClaim = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim).to.be.closeTo(toTokens('2.5', decimals), toTokens('0.1', decimals))
  })

  it('Perform claims for addr1', async function () {
    // First claim
    const addr1ClaimTx1 = vestingContract.connect(addr1).claim(toTokens('1', decimals))
    await hasEmittedEvent(
      addr1ClaimTx1,
      'TokensClaimed',
      [
        addr1.address,
        0,
        toTokens('1', decimals)
      ]
    )
    const addr1AvailableClaim = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim).to.be.closeTo(toTokens('6.5', decimals), toTokens('0.1', decimals))
    const balance1 = await colonyGovernanceToken.balanceOf(addr1.address)
    expect(balance1).to.equal(toTokens(1, decimals))

    // Second claim
    const addr1ClaimTx2 = vestingContract.connect(addr1).claim(toTokens('2', decimals))
    await hasEmittedEvent(
      addr1ClaimTx2,
      'TokensClaimed',
      [
        addr1.address,
        0,
        toTokens('2', decimals)
      ]
    )
    const addr1AvailableClaim2 = await vestingContract.checkClaim(addr1.address)
    expect(addr1AvailableClaim2).to.be.closeTo(toTokens('4.5', decimals), toTokens('0.1', decimals))
    const balance2 = await colonyGovernanceToken.balanceOf(addr1.address)
    expect(balance2).to.equal(toTokens('3', decimals))
  })

  it('Perform another claim for addr4 with initial claim', async function () {
    const addr4ClaimTx1 = vestingContract.connect(addr4).claim(toTokens('1', decimals))
    await hasEmittedEvent(
      addr4ClaimTx1,
      'TokensClaimed',
      [
        addr4.address,
        2,
        toTokens('1', decimals)
      ]
    )
    const balance1 = await colonyGovernanceToken.balanceOf(addr4.address)
    expect(balance1).to.equal(toTokens('1.6', decimals))
  })

  it('Prevents claiming more than available', async function () {
    const tx = vestingContract.connect(addr1).claim(toTokens('10', decimals))
    await expect(tx).to.be.revertedWith('Claim amount too high!')
  })

  it('Pauses vesting and makes it unavailable for user to claim', async function () {
    const pauseTx = vestingContract._pauseVesting()
    await hasEmittedEvent(
      pauseTx,
      'Paused',
      [owner.address]
    )

    const claimTx = vestingContract.connect(addr1).claim(toTokens('1', decimals))
    await expect(claimTx).to.be.revertedWith('Pausable: paused')
  })

  it('Unpauses vesting and makes it available for user to claim again', async function () {
    const pauseTx = vestingContract._unpauseVesting()
    await hasEmittedEvent(
      pauseTx,
      'Unpaused',
      [owner.address]
    )

    await vestingContract.connect(addr1).claim(toTokens('1', decimals))
    const balance = await colonyGovernanceToken.balanceOf(addr1.address)
    expect(balance).to.equal(toTokens('4', decimals))
  })

  it('Claim all. Allows claiming no more than maximum configured claim (100% of vesting funds).', async function () {
    await increaseTime(50000)
    const addr2AvailableClaim = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim).to.equal(toTokens('100', decimals))

    const tx = vestingContract.connect(addr2).claimAll()
    await hasEmittedEvent(
      tx,
      'TokensClaimed',
      [
        addr2.address,
        1,
        toTokens('100', decimals)
      ]
    )

    const addr2AvailableClaim2 = await vestingContract.checkClaim(addr2.address)
    expect(addr2AvailableClaim2).to.equal(0)

    const tx2 = vestingContract.connect(addr2).claim(toTokens('1', decimals))
    await expect(tx2).to.be.revertedWith('Claim amount too high!')

    const balance = await colonyGovernanceToken.balanceOf(addr2.address)
    expect(balance).to.equal(toTokens('100', decimals))
  })
})

describe('Vesting contract - return of tokens after vesting start', function () {
  before(async function () {
    [owner, mockAddress, addr1, addr2, addr3, addr4] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
    vestingContract = await setupVestingContract(colonyGovernanceToken.address, 0, 0)
    await colonyGovernanceToken.initialMint(
      [mockAddress.address, vestingContract.address],
      [toTokens('200', decimals), toTokens('500', decimals)]
    )
    decimals = parseInt((await colonyGovernanceToken.decimals()).toString())
  })

  it('Check if all amount of tokens is returned when no vesting is configured', async function () {
    const name = 'Test group'
    const distributionAmount = toTokens('150', decimals)
    const distributionStartOffset = 0
    const distributionLength = 10000
    const initialRelease = 0

    await vestingContract._setGroup(
      name,
      distributionAmount,
      distributionStartOffset,
      distributionLength,
      initialRelease
    )

    await vestingContract._startVesting(0, addr4.address)
    expect(await colonyGovernanceToken.balanceOf(addr4.address)).to.equal(toTokens('500', decimals))
  })
})

describe('Vesting contract - vesting closing operations', function () {
  before(async function () {
    [owner, mockAddress, addr1, addr2, addr3, addr4] = await ethers.getSigners()
    colonyGovernanceToken = await setupGovernanceToken()
    vestingContract = await setupVestingContract(colonyGovernanceToken.address, 200, 70)
    await colonyGovernanceToken.initialMint(
      [mockAddress.address, vestingContract.address],
      [toTokens('200', decimals), toTokens('500', decimals)]
    )
    decimals = parseInt((await colonyGovernanceToken.decimals()).toString())

    // set a group, user and start vesting
    // the group start vesting in second 100, vests until second 1000 and vesting can be closed after second 1200
    await vestingContract._setGroup('Test', toTokens('100', decimals), 100, 900, 0)
    await vestingContract._setUser(addr1.address, 0, toTokens('50', decimals))
    await vestingContract._startVesting(0, addr4.address)
  })

  it('time = 0s. Revert before group vesting starts', async function () {
    const rev1 = vestingContract._closeVesting()
    await expect(rev1).to.be.revertedWith('Cannot close vesting!')
  })

  it('time = 500s. Revert during group vesting process', async function () {
    await increaseTime(500)
    const rev2 = vestingContract._closeVesting()
    await expect(rev2).to.be.revertedWith('Cannot close vesting!')
  })

  it('time = 1050s. Revert after group vesting finishes but before the close offset ends', async function () {
    await increaseTime(550)
    const rev3 = vestingContract._closeVesting()
    await expect(rev3).to.be.revertedWith('Cannot close vesting!')
  })

  it('time = 1250s. Should properly perform a vesting close', async function () {
    await increaseTime(200)
    const tx = vestingContract._closeVesting()
    await hasEmittedEvent(
      tx,
      'VestingScheduledForClosing',
      [
        70
      ]
    )
  })

  it('Allows claiming of tokens during the close margin period', async function () {
    expect(await vestingContract.checkClaim(addr1.address)).to.equal(toTokens('50', decimals))
    await vestingContract.connect(addr1).claim(toTokens('10', decimals))
    expect(await colonyGovernanceToken.balanceOf(addr1.address)).to.equal(toTokens('10', decimals))
  })

  it('time = 1330s. Prevents claiming when vesting is completed', async function () {
    await increaseTime(80)
    expect(await vestingContract.checkClaim(addr1.address)).to.equal(toTokens('40', decimals))
    await expect(vestingContract.connect(addr1).claim(toTokens('40', decimals))).to.be.revertedWith('Vesting has been closed!')
  })

  it('Reclaims contract balance after vesting is closed', async function () {
    const tx = vestingContract._reclaim(addr2.address)
    await hasEmittedEvent(
      tx,
      'TokensReclaimed',
      [
        owner.address,
        addr2.address,
        toTokens('40', decimals)
      ]
    )
    expect(await colonyGovernanceToken.balanceOf(addr2.address)).to.equal(toTokens('40', decimals))
  })
})
