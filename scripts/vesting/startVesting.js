const vestingContractAddress = '0xE10EC8d4dBaF84847301351f31FdEf9c37E401aa'
const returnWalletAddress    = '0x085cE2bF391016c0981DB049E96D2aAF2dF26365'

async function main() {
    const Vesting = await ethers.getContractFactory("Vesting")
    const vesting = await Vesting.attach(vestingContractAddress)

    await vesting._startVesting(0, returnWalletAddress)
    console.log("Done")
}   

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })