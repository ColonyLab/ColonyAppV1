// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * TimedValuesStorage
 * Stores and Operates on TimedValue arrays which works similar to stack (LIFO)
 * - new value for specified account is added at the end of his TimedValue array
 * - remove is done by .pop values from TimedValue array
 *
 * - supports time based checks for deposited values
 */
contract TimedValuesStorage is Ownable {

    // Struct which stores individual value with timestamp
    struct TimedValue {
       uint256 value;
       uint256 timestamp;
    }

    // limit on deposits TimedValue array length, which prevents reaching gas limit
    uint256 public maxDepositArrayLength;

    // additional length index for each of deposit TimedValue array,
    // which makes operations in deposits more optimal
    mapping(address => uint256) public realDepositsLength;

    // TimedValue mapping structure, storing TimedValue for all accounts
    mapping(address => TimedValue[]) private deposits;

    // require non empty deposit for given account
    modifier nonEmpty(address account) {
        require(realDepositsLength[account] > 0, "no item found");
        _;
    }

    /**
     * @dev Gets the whole value balance for the specified address, by iterating on array
     * @return An uint256 representing the balance owned by the passed address
     */
    function depositSum(address account) public view returns (uint256) {
        uint256 totalAccValue;

        for (uint i = 0; i < realDepositsLength[account]; i++) {
            totalAccValue += deposits[account][i].value;
        }

        return totalAccValue;
    }

    /**
     * @dev check if account value meets given requirements of minimum value
     * deposited up to the maxTimestamp date
     * @return boolean
     */
    function isStoredLongEnough(address account, uint256 minValue, uint256 maxTimestamp) external view returns (bool) {
        uint256 enoughValue;

        for (uint i = 0; i < realDepositsLength[account]; i++) {
            if (deposits[account][i].timestamp > maxTimestamp) {
                break;
            }

            enoughValue += deposits[account][i].value;

            if (enoughValue >= minValue) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev total value older than given maxTimestamp
     * @notice this function is less optimal than isStoredLongEnough check
     * @return uint256 totalValue
     */
    function valueStoredLongEnough(address account, uint256 maxTimestamp) external view returns (uint256) {
        uint256 totalValue;

        for (uint i = 0; i < realDepositsLength[account]; i++) {
            if (deposits[account][i].timestamp > maxTimestamp) {
                break;
            }

            totalValue += deposits[account][i].value;
        }

        return totalValue;
    }

    /**
     * @dev time left in seconds for given minValue to be older than given maxTimestamp
     * @notice time left depends on the youngest stake which is included to minValue
     * @return boolean - is the account deposit sum enough to pass minValue?
     * @return uint256 time in seconds, 0 if value is already older
     */
    function timeLeftToMeetRequirements(address account, uint256 minValue, uint256 maxTimestamp) external view returns (bool, uint256) {
        uint256 enoughValue;

        for (uint i = 0; i < realDepositsLength[account]; i++) {
            enoughValue += deposits[account][i].value;

            if (enoughValue >= minValue) {
                if (maxTimestamp >= deposits[account][i].timestamp) {
                    return (true, 0);
                }

                return (true, deposits[account][i].timestamp - maxTimestamp);
            }
        }
        return (false, 0);
    }

    /**
     * @dev Helper, gets the last value
     * @return last account value
     */
    function _getLastValue(address account) private view nonEmpty(account) returns (uint256) {
        uint256 lastIdx = realDepositsLength[account] - 1;
        return deposits[account][lastIdx].value;
    }

    /**
      * @dev Helper, returns allocated deposit array length
      */
    function allocDepositLength(address account) public view returns (uint256) {
        return deposits[account].length;
    }

    /**
      * @dev Helper, checks if max alloved array length is achieved
      */
    function maxDepositLengthAchieved(address account) public view returns (bool) {
        return realDepositsLength[account] >= maxDepositArrayLength;
    }

    /**
     * @dev sets a new maxDepositArrayLength limit
     */
    function setMaxDepositArrayLength(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "should have at least one value");
        maxDepositArrayLength = newLimit;
    }

    /**
     * @dev Push a new Value to deposits
     * @notice depends on realDepositsLength and maxDepositArrayLength, value could be
     * - simply pushed at the end of deposit TimedValuesStorage array
     * - added to existing value (but invalidated [removed]), by overwrite already allocated one
     * - if maxDepositArrayLength is reached, added to the last correct value (update timestamp)
     */
    function pushValue(address account, uint256 value) external onlyOwner {
        if (maxDepositLengthAchieved(account)) {
            // instead of adding a new value to the array and increasing its length, modify last value
            _increaseLastValue(account, value);
            return;
        }

        TimedValue memory timedValue = TimedValue({
            value: value,
            timestamp: block.timestamp // used for a long period of time
        });

        if (realDepositsLength[account] == allocDepositLength(account)) {
            deposits[account].push(timedValue);
            realDepositsLength[account]++;

        }
        else {
            // overwrite existing but removed value
            uint256 firstFreeIdx = realDepositsLength[account];
            deposits[account][firstFreeIdx] = timedValue;
            realDepositsLength[account]++;
        }
    }

    /**
     * @dev Removes given value from the TimedValue array
     * @notice One by one, starting from the last one
     */
    function removeValue(address account, uint256 value) external onlyOwner {
        uint256 leftToRemove = value;

        while (leftToRemove != 0) {
            uint256 lastValue = _getLastValue(account);

            if (leftToRemove >= lastValue) {
                uint256 removed = _removeLastValue(account);
                require(removed == lastValue, "removed value does not match");

                leftToRemove -= lastValue;
            }
            else {
                _decreaseLastValue(account, leftToRemove);
                leftToRemove = 0;
            }
        }
    }

    /**
     * @dev Removes the whole account deposit, by simply setting realDepositsLength to 0
     */
    function removeAll(address account) external nonEmpty(account) onlyOwner {
        realDepositsLength[account] = 0;
    }

    /**
     * @dev Remove the last record from account deposit,
     * @return removed value
     */
    function _removeLastValue(address account) private nonEmpty(account) returns (uint256) {
        uint256 valueToRemove = _getLastValue(account);

        realDepositsLength[account]--; // decrement realDepositsLength instead of pop

        return valueToRemove;
    }

    /**
     * @dev Increase / Update last value, set new timestamp
     */
    function _increaseLastValue(address account, uint256 increaseValue) private nonEmpty(account) {
        require(increaseValue != 0, "zero increase");
        uint256 lastIdx = realDepositsLength[account] - 1;

        deposits[account][lastIdx].value += increaseValue;
        deposits[account][lastIdx].timestamp = block.timestamp;
    }

    /**
     * @dev Decrease / Update last value, leave timestamp unchanged
     * @notice requires that decreaseValue is not equal to the last value (in that case remove should be used)
     */
    function _decreaseLastValue(address account, uint256 decreaseValue) private nonEmpty(account) {
        require(decreaseValue != 0, "zero decrease");
        uint256 lastIdx = realDepositsLength[account] - 1;

        uint256 lastValue = deposits[account][lastIdx].value;
        require(decreaseValue < lastValue, "decrease should be smaller");

        deposits[account][lastIdx].value = lastValue - decreaseValue;
    }
}
