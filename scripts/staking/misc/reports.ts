import fs from 'fs'
import path from 'path'
import { getBlockTime } from '../../../test/utils/testHelpers'
import { AirdropShares } from './airdropShares'
import { AccountsStakes, StakingMock } from './stakingMock'
import { StakingPeriods } from './stakingPeriods'

// use string value instead of bignumber
type ReadableStake = {
  value: string,
  timestamp: number,
}

// all accounts stakes, map[address] => Array<Stake>
interface AccountsStakesReadable {
  [key: string]: ReadableStake[]
}

function makeAccountsStakesReadable (accountsStakes: AccountsStakes): any {
  const readable: AccountsStakesReadable = {}
  for (const account of Object.keys(accountsStakes)) {
    readable[account] = []
    for (const stake of accountsStakes[account]) {
      const readableStake: ReadableStake = {
        value: stake.value.toString(),
        timestamp: stake.timestamp
      }

      readable[account].push(readableStake)
    }
  }
  return readable
}

async function buildReportPath (blockTimestamp: number, filename: string): Promise<string> {
  const date = new Date(blockTimestamp * 1000)
  const dir = path.join(process.cwd(), 'data', 'stake-snapshots', date.toISOString())

  if (!fs.existsSync(dir)) {
    console.log('Creating reports directory:', dir)
    fs.mkdirSync(dir, { recursive: true })
  }

  const filepath = path.join(dir, filename)

  if (fs.existsSync(filepath)) {
    console.log('Will overwrite filepath:', filepath)
    fs.mkdirSync(dir, { recursive: true })
  }

  return filepath
}

export async function generateAuthAccountsReport (
  staking: StakingMock,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'authorizedAccounts.json')

  const authorizedAccounts = staking.allAuthorizedAccounts(blockTimestamp)
  const authAccountsReport = {
    snapshotBlockNumber,
    authorizedAmount: staking.authAmount.toString(),
    authorizedPeriod: staking.authPeriod,
    authorizedAccounts
  }

  console.log('[Report] Saving authorized accounts to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(authAccountsReport, null, 2))
}

export async function generateAuthAccountsWithBalancesReport (
  staking: StakingMock,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'authorizedAccountsStakeBalances.json')

  const authorizedAccounts = staking.allAuthorizedAccounts(blockTimestamp)
  const authorizedAccountsStakeBalances = authorizedAccounts.map(function (account) {
    return {
      account: account,
      stakeBalance: staking.depositSum(account).toString()
    }
  })

  const authAccountsWithBalancesReport = {
    snapshotBlockNumber,
    authorizedAmount: staking.authAmount.toString(),
    authorizedPeriod: staking.authPeriod,
    authorizedAccountsStakeBalances
  }

  console.log('[Report] Saving authorized accounts with balances to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(authAccountsWithBalancesReport, null, 2))
}

export async function generateDepositsReport (
  staking: StakingMock,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const allStakesFile = await buildReportPath(blockTimestamp, 'deposits.json')

  const accountsStakes = makeAccountsStakesReadable(staking.deposits)

  const allStakesReport = {
    snapshotBlockNumber,
    accountsStakes
  }

  console.log('[Report] Saving all stakes state to:', allStakesFile)
  fs.writeFileSync(allStakesFile, JSON.stringify(allStakesReport, null, 2))
}

export async function generateBonusesReport (
  staking: StakingPeriods,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'BonusesReport.json')

  // airdrop calculations
  const airdrop = new AirdropShares(staking)

  const authorizedAccountsBonuses = airdrop.allAuthorizedAccounts.map(function (account) {
    return {
      account: account,
      bonus: airdrop.accountBonus(account).toFixed(64)
    }
  })

  const authAccountsWithBalancesReport = {
    snapshotBlockNumber,
    startTimestamp: staking.startTimestamp,
    airdropTimestamp: staking.airdropTimestamp,
    authorizedAmount: staking.authAmount.toString(),
    authorizedPeriod: staking.authPeriod,
    authorizedAccountsBonuses
  }

  console.log('[Report] Saving bonuses report to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(authAccountsWithBalancesReport, null, 2))
}

export async function generateFullSharesReport (
  staking: StakingPeriods,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'FullSharesReport.json')

  const readableStakes = makeAccountsStakesReadable(staking.stakes)
  const readableUnstakes = makeAccountsStakesReadable(staking.unstakes)

  // airdrop calculations
  const airdrop = new AirdropShares(staking)

  const authorizedAccountsDetailedShares = airdrop.allAuthorizedAccounts.map(function (account) {
    return {
      account: account,
      stakes: readableStakes[account],
      unstakes: readableUnstakes[account],
      stakeBalance: staking.depositSum(account).toString(),
      calculationDetails: airdrop.calculationDetails(account)
    }
  })

  const authAccountsWithBalancesReport = {
    snapshotBlockNumber,
    startTimestamp: staking.startTimestamp,
    airdropTimestamp: staking.airdropTimestamp,
    authorizedAmount: staking.authAmount.toString(),
    authorizedPeriod: staking.authPeriod,
    globalCalculationDetails: airdrop.globalCalculationDetails(),
    airdropChecks: {
      sharesSum: airdrop.checkSharesSum().toFixed(0)
    },
    authorizedAccountsDetailedShares
  }

  console.log('[Report] Saving full shares report to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(authAccountsWithBalancesReport, null, 2))
}

export async function generateAirdropVestingShares (
  staking: StakingPeriods,
  snapshotBlockNumber: number
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'airdrop_shares.json')

  // airdrop calculations
  const airdrop = new AirdropShares(staking)

  // validate calculated shares
  airdrop.checkSharesSum()

  const wallets = airdrop.allAuthorizedAccounts.map(function (account) {
    return {
      account: account,
      share: airdrop.share(account).toFixed(0)
    }
  })

  console.log('[Report] Saving airdrop shares to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(wallets, null, 2))
}

export async function generateAirdropResult (
  staking: StakingPeriods,
  snapshotBlockNumber: number,
  airdroppedAmount: string
): Promise<void> {
  const blockTimestamp = await getBlockTime(snapshotBlockNumber)
  const filepath = await buildReportPath(blockTimestamp, 'airdrop_results.json')

  // airdrop calculations
  const airdrop = new AirdropShares(staking)

  // validate calculated shares
  airdrop.checkSharesSum()

  const wallets = airdrop.allAuthorizedAccounts.map(function (account) {
    return {
      account: account,
      amount: airdrop.share(account).mul(airdroppedAmount).div(1e36).floor().toFixed(0)
    }
  })

  console.log('[Report] Saving airdrop results to:', filepath)
  fs.writeFileSync(filepath, JSON.stringify(wallets, null, 2))
}
