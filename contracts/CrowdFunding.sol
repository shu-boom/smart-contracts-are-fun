// Writing a Contract That Handles Ether
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
  Crowd-funding contract 
  This contract takes the total amount of days and a goal. If the goal is met in the desired amount of time then it allows the owner of the contract to takes the money. 
  Otherwise, each pledger can get the refund
*/
contract CrowdFunding {
    address owner;
    uint goal;
    uint fundingDays;
    mapping(address => uint) pledges;

    constructor(uint _fundingDays, uint _goal){
        owner = msg.sender;
        goal = _goal;
        fundingDays = block.timestamp + (_fundingDays * 1 days);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    function pledge(uint value) public payable {
        require(msg.value == value, "Value specified and sent not equal");
        require(block.timestamp <= fundingDays, "Funding not open anymore");
        pledges[msg.sender] += value;
    }

    function getRefund() public payable {
        require(block.timestamp > fundingDays, "Funding period is still active");
        require(address(this).balance < goal, "Goal is met");
        payable(msg.sender).transfer(pledges[msg.sender]);
        pledges[msg.sender] = 0;
    }

    function takeDonation() public payable onlyOwner {
        require(block.timestamp >= fundingDays, "Funding period is still active");
        require(address(this).balance > goal, "Goal is met");
        payable(owner).transfer(address(this).balance);
    }
}
