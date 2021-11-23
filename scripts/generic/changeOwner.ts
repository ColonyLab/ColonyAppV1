import { ethers } from "hardhat";

const contractAddress = ''
const newOwnerAddress = ''

async function main(): Promise<void> {
    const ownable = await ethers.getContractAt("Ownable", contractAddress)

    await ownable.transferOwnership(newOwnerAddress)
    console.log('Done')
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })