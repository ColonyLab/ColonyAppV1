import { ethers } from 'hardhat'
import { toTokens } from '../../test/utils/testHelpers'

import data from '../../data/governance-staking-vesting-deployment/test-wallets.json' // <---- define here file with data to import

const vestingContractAddress = ''
const chunkSize = 5

async function main (): Promise<void> {
  const Vesting = await ethers.getContractFactory('Vesting')
  const vesting = Vesting.attach(vestingContractAddress)

  const groupsData: {[key: string]: string} = {}
  let vestingWallets: Array<string> = []
  let vestingGroups: Array<string> = []
  let vestingAmouns: Array<string> = []

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
      console.log(`[Import Wallets Bulk] Adding new wallet to the chunk: ${wallet.address}`)

      vestingWallets.push(wallet.address)
      vestingGroups.push(groupsData[wallet.group])
      vestingAmouns.push(toTokens(wallet.amount, 18))

      if (vestingWallets.length % chunkSize === 0) {
        const tx = await vesting._setUserBulk(vestingWallets, vestingGroups, vestingAmouns)
        await tx.wait()
        console.log(`[Import Wallets Bulk] Chunk has been added: ${tx.hash}\n`)
        vestingWallets = []
        vestingGroups = []
        vestingAmouns = []
      }
    }
  }

  console.log('[Import Wallets Bulk] Done!')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
