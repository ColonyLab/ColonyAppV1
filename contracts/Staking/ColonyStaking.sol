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

    // amount of stake required by featured account
    uint256 public authorizedStakeAmount;

    // period in DAYS of required stake for account to be featured
    uint16 public authorizedStakePeriod;

    event StakeAdded(address indexed account, uint256 value);
    event StakeRemoved(address indexed account, uint256 value);

    event AuthStakeAmountChanged(uint256 newStakeValue);
    event AuthStakePeriodChanged(uint16 newDays);

    /**
     * @dev Constructor
     * @param supportedToken_ The address of token contract
     */
    constructor(address supportedToken_, uint256 authorizedStakeAmount_, uint16 authorizedStakePeriod_) {
        require(supportedToken_ != address(0), "supported token cannot be 0x0");
        stakedToken = IERC20Metadata(supportedToken_);
        authorizedStakeAmount = authorizedStakeAmount_;
        authorizedStakePeriod = authorizedStakePeriod_;

        stakeDeposits = new TimedValuesStorage();
    }

    /**
     * @dev totalStaked
     * @return total stake kept under this contract
     */
    function totalStaked() public view returns (uint256) {
        return stakedToken.balanceOf(address(this));
    }

    /**
     * @dev stakeBalanceOf public function which gets account stake balance
     * @return stake balance for given account
     */
    function stakeBalanceOf(address account) public view returns (uint256) {
        return stakeDeposits.depositSum(account);
    }

    /**
     * @dev calculate total authorized stake older than authorizedStakePeriod
     * @notice less optinal than isAccountAuthorized check and still may not meet authorizedStakeAmount requirement
     * @return amount of account total authorized stake balance
     */
    function authStakeBalanceOf(address account) public view returns (uint256) {
        // 86400 - number of seconds in a day
        // solhint-disable-next-line not-rely-on-time
        uint256 maxTimestamp = block.timestamp - (86400 * authorizedStakePeriod);
        return stakeDeposits.valueStoredLongEnough(account, maxTimestamp);
    }

    /**
     * @dev check if account stake pass authorizedStakeAmount and authorizedStakePeriod
     * @return boolean
     */
    function isAccountAuthorized(address account) public view returns (bool) {
        // 86400 - number of seconds in a day
        // solhint-disable-next-line not-rely-on-time
        uint256 maxTimestamp = block.timestamp - (86400 * authorizedStakePeriod);
        return stakeDeposits.isStoredLongEnough(account, authorizedStakeAmount, maxTimestamp);
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
     * @param period_ - new period in days
     *
     * Emits a {AuthStakePeriodChanged} event
     */
    function setAuthorizedStakePeriod(uint16 period_) external onlyOwner {
        authorizedStakePeriod = period_;
        emit AuthStakePeriodChanged(period_);
    }

    /**
     * @dev Stake tokens inside stakeDeposit
     * @return a boolean value indicating whether the operation succeeded
     *
     * Emits a {StakeAdded} event
     */
    function stake(uint256 amount) public whenNotPaused returns (bool) {
        return stakeFor(msg.sender, amount);
    }

    /**
     * @dev StakeFor sends tokens to another address stake
     * @return a boolean value indicating whether the operation succeeded
     *
     * Emits a {StakeAdded} event
     */
    function stakeFor(address receiver, uint256 amount) public whenNotPaused returns (bool) {
        require(amount > 0, "Staking: cannot stake 0");

        // will transfer tokens to this contract (require approve)
        IERC20(stakedToken).safeTransferFrom(msg.sender, address(this), amount);

        stakeDeposits.pushValue(receiver, amount);

        uint256 check = stakeBalanceOf(receiver);
        require(check >= authorizedStakeAmount, "Staking: stake too small");

        emit StakeAdded(receiver, amount);
        return true;
    }

    /**
     * @dev Unstake sends staked tokens back to the sender
     * @return a boolean value indicating whether the operation succeeded
     *
     * Emits a {StakeRemoved} event
     */
    function unstake(uint256 amount) public whenNotPaused returns (bool) {
        require(amount > 0, "Staking: cannot unstake 0");

        uint256 amountToUnstake = amount;

        _unstake(msg.sender, amountToUnstake);

        // will transfer tokens to the caller
        IERC20(stakedToken).safeTransfer(msg.sender, amountToUnstake);

        emit StakeRemoved(msg.sender, amountToUnstake);
        return true;
    }

    /**
     * @dev Unstake the whole amount
     */
    function _unstakeAll(address account) internal {
        stakeDeposits.removeAll(account);
    }

    /**
     * @dev Unstake all or partial depending on the amount
     */
    function _unstake(address account, uint256 amount) internal {
        uint256 accStake = stakeDeposits.depositSum(account);
        require(amount <= accStake, "Unstake: amount exceeds balance");

        if (accStake == amount) {
            _unstakeAll(account);
            return;
        }

        stakeDeposits.removeValue(account, amount);
    }
}
