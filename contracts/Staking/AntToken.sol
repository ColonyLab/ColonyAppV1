// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract AntToken is ERC20, Ownable, ERC20Permit {
    mapping(address => bool) private privileged;

    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("ANT Token", "ANT") ERC20Permit("ANT Token") { }

    function mint(address to, uint256 amount) public onlyPrivileged {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyPrivileged {
        _burn(from, amount);
    }

    function updatePrivileged(address account, bool enabled) public onlyOwner {
        privileged[account] = enabled;
    }

    modifier onlyPrivileged() {
        require(privileged[_msgSender()] == true, "Caller is not privileged");
        _;
    }
}
