type ContractInfo = {
  address: string,
  // block number in which contract was deployed
  deployBlock: number
}

export function CommonConfig (chainId: number): ContractInfo {
  switch (chainId) {
    case 43113: // avalanche fuji
      return {
        address: '0xb5C9a8CD0967F8d0640E31652749554FB6c7250F',
        deployBlock: 2994335
      }
    case 43114: // avalanche mainnet
      return {
        address: '0x5b0d74c78f2588b3c5c49857edb856cc731dc557',
        deployBlock: 7669478
      }
    default:
      throw new Error(`Config for chainId: ${chainId} is not defined`)
  }
}
