// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract ColonyGovernanceToken is ERC20, ERC20Snapshot, Ownable, ERC20Permit, ERC20Votes {
    bool minted =  false;

    constructor() ERC20("Colony Token", "CLY") ERC20Permit("Colony") {

    }

    function initialMint(address publicSaleAddress, address privateSaleAddress, address vestingContractAddress)
    external
    onlyOwner
    {
        require(!minted, "Tokens have already been minted!");

        _mint(publicSaleAddress, 10500000 * 10 ** decimals());       //  10,5M
        _mint(privateSaleAddress, 7800000 * 10 ** decimals());       //   7,8M
        _mint(vestingContractAddress, 131700000 * 10 ** decimals()); // 131,7M
        minted = true;
        emit ColonyTokenMinted();
    }

    function snapshot() public onlyOwner {
        _snapshot();
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 amount)
    internal
    override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }

    event ColonyTokenMinted();
}