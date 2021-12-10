import { ethers } from 'hardhat'
import fs from 'fs'
import { Vesting } from '../../typechain-types'

const vestingContractAddress = ''
const result: Array<object> = []

interface UserData {
  address: string,
  groupId: string,
  amount: string
}

async function getAllVestingUsers (vestingContract: Vesting, fromBlockNumber: number, toBlockNumber: number): Promise<{[key: string]: UserData}> {
  console.log('[events] ignore fromBlockNumber and toBlockNumber:', fromBlockNumber, toBlockNumber)

  // get all UserDataSet events
  const userDataEvents = await vestingContract.queryFilter(
    vestingContract.filters.UserDataSet()
  )
  console.log(`UserDataSet events, length ${userDataEvents.length}`)

  const allUsers: {[key: string]: UserData} = {}

  for (const e of userDataEvents) {
    allUsers[e.args?.user] = {
      address: e.args?.user.toString(),
      groupId: e.args?.groupId.toString(),
      amount: e.args?.vestAmount.toString()
    }
  }

  return allUsers
}

async function main (): Promise<void> {
  const ColonyVestingContract = await ethers.getContractFactory('Vesting')
  const colonyVesting = ColonyVestingContract.attach(vestingContractAddress)

  const allUsers = await getAllVestingUsers(colonyVesting, 7669442, 0)

  for (const index in allUsers) {
    result.push({
      address: allUsers[index].address,
      groupId: allUsers[index].groupId,
      amount: allUsers[index].amount
    })
  }

  fs.writeFileSync('vestingStorageDump.json', JSON.stringify(result))
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
