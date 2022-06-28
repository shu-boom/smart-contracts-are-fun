// ERC20 token contract
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IERC20.sol";
contract TokenSale {
    IERC20 tokenContract;
    uint price;
    address owner;
    event Sold(address buyer, uint amount);
    event TokenReturned(uint amount);
    event TokenBalance(uint amount);
    uint tokensSold;

    constructor(IERC20 _tokenContract, uint _price){
        owner = msg.sender;
        price = _price;
        tokenContract = _tokenContract;
    }

    // Function to buy tokens 
    function buyTokens(uint numberOfTokens) public payable{
        /*
            Constraint: Amount must be greater than 0 and equal to value              
            Context: User sends ether and be able to purchase equivalent quantity of Boom tokens based on the unit price transfer the token amount
        */
        require(numberOfTokens>0, "amount is 0");
        require((numberOfTokens * price) == msg.value, "Amount not correct");
        uint numberOfTokensInWei = numberOfTokens * (uint(10)**tokenContract.decimals());
        require(tokenContract.balanceOf(owner)>=numberOfTokensInWei, "Seller don't have enough tokens");
        tokenContract.transfer(msg.sender, numberOfTokensInWei);
        tokensSold += numberOfTokens;
        emit Sold(msg.sender, numberOfTokens);
    }

    function endSale() public {
        require(msg.sender == owner, "Only Owner");
        emit TokenReturned(tokenContract.balanceOf(address(this)));
        emit TokenBalance(address(this).balance);
        // tokenContract.transfer(owner, tokenContract.balanceOf(address(this)));
        // payable(msg.sender).transfer(address(this).balance);
    }

    function balance() public view returns(uint256){
        return address(this).balance;
    }
}
