import { ethers } from 'hardhat'

async function main (): Promise<void> {
  const EthDater = require('ethereum-block-by-date')
  const dater = new EthDater(ethers.provider)

  const block = await dater.getDate(
    '2021-12-29T00:00:00Z', // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  )

  console.log(block)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
