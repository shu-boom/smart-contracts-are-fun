// Writing a Contract That Handles Ether
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
   Time locked savings account 
*/
contract TimeLock {
    mapping(address => uint) public vault;
    mapping(address => uint) public deadlock;
    address owner;
    
    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    function deposit(uint _amount, uint _deadlock) public payable {
        require(msg.value == _amount, "Value transferred incorrect");
        // We only add deadlock for a fresh deposit 
        if (vault[msg.sender] == 0) {
            deadlock[msg.sender] = _deadlock * 1 days;
        }
        vault[msg.sender] = vault[msg.sender] + _amount;
    }

    function withdraw(uint amount) public payable {
        require(amount>0, "Please provide an amount");
        require(amount<=vault[msg.sender], "Witdraw amount larger than stored amount");
        require(block.timestamp > deadlock[msg.sender], "Keep Saving");
        vault[msg.sender] = vault[msg.sender] - amount;
        payable(msg.sender).transfer(amount);
    }

    function getBalance() public view returns(uint){
        return address(this).balance;
    }
}
