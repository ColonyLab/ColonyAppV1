// import { Contract } from '@ethersproject/contracts'
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import * as rax from 'retry-axios'
import axios from 'axios'
import queristring from 'querystring'
import { ParsedStakeEvent } from './events'
import { CommonConfig } from './common'

const pageSize = 20000
const maxBlockRange = 1000000

export async function buildCovalenthqUrl (chainId: number, topic: string, pageNum: number, startBlockNumber: string, endBlockNumber: string): Promise<string> {
  const covalenthqBaseUrl = process.env.COVALENTHQ_BASE_URL

  const queryArgs = {
    format: 'JSON',
    'quote-currency': 'USD',
    'sender-address': CommonConfig(chainId).address,
    'starting-block': startBlockNumber,
    'ending-block': endBlockNumber,
    'page-size': pageSize,
    'page-number': pageNum,
    key: process.env.COVALENTHQ_API_KEY
  }

  return covalenthqBaseUrl + chainId.toString() + '/events/topics/' +
    topic + '/?' + queristring.stringify(queryArgs)
}

export function parseCovalenthqItems (items: any[]): ParsedStakeEvent[] {
  return items.map(item => {
    const timestamp = (new Date(item.block_signed_at)).getTime() / 1000

    return {
      eventName: item.decoded.name,
      blockNum: item.block_height,
      account: item.decoded.params[0].value,
      value: BigNumber.from(item.decoded.params[1].value),
      timestamp: timestamp
    }
  })
}

async function rexRequest (url: string): Promise<any> {
  rax.attach()
  return await axios({
    url: url,
    raxConfig: {
      retry: 5,
      noResponseRetries: 3,
      retryDelay: 100,

      // You can detect when a retry is happening, and figure out how many
      // retry attempts have been made
      onRetryAttempt: err => {
        const cfg = rax.getConfig(err)
        if (cfg !== undefined) {
          console.log(`Retry attempt #${cfg.currentRetryAttempt}`)
        }
      }
    }
  })
}

async function getEventsWithPagination (topic: string, endBlockNumber: number): Promise<ParsedStakeEvent[]> {
  const network = await ethers.provider.detectNetwork()
  const events: ParsedStakeEvent[] = []
  const chunkArray: Array<number> = []

  chunkArray.push(CommonConfig(network.chainId).deployBlock)
  const chunkQuantity = Math.ceil((endBlockNumber - chunkArray[0]) / maxBlockRange)
  for (let i = 0; i < chunkQuantity; i++) {
    if (i < chunkQuantity - 1) {
      chunkArray.push(chunkArray[i] + maxBlockRange)
    } else {
      chunkArray.push(endBlockNumber + 1)
    }
  }

  for (let index = 1; index < chunkArray.length; index++) {
    for (let pageNum = 0; ; pageNum++) {
      const url = await buildCovalenthqUrl(
        network.chainId,
        topic,
        pageNum,
        chunkArray[index - 1].toString(),
        (chunkArray[index] - 1).toString()
      )

      console.log(`[Events/Pagination] Getting events for page ${pageNum} - chunk ${index}`)
      console.log('url:', url) // dbg

      const res = await rexRequest(url)
      const items = res.data.data.items
      if (items.length === 0) {
        break
      }
      events.push(...parseCovalenthqItems(items))
    }
  }
  return events
}

// get StakeAdded events from Covalenthq
export async function getStakeAddedEventsCovalenthq (endBlockNumber: number): Promise<ParsedStakeEvent[]> {
  console.log(`[Stake Events] Getting 'StakeAdded' from covalenthq, endBlockNumber: ${endBlockNumber}`)
  const topic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
    'StakeAdded(address,uint256)'
  ))

  const events = await getEventsWithPagination(topic, endBlockNumber)
  console.log(`[Stake Events] Got total ${events.length} 'StakeAdded' events`)

  return events
}

// get StakeRemoved events from Covalenthq
export async function getStakeRemovedEventsCovalenthq (endBlockNumber: number): Promise<ParsedStakeEvent[]> {
  console.log(`[Unstake Events] Getting 'StakeRemoved' from covalenthq, endBlockNumber: ${endBlockNumber}`)
  const topic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
    'StakeRemoved(address,uint256)'
  ))

  const events = await getEventsWithPagination(topic, endBlockNumber)
  console.log(`[Unstake Events] Got total ${events.length} 'StakeAdded' events`)

  return events
}

// combine StakeAdded and StakeRemoved events, sort by timestamps
export async function getCombinedStakeEventsCovalenthq (endBlockNumber: number): Promise<ParsedStakeEvent[]> {
  const stakeEvents = await getStakeAddedEventsCovalenthq(endBlockNumber)
  const unstakeEvents = await getStakeRemovedEventsCovalenthq(endBlockNumber)

  // merge arrays and resolve timestamps
  const combinedEvents = [...stakeEvents, ...unstakeEvents]

  // sort all events by block timestamp
  return combinedEvents.sort((e1, e2) => {
    return e1.timestamp < e2.timestamp ? -1 : 1
  })
}
