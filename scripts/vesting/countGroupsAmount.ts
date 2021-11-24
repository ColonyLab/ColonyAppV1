import { BigNumber, bignumber } from "mathjs"

import data from "../../data/governance-staking-vesting-deployment/test-wallets.json"      // <---- define here file with data to check

async function main(): Promise<void> {
    const groupsTotal: {[key: string]: BigNumber} = {}
    let total = bignumber(0)

    for(let wallet of data){
        if(groupsTotal[wallet.group] == undefined){
            groupsTotal[wallet.group] = bignumber(0)
        }
        groupsTotal[wallet.group] = groupsTotal[wallet.group].add(wallet.amount)
        total = total.add(wallet.amount)
    }

    console.log('Total amount of tokens for each group:')
    console.log(groupsTotal)

    console.log(`\nIn total: ${total}`)
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })