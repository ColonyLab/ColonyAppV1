import { BigNumber, bignumber } from 'mathjs'

import walletsData from '../../data/governance-staking-vesting-deployment/test-wallets.json' // <---- define here file with data to import
import groupsData from '../../data/governance-staking-vesting-deployment/test-groups.json' // <---- define here file with data to import

async function main (): Promise<void> {
  let totalAmountToVest = bignumber(0)
  let totalAmountToMint = bignumber(0)
  const walletsFileGroupSum: {[key: string]: BigNumber} = {}
  const groupsFileGroupSum: {[key: string]: BigNumber} = {}
  const walletDuplicationCheck: string[] = []

  console.log('[Initial mint] Loading configuration file...')

  for (const wallet of walletsData) {
    const addr = wallet.address

    if (walletDuplicationCheck.includes(addr)) {
      throw new Error(`Duplicated wallet address: ${addr} !`)
    }
    walletDuplicationCheck.push(addr)
  }

  for (const wallet of walletsData) {
    if (wallet.group === 'direct_mint') {
      console.log(`[Initial mint] Address ${wallet.address} will receive directly ${wallet.amount} tokens`)
      totalAmountToMint = totalAmountToMint.add(wallet.amount)
    }
    if (walletsFileGroupSum[wallet.group] === undefined) {
      walletsFileGroupSum[wallet.group] = bignumber(0)
    }
    walletsFileGroupSum[wallet.group] = walletsFileGroupSum[wallet.group].add(wallet.amount)
  }

  console.log('')
  for (const group of groupsData) {
    console.log(`[Initial mint] Group ${group.name} will receive vested ${group.total_amount} tokens`)

    totalAmountToVest = totalAmountToVest.add(group.total_amount)
    totalAmountToMint = totalAmountToMint.add(group.total_amount)
    groupsFileGroupSum[group.name] = bignumber(group.total_amount)
  }
  console.log(`\n[Initial mint] Total tokens to mint: ${totalAmountToMint} (this include ${totalAmountToVest} tokens for Vesting contract)\n`)

  for (const i in walletsFileGroupSum) {
    console.log(`${i}:`)
    console.log(`Wallets: ${walletsFileGroupSum[i]}    Groups: ${groupsFileGroupSum[i] ?? null}    Difference: ${walletsFileGroupSum[i].sub(groupsFileGroupSum[i] ?? 0)}`)
    console.log()
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
