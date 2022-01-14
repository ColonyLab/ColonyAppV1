import { BigNumber } from 'ethers'
import { ParsedStakeEvent } from './events'

export type Stake = {
  value: BigNumber,
  timestamp: number,
}

// all accounts stakes, map[address] => Array<Stake>
export interface AccountsStakes {
  [key: string]: Stake[]
}

// object which simulates Stacking contract
// most of the functions works in the same way as Staking.sol original contract
// some contract optimizations were omitted (maxDepositLength, realDepositsLength)
export class StakingMock {
  public deposits: AccountsStakes = {}

  public authAmount: BigNumber
  public authPeriod: number

  constructor (authAmount: BigNumber, authPeriod: number) {
    this.authAmount = authAmount
    this.authPeriod = authPeriod
  }

  loadEvents (events: ParsedStakeEvent[]) {
    for (const e of events) {
      // double check last stake (order of events)
      const accDeposit = this.deposits[e.account]
      if (accDeposit !== undefined && accDeposit.length > 0) {
        const lastStake = this.getLastStake(e.account)
        if (e.timestamp < lastStake.timestamp) {
          throw new Error(`[StakingMock] can not load older event, account: ${e.account}`)
        }
      }

      if (e.eventName === 'StakeAdded') {
        this.pushValue(e)
      } else if (e.eventName === 'StakeRemoved') {
        this.removeValue(e)
      } else {
        throw new Error(`[StakingMock] got unsupported event: ${e.eventName}`)
      }
    }
  }

  depositSum (account: string): BigNumber {
    let totalAccValue = BigNumber.from(0)
    if (this.deposits[account] === undefined) {
      return BigNumber.from(0)
    }

    for (const stake of this.deposits[account]) {
      totalAccValue = totalAccValue.add(stake.value)
    }
    return totalAccValue
  }

  isAccountAuthorized (account: string, checkTimestamp: number): boolean {
    const maxTimestamp = checkTimestamp - this.authPeriod
    return this.isStoredLongEnough(account, this.authAmount, maxTimestamp)
  }

  allAuthorizedAccounts (checkTimestamp: number): string[] {
    const authAccounts = []

    for (const acc of Object.keys(this.deposits)) {
      if (this.isAccountAuthorized(acc, checkTimestamp)) {
        authAccounts.push(acc)
      }
    }
    return authAccounts
  }

  isStoredLongEnough (account: string, minValue: BigNumber, maxTimestamp: number): boolean {
    const totalValue = this.valueStoredLongEnough(account, maxTimestamp)

    if (totalValue.gte(minValue)) {
      return true
    }
    return false
  }

  valueStoredLongEnough (account: string, maxTimestamp: number): BigNumber {
    let totalValue = BigNumber.from(0)

    for (const stake of this.deposits[account]) {
      if (stake.timestamp > maxTimestamp) {
        break
      }
      totalValue = totalValue.add(stake.value)
    }
    return totalValue
  }

  pushValue (parsedEvent: ParsedStakeEvent): void {
    const stake: Stake = {
      value: parsedEvent.value,
      timestamp: parsedEvent.timestamp
    }

    if (this.deposits[parsedEvent.account] === undefined) {
      this.deposits[parsedEvent.account] = []
    }

    this.deposits[parsedEvent.account].push(stake)
  }

  getLastStake (account: string): Stake {
    const lastIdx = this.deposits[account].length - 1
    return this.deposits[account][lastIdx]
  }

  removeLastStake (account: string): void {
    this.deposits[account].pop()
  }

  decreaseLastStake (account: string, decreaseValue: BigNumber): void {
    const lastIdx = this.deposits[account].length - 1
    const lastValue = this.deposits[account][lastIdx].value

    const newValue = lastValue.sub(decreaseValue)

    // check
    if (newValue.lte(0)) {
      throw new Error('[StakingMock] decreaseValue <= lastValue, should not happen')
    }

    // decrease
    this.deposits[account][lastIdx].value = newValue
  }

  removeValue (parsedEvent: ParsedStakeEvent): void {
    const account = parsedEvent.account
    let leftToRemove: BigNumber = parsedEvent.value

    // check
    if (parsedEvent.value.gt(this.depositSum(account))) {
      throw new Error('[stakingMock] removeValue > depositSum, should not happen')
    }

    while (leftToRemove.gt(0)) {
      const lastStake = this.getLastStake(account)
      const lastValue = lastStake.value

      if (leftToRemove.gte(lastValue)) {
        this.removeLastStake(account)
        leftToRemove = leftToRemove.sub(lastValue)
      } else {
        this.decreaseLastStake(account, leftToRemove)
        leftToRemove = BigNumber.from(0)
      }
    }
  }

  // Helper
  printDeposits (): void {
    const keys = Object.keys(this.deposits)
    console.log(`Staking deposits state [${keys.length}]:`)
    for (const [idx, account] of keys.entries()) {
      console.log(`[${idx}] ${account}`)

      for (const [idx, stake] of this.deposits[account].entries()) {
        console.log(`\t[${idx}] value: ${stake.value}, timestamp: ${stake.timestamp}`)
      }
    }
  }
}
