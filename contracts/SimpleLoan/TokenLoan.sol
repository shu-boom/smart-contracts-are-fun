// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ERC20.sol";
contract TokenLoan is ERC20 {
    constructor(uint _totalSupply) ERC20("BOOM Coin", "BOOM", 18) {
        _mint(_totalSupply);
    }
}