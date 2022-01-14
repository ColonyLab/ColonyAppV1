import { Contract } from '@ethersproject/contracts'
import { ethers } from 'hardhat'
import { Event, BigNumber, EventFilter } from 'ethers'
import { fromTokens } from '../../../test/utils/testHelpers'
import { CommonConfig } from './common'

export type BlocksRange = {
  fromBlockNumber: number,
  toBlockNumber: number
}

export type ParsedStakeEvent = {
  eventName: string,
  blockNum: number,
  account: string,
  value: BigNumber,
  timestamp: number,
}

export function printStakeEvents (events: ParsedStakeEvent[]): void {
  console.log('Stake Events:')
  console.log(
    events.map(function (e): any {
      return {
        eventName: e.eventName,
        blockNum: e.blockNum,
        account: e.account,
        tokens: fromTokens(e.value.toString()),
        date: new Date(e.timestamp * 1000) // miliseconds
      }
    })
  )
}

export async function calcBlocksRanges (rangeSize: number, startBlockNumber: number, endBlockNumber?: number): Promise<BlocksRange[]> {
  const ranges: BlocksRange[] = []

  // get lastest block number, if endBlockNumber not defined
  if (typeof endBlockNumber === 'undefined') {
    const latestBlock = await ethers.provider.getBlock('latest')
    endBlockNumber = latestBlock.number
  }

  // events are taken in the ranges of block numbers inclusive, e.g:
  // [50000-99999]
  // [100000-149999]
  // [150000-199999]
  for (let fromNum = startBlockNumber; fromNum < endBlockNumber; fromNum += rangeSize) {
    let lastInRange = fromNum + rangeSize - 1
    if (lastInRange > endBlockNumber) {
      lastInRange = endBlockNumber
    }

    ranges.push({
      fromBlockNumber: fromNum,
      toBlockNumber: lastInRange
    })
  }
  return ranges
}

// returns one array of StakeAdded and StakeRemoved events sorted by timestamps
// optional account index and endBlockNumber
export async function getStakeEvents (colonyStaking: Contract, endBlockNumber?: number, account?: string): Promise<ParsedStakeEvent[]> {
  const network = await ethers.provider.detectNetwork()

  const ranges = await calcBlocksRanges(
    1000000,
    CommonConfig(network.chainId).deployBlock,
    endBlockNumber
  )

  const allEvents = []

  for (const r of ranges) {
    const rangeEvents = await getCombinedStakeEvents(colonyStaking, r, account)
    allEvents.push(...rangeEvents)
  }

  return allEvents
}

export function parseEvents (events: Event[]): Promise<ParsedStakeEvent[]> {
  return Promise.all(events.map(async e => {
    const block = await e.getBlock()

    if (e.args !== undefined && e.event !== undefined) {
      const { account, value } = e.args

      return {
        eventName: e.event,
        blockNum: block.number,
        account: account,
        value: value,
        timestamp: block.timestamp
      }
    }

    throw new Error(`[Stake Events] Got bad event: ${event}`)
  })).catch(err => { throw err })
}

// helper which retries failed promises with maxRetries = 10
async function retryPromise (promise: CallableFunction): Promise<any> {
  const maxRetries = 10

  function rejectDelay (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await promise()
    } catch (err) {
      console.log(`Promise failed: ${err}\ntrying again ${i}`)
      await rejectDelay(15000)
    }
  }
  throw new Error(`Failed with ${maxRetries} attempts `)
}

export async function getStakeAddedEvents (colonyStaking: Contract, range: BlocksRange, account?: string): Promise<ParsedStakeEvent[]> {
  let filter: EventFilter = colonyStaking.filters.StakeAdded()
  if (typeof account !== 'undefined') {
    filter = colonyStaking.filters.StakeAdded(account)
  }

  console.log(`[Stake Events] Getting 'StakeAdded' in range [${range.fromBlockNumber}-${range.toBlockNumber}], index: [${account}]`)
  const stakeEvents = await retryPromise(function (): Promise<Event[]> {
    return colonyStaking.queryFilter(
      filter,
      range.fromBlockNumber,
      range.toBlockNumber
    )
  })
  console.log(`[Stake Events] Found ${stakeEvents.length} 'StakeAdded' events in blocks [${range.fromBlockNumber}-${range.toBlockNumber}]`)

  return parseEvents(stakeEvents)
}

export async function getStakeRemovedEvents (colonyStaking: Contract, range: BlocksRange, account?: string): Promise<ParsedStakeEvent[]> {
  let filter: EventFilter = colonyStaking.filters.StakeRemoved()
  if (typeof account !== 'undefined') {
    filter = colonyStaking.filters.StakeRemoved(account)
  }

  console.log(`[Stake Events] Getting 'StakeRemoved' in range [${range.fromBlockNumber}-${range.toBlockNumber}], index: [${account}]`)
  const unstakeEvents = await retryPromise(function (): Promise<Event[]> {
    return colonyStaking.queryFilter(
      filter,
      range.fromBlockNumber,
      range.toBlockNumber
    )
  })
  console.log(`[Stake Events] Found ${unstakeEvents.length} 'StakeRemoved' events in blocks [${range.fromBlockNumber}-${range.toBlockNumber}]`)

  return parseEvents(unstakeEvents)
}

// combine StakeAdded and StakeRemoved events, sort by timestamps
export async function getCombinedStakeEvents (colonyStaking: Contract, range: BlocksRange, account?: string): Promise<ParsedStakeEvent[]> {
  const stakeEvents = await getStakeAddedEvents(colonyStaking, range, account)
  const unstakeEvents = await getStakeRemovedEvents(colonyStaking, range, account)

  // merge arrays and resolve timestamps
  const combinedEvents = [...stakeEvents, ...unstakeEvents]

  // sort all events by block timestamp
  return combinedEvents.sort((e1, e2) => {
    return e1.timestamp < e2.timestamp ? -1 : 1
  })
}
