import { BigNumber } from 'ethers'
import { ParsedStakeEvent } from './events'
import { AccountsStakes, StakingMock, Stake } from './stakingMock'

// More detailed stake information
export type StakePeriod = {
  value: BigNumber,
  fromTimestamp: number,
  // period means how long this stake value last in time, in seconds
  // 0 means that this is the last element and period is not determined yet
  period: number,
}

// StakePeriod array for given account allows to determine stake value at any point in time
export interface AccountsStakesPeriods {
  [key: string]: StakePeriod[]
}

// extended Staking object to allow the calculation of average rates over time and weighted shares
export class StakingPeriods extends StakingMock {
  // maps for all stakes and unstakes, for debug info
  public stakes: AccountsStakes = {}
  public unstakes: AccountsStakes = {}

  // main data structure
  public accountsStakesPeriods: AccountsStakesPeriods = {}
  public airdropTimestamp: number = 0
  public averageStakeSizePeriodLimit: number

  // needed to calculate average stake over time
  public startTimestamp: number = 0

  constructor (authAmount: BigNumber, authPeriod: number, airdropTimestamp: number, averageStakeSizePeriodLimit: number) {
    super(authAmount, authPeriod)
    this.airdropTimestamp = airdropTimestamp
    this.averageStakeSizePeriodLimit = averageStakeSizePeriodLimit
  }

  pushStake (event: ParsedStakeEvent) {
    if (this.stakes[event.account] === undefined) {
      this.stakes[event.account] = []
    }

    this.stakes[event.account].push({
      value: event.value,
      timestamp: event.timestamp
    })
  }

  pushUnstake (event: ParsedStakeEvent) {
    if (this.unstakes[event.account] === undefined) {
      this.unstakes[event.account] = []
    }
    this.unstakes[event.account].push({
      value: event.value,
      timestamp: event.timestamp
    })
  }

  // use stakingMock deposits which removes stakes to not consider first stake when account stake earlier,
  // unstake all, and stake again authorized value after some time
  firstAuthorizedStake (account: string): Stake {
    const deposit = this.deposits[account]
    if (deposit === undefined || deposit.length === 0) {
      throw new Error(`[StakingPeriods] Trying to get first stake from empty account deposit ${account}`)
    }
    return deposit[0]
  }

  // consider only authorized accounts
  setStartTimestamp () {
    const allAutorized = super.allAuthorizedAccounts(this.airdropTimestamp)

    let firstAuthStake: number = Number.MAX_VALUE
    for (const acc of allAutorized) {
      const accFirstTimestamp = this.deposits[acc][0].timestamp
      if (accFirstTimestamp < firstAuthStake) {
        firstAuthStake = accFirstTimestamp
      }
    }
    this.startTimestamp = firstAuthStake
  }

  // account stake period starting from his first auth stake up to airdropTimestamp
  stakesPeriod (account: string): number {
    return this.airdropTimestamp - this.firstAuthorizedStake(account).timestamp
  }

  totalPeriod (): number {
    if (this.startTimestamp === 0) {
      throw new Error('[StakingPeriods] totalPeriod require set startTimestamp')
    }
    return this.airdropTimestamp - this.startTimestamp
  }

  // beside filling/calculating contract deposits (super), calcs stakes period information
  loadEvents (events: ParsedStakeEvent[]) {
    super.loadEvents(events)

    for (const e of events) {
      if (e.eventName === 'StakeAdded') {
        this.pushStake(e)
      } else if (e.eventName === 'StakeRemoved') {
        this.pushUnstake(e)
      } else {
        throw new Error(`[StakingPeriods] got unsupported event: ${e.eventName}`)
      }
      this.pushEvent(e)
    }

    this.setStartTimestamp()
  }

  // last element or zero-valued
  getLastStakePeriod (account: string): StakePeriod {
    const stakePeriods = this.accountsStakesPeriods[account]

    let lastStakePeriod: StakePeriod
    if (stakePeriods.length > 0) {
      lastStakePeriod = stakePeriods[stakePeriods.length - 1]
    } else {
      lastStakePeriod = {
        value: BigNumber.from(0),
        fromTimestamp: 0,
        period: 0
      }
    }
    return lastStakePeriod
  }

  // update if exist
  updateLastStakePeriod (event: ParsedStakeEvent) {
    const accStakePeriods = this.accountsStakesPeriods[event.account]

    if (accStakePeriods.length > 0) {
      const lastStakePeriod = this.getLastStakePeriod(event.account)

      const passedPeriod = event.timestamp - lastStakePeriod.fromTimestamp
      if (passedPeriod < 0) {
        throw new Error(`[StakingPeriods] negative passedPeriod: ${passedPeriod}, account: ${event.account}`)
      }

      const lastIdx = accStakePeriods.length - 1
      this.accountsStakesPeriods[event.account][lastIdx].period = passedPeriod
    }
  }

  // calculate newValue and check its correctness
  newStakeValue (event: ParsedStakeEvent): BigNumber {
    let newValue: BigNumber

    const lastStakePeriodValue = this.getLastStakePeriod(event.account).value

    if (event.eventName === 'StakeAdded') {
      newValue = lastStakePeriodValue.add(event.value)
    } else if (event.eventName === 'StakeRemoved') {
      newValue = lastStakePeriodValue.sub(event.value)
    } else {
      throw new Error(`[StakingPeriods] got unsupported event: ${event}`)
    }

    if (newValue.lt(0)) {
      throw new Error(`[StakingPeriods] newValue lower than 0: ${newValue.toString()}`)
    }
    return newValue
  }

  pushEvent (event: ParsedStakeEvent) {
    if (this.accountsStakesPeriods[event.account] === undefined) {
      this.accountsStakesPeriods[event.account] = []
    }

    const newStakePeriod: StakePeriod = {
      value: this.newStakeValue(event),
      fromTimestamp: event.timestamp,
      period: 0
    }

    // update period in the previous StakePeriod
    this.updateLastStakePeriod(event)

    // push new StakePeriod
    this.accountsStakesPeriods[event.account].push(newStakePeriod)
  }
}
