// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 *  @title Vesting contract
 ***********************************
 *  @notice Makes tokens available to claim for addresses according to specified distribution rules.
 *
 *  Vesting rules are defined within user groups. Users are added to a group with vesting amount that is to be
 *  distributed according to group rules.
 *  Contract has to have balance prior to make groups possible to be set. Groups have to be set before users are
 *  possible to be set.
 *
 *  The vesting process can be paused and unpaused any time.
 *  The vesting process can be closed permanently and all remaining tokens can be withdrawn from the contract.
 */
contract Vesting is Ownable, Pausable {

    using SafeERC20 for IERC20;


    /**************************************
     *  PROPERTIES, DATA STRUCTS, EVENTS  *
     **************************************/

    bool public vestingStarted;             // true when the vesting procedure has started
    uint public vestingStartTimestamp;      // the starting timestamp of vesting schedule
    bool public vestingScheduledForClosing; // true when the admin schedules vesting for closing
    uint public vestingCloseTimestamp;      // the time when vesting is closed and no more claims can be made
    uint public vestingCloseOffset;         // offset in seconds when the admin is allowed to close vesting after last group vesting ends
    uint public vestingCloseMargin;         // adds additional offset in s after closeVesting() how long users will still be able to claim tokens
    IERC20 public vestingToken;             // the address of an ERC20 token used for vesting

    // holds user groups configuration and data
    GroupData[] public groupsConfiguration;
    // holds user vesting data
    mapping (address => UserData) public userConfiguration;

    struct UserData {
        uint groupId;                    // Id of group
        uint vestAmount;                 // The total number of tokens that are vested
        uint withdrawnAmount;            // The current amount of already withdrawn tokens
    }

    struct GroupData {
        string name;                     // Name of group
        uint distributionAmount;         // The amount of tokens that can be distributed within this group
        uint vestedAmount;               // The actual number of tokens currently assigned for distribution
        uint distributionStartOffset;    // The offset of distribution start from vesting start timestamp
        uint distributionLength;         // The total length in ms of distribution.
        uint initialRelease;             // The mantissa of the tokens to be distributed when vesting begins
    }

    event VestingStarted();
    event VestingScheduledForClosing(uint closeTimestamp);
    event UserDataSet(address user, uint groupId, uint vestAmount);
    event GroupDataSet(
        uint groupId,
        string groupName,
        uint maxDistributionAmount,
        uint distributionOffset,
        uint distributionLength,
        uint initialRelease
    );
    event TokensClaimed(address user, uint groupId, uint amount);
    event TokensReclaimed(address initiator, address receiver, uint amount);




    /**
     *  @param vestingTokenAddress - the address of the token used for distribution
     *  @param closeOffset        - offset in seconds when the contract can be closed after all groups vesting ends
     *  @param closeMargin        - additional offset after vesting is scheduled for closing
     */
    constructor(address vestingTokenAddress, uint closeOffset, uint closeMargin) {
        require(vestingTokenAddress != address(0), "Vesting token address invalid!");
        vestingToken = IERC20(vestingTokenAddress);
        vestingStarted = false;
        vestingScheduledForClosing = false;
        vestingCloseOffset = closeOffset;
        vestingCloseMargin = closeMargin;
    }





    /********************
     *  CONTRACT LOGIC  *
     ********************/

    /**
     *  @notice claims all available tokens
     */
    function claimAll() external afterVestingStarted beforeVestingClosed whenNotPaused {
        claim(checkClaim(msg.sender));
    }

    /**
     *  @notice transfers the specified amount of tokens to the claimer. Reverts when the amount exceeds available.
     *  @param amount - the amount of tokens to be claimed
     */
    function claim(uint amount) public afterVestingStarted beforeVestingClosed whenNotPaused {
        require(checkClaim(msg.sender) >= amount, "Claim amount too high!");

        userConfiguration[msg.sender].withdrawnAmount = userConfiguration[msg.sender].withdrawnAmount + amount;
        vestingToken.transfer(msg.sender, amount);

        emit TokensClaimed(msg.sender, userConfiguration[msg.sender].groupId, amount);
    }

    /**
     *  @notice checks how many tokens can be claimed by the given account address
     *  @param account - the wallet address to be checked
     *  @return the amount of tokens that can be claimed
     */
    function checkClaim(address account) public view returns (uint) {
        UserData storage userData = userConfiguration[account];
        GroupData storage groupData = groupsConfiguration[userData.groupId];

        uint initialReleaseShare;
        // if vesting started check the initial release amount
        if (vestingStarted && vestingStartTimestamp <= block.timestamp) {
            initialReleaseShare = groupData.initialRelease * userData.vestAmount / 1e18;
        }

        // return only the initial release share when vesting for group has not started yet
        if (block.timestamp <= (vestingStartTimestamp + groupData.distributionStartOffset)) {
            return initialReleaseShare - userData.withdrawnAmount;
        }

        // return all available amount of unclaimed tokens if the vesting ended
        if ((block.timestamp - (vestingStartTimestamp + groupData.distributionStartOffset)) >= groupData.distributionLength ) {
            return userData.vestAmount - userData.withdrawnAmount;
        }

        // or calculate the amount of tokens when vesting is in progress
        return
            initialReleaseShare +
            (
                (block.timestamp - (vestingStartTimestamp + groupData.distributionStartOffset))
                * 1e18
                / groupData.distributionLength
                * (userData.vestAmount - initialReleaseShare)
                / 1e18
            )
            - userData.withdrawnAmount;
    }




    /******************************
     *  ADMINISTRATIVE FUNCTIONS  *
     ******************************/

    /**
     *  @notice sets the group settings for token distribution. Can only be set before vesting started.
     *  @param groupName                  - the semantic name of group
     *  @param distributionAmount      - the total amount of tokens that can be distributed to this group users
     *  @param distributionStartOffset    - the offset in seconds between contracts starting timestamp and group distribution
     *  @param distributionLength         - the time in seconds
     *  @return                           - the id of newly added group
     */
    function _setGroup(
        string memory groupName,
        uint distributionAmount,
        uint distributionStartOffset,
        uint distributionLength,
        uint initialRelease
    ) external onlyOwner beforeVestingStarted returns(uint) {
        require(distributionAmount > 0, "Invalid Distribution Amount!");
        require(distributionLength > 0, "Invalid Distribution Lenght!");
        require(initialRelease <= 1e18, "Invalid Initial Release!");

        uint sumDistributionAmount = 0;
        for (uint i; i < groupsConfiguration.length; i++) {
            sumDistributionAmount += groupsConfiguration[i].distributionAmount;
        }
        require(distributionAmount + sumDistributionAmount <= vestingToken.balanceOf(address(this)), "Distribution amount too big!");

        GroupData memory groupData;
        groupData.name = groupName;
        groupData.distributionAmount = distributionAmount;
        groupData.distributionStartOffset = distributionStartOffset;
        groupData.distributionLength = distributionLength;
        groupData.initialRelease = initialRelease;

        groupsConfiguration.push(groupData);
        uint groupId = groupsConfiguration.length - 1;
        emit GroupDataSet(groupId, groupName, distributionAmount, distributionStartOffset, distributionLength, initialRelease);

        return groupId;
    }

    /**
     *  @notice configures the vesting for specified user. Can only be set before vesting started.
     *  @param account    - the address for which we are configuring vesting
     *  @param groupId    - the ID of the group which the user should belong to
     *  @param vestAmount - the amount of tokens to be distributed
     */
    function _setUser(address account, uint groupId, uint vestAmount) public onlyOwner beforeVestingStarted {
        require(account != address(0), "Wrong wallet address specified!");
        require(groupId < groupsConfiguration.length, "Invalid groupId!");
        require(
            vestAmount <= groupsConfiguration[groupId].distributionAmount - groupsConfiguration[groupId].vestedAmount,
            "Vesting amount too high!"
        );

        // recalculate grups vested amount if updating user
        if (userConfiguration[account].vestAmount > 0) {
            groupsConfiguration[userConfiguration[account].groupId].vestedAmount -= userConfiguration[account].vestAmount;
        }

        UserData memory userData;
        userData.groupId = groupId;
        userData.vestAmount = vestAmount;
        userConfiguration[account] = userData;

        groupsConfiguration[groupId].vestedAmount += vestAmount;

        emit UserDataSet(account, groupId, vestAmount);
    }

    /**
     *  @notice provides a convenient interface for adding users in bulk. See _setUser() for additional info.
     *  @param accounts    - array of accounts
     *  @param groupIds    - array of groupIds
     *  @param vestAmounts - array of vesting amounts
     */
    function _setUserBulk(address[] memory accounts, uint[] memory groupIds, uint[] memory vestAmounts) external onlyOwner beforeVestingStarted {
        require(accounts.length == groupIds.length && groupIds.length == vestAmounts.length, "Invalid array lengths!");
        for (uint i = 0; i < accounts.length; i++) {
            _setUser(accounts[i], groupIds[i], vestAmounts[i]);
        }
    }

    /**
     *  @notice Starts the vesting schedule.
     *  Since we cannot modify any vesting rules after vesting starts, we return the unallocated token amount to the
     *  provided wallet address.
     *  @param timestamp    - the vesting starting time. if timestamp = 0 the vesting starts this block
     *  @param returnWallet - the wallet address for returning unallocated funds
     */
    function _startVesting(uint timestamp, address returnWallet) external onlyOwner beforeVestingStarted {
        require(timestamp == 0 || timestamp > block.timestamp, "Invalid vesting start!");
        require(vestingToken.balanceOf(address(this)) > 0, "Vesting Contract has no balance!");
        require(groupsConfiguration.length > 0, "No groups configured!");
        require(returnWallet != address(0), "Return wallet not specified!");

        vestingStarted = true;

        if (timestamp == 0) {
            vestingStartTimestamp = block.timestamp;
        } else {
            vestingStartTimestamp = timestamp;
        }

        uint vestedTotalAmount = 0;
        for (uint i; i < groupsConfiguration.length; i++) {
            vestedTotalAmount += groupsConfiguration[i].vestedAmount;
        }
        uint difference = vestingToken.balanceOf(address(this)) - vestedTotalAmount;
        if (difference > 0) {
            vestingToken.transfer(returnWallet, difference);
        }

        emit VestingStarted();
    }

    /**
     *  @notice Pauses the ability to claim tokens from vesting contract
     */
    function _pauseVesting() external onlyOwner afterVestingStarted whenNotPaused {
        _pause();
    }

    /**
     *  @notice Resumes the ability to claim tokens from vesting contract
     */
    function _unpauseVesting() external onlyOwner afterVestingStarted whenPaused {
        _unpause();
    }

    /**
     *  @notice checks if a defined time has passed since ending of all groups vesting and schedules the vesting for closing
     *  If no time is specified in vestingCloseMargin the vesting is closed immediately
     */
    function _closeVesting() external onlyOwner afterVestingStarted beforeVestingClosed {
        uint groupVestingEndTimestamp = _lastGroupDistributionFinishTimestamp();
        require(groupVestingEndTimestamp + vestingCloseOffset < block.timestamp, "Cannot close vesting!");
        vestingScheduledForClosing = true;
        vestingCloseTimestamp = block.timestamp + vestingCloseMargin;
        emit VestingScheduledForClosing(vestingCloseTimestamp);
    }


    /**
     *  @notice calculates the ending timestamp of last group's distribution schedule
     *  @return the last schedule end timestamp
     */
    function _lastGroupDistributionFinishTimestamp() internal view returns (uint) {
        uint groupVestingEndTimestamp;
        for (uint i; i < groupsConfiguration.length; i++) {
            uint closeTimestamp =
            vestingStartTimestamp
            + groupsConfiguration[i].distributionStartOffset
            + groupsConfiguration[i].distributionLength;
            if (closeTimestamp > groupVestingEndTimestamp) {
                groupVestingEndTimestamp = closeTimestamp;
            }
        }
        return groupVestingEndTimestamp;
    }

    /**
     *  @notice reclaims the unclaimed token balance from this contract to admin address
     *  Executable only when vesting is closed.
     *  @param receiver - the address to which the contract balance is sent
     */
    function _reclaim(address receiver) public onlyOwner afterVestingClosed {
        uint contractBalance = vestingToken.balanceOf(address(this));
        vestingToken.transfer(receiver, contractBalance);
        emit TokensReclaimed(msg.sender, receiver, contractBalance);
    }




    /***************
     *  MODIFIERS  *
     ***************/

    modifier afterVestingStarted {
        require(vestingStarted, "Vesting has not started!");
        _;
    }
    modifier beforeVestingStarted {
        require(!vestingStarted, "Vesting has already started!");
        _;
    }
    modifier beforeVestingClosed {
        require(
            vestingCloseTimestamp == 0
            || vestingCloseTimestamp > block.timestamp,
            "Vesting has been closed!"
        );
        _;
    }
    modifier afterVestingClosed {
        require(
            vestingCloseTimestamp != 0
            && vestingCloseTimestamp <= block.timestamp,
            "Vesting has not been closed!"
        );
        _;
    }
}