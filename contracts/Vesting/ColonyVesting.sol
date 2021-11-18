// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 *  @title Colony Vesting contract
 ***********************************
 *  @notice Distributes tokens according to specified distribution rules.
 *
 *  Vesting rules are defined within user groups. Users are added to a group with vesting amount that is to be
 *  distributed according to group rules.
 *
 *  The vesting process can be paused and unpaused any time.
 */
contract ColonyVesting is Ownable, Pausable {

    using SafeERC20 for IERC20;


    /**************************************
     *  PROPERTIES, DATA STRUCTS, EVENTS  *
     **************************************/

    bool public vestingStarted;        // true when the vesting procedure has started
    uint public vestingStartTimestamp; // the starting timestamp of vesting schedule
    IERC20 public vestingToken;        // the address of an ERC20 token used for vesting

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
        uint vestedAmount;               // The actual number of vested tokens within this group
        uint distributionStartOffset;    // The offset of distribution start from vesting start timestamp
        uint distributionLength;         // The total length in ms of distribution.
    }

    event VestingStarted();
    event UserDataSet(address user, uint groupId, uint vestAmount);
    event GroupDataSet(
        uint groupId,
        string groupName,
        uint maxDistributionAmount,
        uint distributionOffset,
        uint distributionLength
    );
    event TokensClaimed(address user, uint groupId, uint amount);




    /**
     *  @param vestingTokenAddress - the address of the token used for distribution
     */
    constructor(address vestingTokenAddress) {
        require(vestingTokenAddress != address(0), "Vesting token address invalid!");
        vestingToken = IERC20(vestingTokenAddress);
        vestingStarted = false;
    }





    /********************
     *  CONTRACT LOGIC  *
     ********************/

    /**
     *  @notice transfers the specified amount of tokens to the claimer. Reverts when the amount exceeds available.
     *  @param amount - the amount of tokens to be claimed
     */
    function claim(uint amount) external afterVestingStarted whenNotPaused {
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
        UserData memory userData = userConfiguration[account];
        GroupData memory groupData = groupsConfiguration[userData.groupId];

        // return 0 if release has not started for this address yet
        if (block.timestamp <= (vestingStartTimestamp + groupData.distributionStartOffset)) {
            return 0;
        }

        // return all available amount of unclaimed tokens if the vesting ended
        if ((block.timestamp - (vestingStartTimestamp + groupData.distributionStartOffset)) >= groupData.distributionLength ) {
            return userData.vestAmount - userData.withdrawnAmount;
        }

        // or calculate the amount of tokens when vesting is in progress
        return
            (
                (block.timestamp - (vestingStartTimestamp + groupData.distributionStartOffset))
                * 1e18
                / groupData.distributionLength
                * userData.vestAmount
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
        uint distributionLength
    ) external onlyOwner beforeVestingStarted returns(uint) {
        require(distributionAmount > 0, "Invalid Distribution Amount!");
        require(distributionLength > 0, "Invalid Distribution Lenght!");

        GroupData memory groupData;
        groupData.name = groupName;
        groupData.distributionAmount = distributionAmount;
        groupData.distributionStartOffset = distributionStartOffset;
        groupData.distributionLength = distributionLength;

        groupsConfiguration.push(groupData);
        uint groupId = groupsConfiguration.length - 1;
        emit GroupDataSet(groupId, groupName, distributionAmount, distributionStartOffset, distributionLength);

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
        super._pause();
    }

    /**
     *  @notice Resumes the ability to claim tokens from vesting contract
     */
    function _unpauseVesting() external onlyOwner afterVestingStarted whenPaused {
        super._unpause();
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
}