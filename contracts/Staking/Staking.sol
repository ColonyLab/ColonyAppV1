// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./TimedValuesStorage.sol";

/**
 * Main Staking contract, used for staking CLY tokens and manage stake requirements
 */
contract Staking is Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Token that is supported by this contract. Should be registered in constructor
    IERC20Metadata private stakedToken;

    // Storage for accounts Stake data
    TimedValuesStorage private stakeDeposits;

    // holds precalculated TimedValuesStorage depositSums
    mapping(address => uint256) private depositSums;

    // amount of stake required by featured account
    uint256 public authorizedStakeAmount;

    // period in seconds of required stake for account to be featured
    uint256 public authorizedStakePeriod;

    event StakeAdded(address indexed account, uint256 value);
    event StakeRemoved(address indexed account, uint256 value);

    event AuthStakeAmountChanged(uint256 newStakeValue);
    event AuthStakePeriodChanged(uint256 newPeriod);

    /**
     * @dev Constructor
     * @param supportedToken_ The address of token contract
     */
    constructor(address supportedToken_, uint256 authorizedStakeAmount_, uint256 authorizedStakePeriod_) {
        require(supportedToken_ != address(0), "supported token cannot be 0x0");
        stakedToken = IERC20Metadata(supportedToken_);
        authorizedStakeAmount = authorizedStakeAmount_;
        authorizedStakePeriod = authorizedStakePeriod_;

        stakeDeposits = new TimedValuesStorage();
        stakeDeposits.setMaxDepositArrayLength(100);
    }

    /**
     * @dev totalStaked
     * @return total stake kept under this contract
     */
    function totalStaked() public view returns (uint256) {
        return stakedToken.balanceOf(address(this));
    }

    /**
     * @dev stakedBalanceOf public function which gets account stake balance,
     * using precalculated sums (optimal)
     * @return stake balance for given account
     */
    function stakedBalanceOf(address account) public view returns (uint256) {
        return depositSums[account];
    }

    /**
     * @dev recalculatedBalanceOf public function which gets account stake balance,
     * using TimedValuesStorage deposit, iteration over the whole array of stakes
     * @return stake balance for given account
     */
    function recalculatedBalanceOf(address account) public view returns (uint256) {
        return stakeDeposits.depositSum(account);
    }

    /**
     * @dev authStakedBalanceOf calculate total authorized stake older than authorizedStakePeriod
     * @notice less optinal than isAccountAuthorized check and still may not meet authorizedStakeAmount requirement
     * @return amount of account total authorized stake balance
     */
    function authStakedBalanceOf(address account) public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        uint256 maxTimestamp = block.timestamp - authorizedStakePeriod;
        return stakeDeposits.valueStoredLongEnough(account, maxTimestamp);
    }

    /**
     * @dev check if account stake pass authorizedStakeAmount and authorizedStakePeriod
     * @return boolean - is the account authorized?
     */
    function isAccountAuthorized(address account) public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        uint256 maxTimestamp = block.timestamp - authorizedStakePeriod;
        return stakeDeposits.isStoredLongEnough(account, authorizedStakeAmount, maxTimestamp);
    }

    /**
     * @dev calculates the time in seconds which must elapse for the account to be authorized (to meet authorizedStakePeriod)
     * @return boolean - will the account be authorized?
     * false means that the account will not be authorized because of insufficient stake
     * @return uint256 - estimated time in seconds
     */
    function timeRemainingAuthorization(address account) public view returns (bool, uint256) {
        // solhint-disable-next-line not-rely-on-time
        uint256 maxTimestamp = block.timestamp - authorizedStakePeriod;
        return stakeDeposits.timeLeftToMeetRequirements(account, authorizedStakeAmount, maxTimestamp);
    }

    /**
     * @dev gets stakes Limit set on stakeDeposit
     */
    function getMaxNumOfStakes() public view returns (uint256) {
        return stakeDeposits.maxDepositArrayLength();
    }

    /**
     * @dev Helper which returns real deposit length for given account
     */
    function getAccountRealDepositLength(address account) public view returns (uint256) {
        return stakeDeposits.realDepositsLength(account);
    }

    /**
     * @dev Helper which returns allocated deposit length for given account
     */
    function getAccountAllocDepositLength(address account) public view returns (uint256) {
        return stakeDeposits.allocDepositLength(account);
    }

    /**
     *  @notice Pauses stake and unstake functionalities
     */
    function pauseStaking() external onlyOwner whenNotPaused {
        super._pause();
    }

    /**
     *  @notice Resumes stake and unstake functionalities
     */
    function unpauseStaking() external onlyOwner whenPaused {
        super._unpause();
    }

    /**
     * @dev setAuthorizedStakeAmount - allows to set new authorizedStakeAmount value
     * @param stake_ - new stake
     *
     * Emits a {AuthStakeAmountChanged} event
     */
    function setAuthorizedStakeAmount(uint256 stake_) external onlyOwner {
        authorizedStakeAmount = stake_;
        emit AuthStakeAmountChanged(stake_);
    }

    /**
     * @dev setAuthorizedStakePeriod - allows to set new authorizedStakePeriod value
     * @param period_ - new period in seconds
     *
     * Emits a {AuthStakePeriodChanged} event
     */
    function setAuthorizedStakePeriod(uint256 period_) external onlyOwner {
        authorizedStakePeriod = period_;
        emit AuthStakePeriodChanged(period_);
    }

    /**
     * @dev sets a new Limit for amount of stakes on stakeDeposit
     */
    function setMaxNumOfStakes(uint256 newLimit) external onlyOwner {
        stakeDeposits.setMaxDepositArrayLength(newLimit);
    }

    /**
     * @dev Stake tokens inside stakeDeposit
     *
     * Emits a {StakeAdded} event
     */
    function stake(uint256 amount) public whenNotPaused {
        stakeFor(msg.sender, amount);
    }

    /**
     * @dev StakeFor sends tokens to another address stake
     *
     * Emits a {StakeAdded} event
     */
    function stakeFor(address receiver, uint256 amount) public whenNotPaused {
        require(amount > 0, "Staking: cannot stake 0");

        // will transfer tokens to this contract (require approve)
        IERC20(stakedToken).safeTransferFrom(msg.sender, address(this), amount);

        stakeDeposits.pushValue(receiver, amount);
        depositSums[receiver] += amount;

        uint256 check = stakedBalanceOf(receiver);
        require(check >= authorizedStakeAmount, "Staking: stake too small");

        emit StakeAdded(receiver, amount);
    }

    /**
     * @dev Unstake sends staked tokens back to the sender
     *
     * Emits a {StakeRemoved} event
     */
    function unstake(uint256 amount) public whenNotPaused {
        require(amount > 0, "Staking: cannot unstake 0");
        require(depositSums[msg.sender] >= amount, "Staking: amount exceeds balance");

        if (depositSums[msg.sender] == amount) {
            stakeDeposits.removeAll(msg.sender);
        }
        else {
            stakeDeposits.removeValue(msg.sender, amount);
        }
        depositSums[msg.sender] -= amount;

        // will transfer tokens to the caller
        IERC20(stakedToken).safeTransfer(msg.sender, amount);

        emit StakeRemoved(msg.sender, amount);
    }
}
