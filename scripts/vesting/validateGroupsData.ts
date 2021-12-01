import { bignumber } from 'mathjs'

import data from '../../data/governance-staking-vesting-deployment/test-groups.json' // <---- define here file with data to check

async function main (): Promise<void> {
  let total = bignumber(0)

  for (const group of data) {
    console.log('==============================================')
    console.log(`Group name:              ${group.name}`)
    console.log(`Total amount of tokens:  ${group.total_amount} tokens`)
    console.log(`Offset:                  ${bignumber(group.offset).div(86400).toFixed(2)} days`)
    console.log(`Period:                  ${bignumber(group.period).div(86400).toFixed(2)} days`)
    console.log(`Initial unlock:          ${bignumber(group.initial_unlock).mul(100).toString()}%`)
    console.log()
    total = total.add(group.total_amount)
  }

  console.log(`\nIn total: ${total} tokens`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
