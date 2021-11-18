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

    // TimedValue mapping structure, storing TimedValue for all accounts
    mapping(address => TimedValue[]) private deposits;

    // require non empty deposit for given account
    modifier nonEmpty(address account) {
        require(deposits[account].length > 0, "no item found");
        _;
    }

    /**
     * @dev Gets the whole value balance for the specified address, by iterating on array
     * @return An uint256 representing the balance owned by the passed address
     */
    function depositSum(address account) public view returns (uint256) {
        uint256 totalAccValue;

        for (uint i = 0; i < deposits[account].length; i++) {
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

        for (uint i = 0; i < deposits[account].length; i++) {
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

        for (uint i = 0; i < deposits[account].length; i++) {
            if (deposits[account][i].timestamp > maxTimestamp) {
                break;
            }

            totalValue += deposits[account][i].value;
        }

        return totalValue;
    }

    /**
     * @dev Helper, gets the last value
     * @return last account value
     */
    function _getLastValue(address account) private view nonEmpty(account) returns (uint256) {
        uint256 lastIdx = deposits[account].length - 1;
        return deposits[account][lastIdx].value;
    }

    /**
     * @dev Push a new Value at the end of account TimedValue array
     */
    function pushValue(address account, uint256 value) external onlyOwner {
        TimedValue memory timedValue = TimedValue({
            value: value,
            // solhint-disable-next-line not-rely-on-time
            timestamp: block.timestamp // used for a long period of time (x days)
        });

        deposits[account].push(timedValue);
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
            } else {
                _decreaseLastValue(account, leftToRemove);
                leftToRemove = 0;
            }
        }
    }

    /**
     * @dev Removes the whole account deposit
     */
    function removeAll(address account) external nonEmpty(account) onlyOwner {
        delete deposits[account];
    }

    /**
     * @dev Remove the last record from account deposit,
     * @return removed value
     */
    function _removeLastValue(address account) private nonEmpty(account) returns (uint256) {
        uint256 valueToRemove = _getLastValue(account);

        deposits[account].pop();

        return valueToRemove;
    }

    /**
     * @dev Decrease / Update last value
     * @notice requires that decreaseValue is not equal to the last value (in that case remove should be used)
     */
    function _decreaseLastValue(address account, uint256 decreaseValue) private nonEmpty(account) {
        uint256 lastIdx = deposits[account].length - 1;
        uint256 lastValue = deposits[account][lastIdx].value;
        require(decreaseValue < lastValue, "decrease should be smaller");

        deposits[account][lastIdx].value = lastValue - decreaseValue;
    }
}
