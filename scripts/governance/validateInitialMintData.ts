import { bignumber } from 'mathjs'

import walletsData from '../../data/governance-staking-vesting-deployment/test-wallets.json' // <---- define here file with data to import
import groupsData from '../../data/governance-staking-vesting-deployment/test-groups.json' // <---- define here file with data to import

async function main (): Promise<void> {
  let totalAmountToVest = bignumber(0)
  let totalAmountToMint = bignumber(0)

  console.log('[Initial mint] Loading configuration file...')

  for (const wallet of walletsData) {
    if (wallet.group === 'direct_mint') {
      console.log(`[Initial mint] Address ${wallet.address} will receive directly ${wallet.amount} tokens`)
      totalAmountToMint = totalAmountToMint.add(wallet.amount)
    }
  }

  console.log('')
  for (const group of groupsData) {
    console.log(`[Initial mint] Group ${group.name} will receive vested ${group.total_amount} tokens`)

    totalAmountToVest = totalAmountToVest.add(group.total_amount)
    totalAmountToMint = totalAmountToMint.add(group.total_amount)
  }
  console.log(`\n[Initial mint] Total tokens to mint: ${totalAmountToMint} (this include ${totalAmountToVest} tokens for Vesting contract)`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
