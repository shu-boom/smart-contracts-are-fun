// Writing a Contract That Handles Ether
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
  Checking the Sender in a Smart Contract
*/
contract OwnershipInSolidityContract {
    address public owner;
    constructor (){
        owner = msg.sender;
    }   

  function getBalance() public view returns(uint){
      return address(this).balance;
  }

  function deposit(uint amount) public payable {
      require(amount == msg.value);
  }

  function withdraw() public {
      require(msg.sender==owner, "Only Owner");
      payable(msg.sender).transfer(address(this).balance);
  }

}
