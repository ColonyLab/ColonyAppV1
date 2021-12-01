import { ethers } from 'hardhat'
import { toTokens } from '../../test/utils/testHelpers'

import data from '../../data/governance-staking-vesting-deployment/test-wallets.json' // <---- define here file with data to import

const vestingContractAddress = ''
const chunkSize = 100

async function main (): Promise<void> {
  const Vesting = await ethers.getContractFactory('Vesting')
  const vesting = Vesting.attach(vestingContractAddress)

  const groupsData: {[key: string]: string} = {}
  const vestingWallets: Array<string> = []
  const vestingGroups: Array<string> = []
  const vestingAmouns: Array<string> = []
  let startIndex, endIndex

  console.log('[Import Wallets Bulk] Loading groups data from contract...')
  const groupEvents = await vesting.queryFilter(vesting.filters.GroupDataSet())
  for (const event of groupEvents) {
    groupsData[event.args?.groupName] = event.args?.groupId.toString()
  }

  for (const wallet of data) {
    if (wallet.group !== 'direct_mint' && groupsData[wallet.group] === undefined) {
      throw Error(`Unrecognized group in import data file: ${wallet.group}`)
    }
  }
  for (const wallet of data) {
    if (wallet.group !== 'direct_mint') {
      console.log(`[Import Wallets Bulk] Loading wallet data: ${wallet.address}`)

      vestingWallets.push(wallet.address)
      vestingGroups.push(groupsData[wallet.group])
      vestingAmouns.push(toTokens(wallet.amount, 18))
    }
  }
  const totalChunks = Math.ceil(vestingWallets.length / chunkSize)
  console.log(`\n[Import Wallets Bulk] Found ${totalChunks} chunks in total with size of ${chunkSize}\n`)

  for (let i = 0; i < totalChunks; i++) {
    startIndex = i * chunkSize
    endIndex = (i + 1) * chunkSize
    const tx = await vesting._setUserBulk(
      vestingWallets.slice(startIndex, endIndex),
      vestingGroups.slice(startIndex, endIndex),
      vestingAmouns.slice(startIndex, endIndex)
    )
    await tx.wait()
    console.log(`[Import Wallets Bulk] Chunk ${i + 1}/${totalChunks} has been added: ${tx.hash}`)
  }

  console.log('[Import Wallets Bulk] Done!')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
