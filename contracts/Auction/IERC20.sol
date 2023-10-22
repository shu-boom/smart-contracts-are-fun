// ERC20 token contract
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
// IERC20 Interface
interface IERC20 {
    // Function to get the total supply of tokens
    function totalSupply() external view returns (uint256);

    // Function to get the balance of an address
    function balanceOf(address account) external view returns (uint256);

    // Function to transfer tokens to another address
    function transfer(address recipient, uint256 amount) external returns (bool);

    // Function to allow another address to spend tokens on your behalf
    function approve(address spender, uint256 amount) external returns (bool);

    // Function to check the allowance granted by an owner to a spender
    function allowance(address owner, address spender) external view returns (uint256);

    // Function to transfer tokens from one address to another with approval
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}