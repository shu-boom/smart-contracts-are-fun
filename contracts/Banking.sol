// Writing a Contract That Handles Ether
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
  Banking contract 
*/
contract OwnershipInSolidityContract {
    mapping( address => uint) public vault;
    address owner;
    
    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    function deposit(uint amount) public payable {
        require(msg.value == amount, "Value transferred incorrect");
        vault[msg.sender] = vault[msg.sender] + amount;
    }

    function withdraw(uint amount) public payable {
        require(amount>0, "Please provide an amount");
        require(amount<=vault[msg.sender], "Witdraw amount larger than stored amount");
        vault[msg.sender] = vault[msg.sender] - amount;
        payable(msg.sender).transfer(amount);
    }

    function getBalance() public view returns(uint){
        return address(this).balance;
    }
}
