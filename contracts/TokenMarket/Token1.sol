// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ERC20.sol";

contract Token1 is ERC20 {
    constructor(string memory _name, string memory _symbol, uint _decimals) ERC20(_name, _symbol, _decimals){
        _mint(100);
    }
}