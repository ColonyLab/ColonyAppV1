import { StakePeriod, StakingPeriods } from './stakingPeriods'
import { create, all, BigNumber } from 'mathjs'

const config = {
  number: 'BigNumber',
  precision: 64
}
const math = create(all, config)

export const sharesDenominator = math.bignumber('1e36')

// encapsulates airdrop rewards calculations based on data from StakingPeriods object
// uses BigNumber from math.js
export class AirdropShares {
  private stakingPeriods: StakingPeriods

  public allAuthorizedAccounts: string[]
  public averageStakePeriod: BigNumber
  public deviationsAbsoluteSum: BigNumber
  public stakeWithBonusSum: BigNumber

  requireAllAuthAccounts () {
    if (this.allAuthorizedAccounts === undefined) {
      throw new Error('require allAuthorizedAccounts set')
    }
  }

  requireAverageStakePeriod () {
    if (this.averageStakePeriod === undefined) {
      throw new Error('require averageStakePeriod set')
    }
  }

  requireDeviationsAbsoluteSum () {
    if (this.deviationsAbsoluteSum === undefined) {
      throw new Error('require deviationsAbsoluteSum set')
    }
  }

  requireStakeWithBonusSum () {
    if (this.stakeWithBonusSum === undefined) {
      throw new Error('require stakeWithBonusSum set')
    }
  }

  constructor (stakingPeriods: StakingPeriods) {
    this.stakingPeriods = stakingPeriods

    // calculate shared values only once
    const airdropTimestamp = stakingPeriods.airdropTimestamp
    this.allAuthorizedAccounts = stakingPeriods.allAuthorizedAccounts(airdropTimestamp)
    this.averageStakePeriod = this.calcAverageStakePeriod()
    this.deviationsAbsoluteSum = this.calcDeviationsAbsoluteSum()
    this.stakeWithBonusSum = this.calcStakeWithBonusSum()
  }

  // ----------------------------------------------------------
  // INDIVIDUAL ACCOUNT FUNCTIONS

  averageStake (account: string): BigNumber {
    const accStakePeriods: StakePeriod[] = []
    const stakeMaxTimestamp = this.stakingPeriods.airdropTimestamp - this.stakingPeriods.averageStakeSizePeriodLimit

    if (this.stakingPeriods.accountsStakesPeriods[account] === undefined) {
      return math.bignumber(0)
    }

    for (const stakePeriod of this.stakingPeriods.accountsStakesPeriods[account]) {
      let period = stakePeriod.period
      if (period === 0) { // last stake
        period = this.stakingPeriods.airdropTimestamp - stakePeriod.fromTimestamp
      }

      const stakePeriodTo = stakePeriod.fromTimestamp + period
      if (stakePeriodTo <= stakeMaxTimestamp) {
        continue
      } else if (stakePeriodTo > stakeMaxTimestamp && stakePeriod.fromTimestamp <= stakeMaxTimestamp) {
        period = stakePeriodTo - stakeMaxTimestamp
      }

      accStakePeriods.push({
        fromTimestamp: stakePeriod.fromTimestamp,
        value: stakePeriod.value,
        period
      })
    }

    // VMP - value multipled by the period
    let totalVMP = math.bignumber(0)
    for (const stakePeriod of accStakePeriods) {
      const value = math.bignumber(stakePeriod.value.toString())

      const stakeVMP = value.mul(math.bignumber(stakePeriod.period))
      totalVMP = totalVMP.add(stakeVMP)
    }

    return totalVMP.div(this.stakingPeriods.averageStakeSizePeriodLimit)
  }

  // could be negative
  periodDeviation (account: string): BigNumber {
    this.requireAverageStakePeriod()

    const accStakePeriod = math.bignumber(this.stakingPeriods.stakesPeriod(account))
    return accStakePeriod.sub(this.averageStakePeriod)
  }

  accountBonus (account: string): BigNumber {
    this.requireDeviationsAbsoluteSum()

    return this.periodDeviation(account).div(this.deviationsAbsoluteSum)
  }

  stakeWithBonus (account: string): BigNumber {
    const bonus = this.accountBonus(account)

    // average stake * (bonus + 1)
    return this.averageStake(account).mul(bonus.add(1))
  }

  // instead of float use integer for given sharesDenominator
  share (account: string): BigNumber {
    this.requireStakeWithBonusSum()

    const num = this.stakeWithBonus(account).mul(sharesDenominator).floor()
    return num.div(this.stakeWithBonusSum).floor()
  }

  calculationDetails (account: string): any {
    return {
      period: this.stakingPeriods.stakesPeriod(account),
      averageStake: this.averageStake(account).toPrecision(64),
      deviation: this.periodDeviation(account).toPrecision(64),
      bonus: this.accountBonus(account).toPrecision(64),
      stakeWithBonus: this.stakeWithBonus(account).toPrecision(64),
      share: this.share(account).toFixed(0) // integer
    }
  }

  // ----------------------------------------------------------
  // FUNCTIONS FOR ALL AUTHORIZED ACCOUNTS

  // average stake period for all authorized accounts
  calcAverageStakePeriod (): BigNumber {
    this.requireAllAuthAccounts()

    let totalPeriod = math.bignumber(0)
    for (const acc of this.allAuthorizedAccounts) {
      totalPeriod = totalPeriod.add(this.stakingPeriods.stakesPeriod(acc))
    }
    return totalPeriod.div(this.allAuthorizedAccounts.length)
  }

  // deviation sum of all absolute authorized accounts periods
  calcDeviationsAbsoluteSum (): BigNumber {
    this.requireAllAuthAccounts()

    let totalAbsDeviation = math.bignumber(0)
    for (const acc of this.allAuthorizedAccounts) {
      const absoluteAccPeriod = math.abs(this.periodDeviation(acc))
      totalAbsDeviation = totalAbsDeviation.add(absoluteAccPeriod)
    }
    return totalAbsDeviation
  }

  // stake with bonus sum for all authorized accounts
  calcStakeWithBonusSum (): BigNumber {
    let sum = math.bignumber(0)
    for (const acc of this.allAuthorizedAccounts) {
      const accStake = this.stakeWithBonus(acc)
      sum = sum.add(accStake)
    }
    return sum
  }

  globalCalculationDetails (): any {
    return {
      sharesDenominator: sharesDenominator.toFixed(),
      averageStakePeriod: this.averageStakePeriod.toPrecision(64),
      deviationsAbsoluteSum: this.deviationsAbsoluteSum.toPrecision(64),
      stakeWithBonusSum: this.stakeWithBonusSum.toPrecision(64)
    }
  }

  // ----------- check functions

  checkSharesSum (): BigNumber {
    console.log('[AirdropShares] validating accounts shares...')

    let sum = math.bignumber(0)
    for (const acc of this.allAuthorizedAccounts) {
      const accShare = this.share(acc)
      sum = sum.add(accShare)
    }

    if (sum.gt(sharesDenominator)) {
      throw new Error(`Shares sum greater than denominator: ${sum.toFixed(0)} of ${sharesDenominator.toFixed(0)}`)
    }

    const epsilon = math.bignumber('1e-18')
    const minShares = sharesDenominator.mul(math.bignumber(1).sub(epsilon))

    if (sum.lt(minShares)) {
      throw new Error(`Shares sum lower than expected: ${sum.toFixed(0)}, for min value: ${minShares.toFixed(0)}`)
    }

    return sum
  }
}
