// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IERC20.sol";

/**
    * @title ERC20 token auction contract
    * @dev This contract allows users to auction ERC20 tokens
    An auction is typically parameterized by a few values:

        The good being sold. For this contract, that will be a given ERC20 token.
        The reserve price is the lowest acceptable bid.
        The minimum increment is the smallest amount that each successive bid must increase by.
        The timeout period is the amount of time that bidders have after a successful bid to make a new bid. If no successful bids are made during that period, then the auction terminates.
        The auction end time is the time at which the auction will terminate if it hasn't already.
        The highest bidder is the address of the account that has placed the highest bid.
        The highest bid is the amount of the highest bid.
        The last bid timestamp is the time at which the highest bid was placed.
        The bids mapping maps addresses to the amounts of their bids.
        The ended boolean indicates whether the auction has ended.
        The settled boolean indicates whether the auction has been settled.
        The owner is the address of the account that deployed the contract.


    Limitation: User may not settle the bill and auction gets ended without any settlement.
    We can allow owner to cancel the auction by introducing a time limit 
    We can also create an escrow contract that will hold the tokens and ether and will only release them when the auction is settled.
    Due to simplicity we won't implement this changes yet in this contract
 */
contract Auction {
    //state variables
    address public owner;
    address public token;
    uint256 public tokenAmount;
    uint256 public reservePrice;
    uint256 public minimumIncrement;
    uint256 public timeoutPeriod;
    uint256 public auctionEndTime;
    uint256 public auctionStartTime;
    address public highestBidder;
    uint256 public highestBid;
    uint256 public lastBidTimeStamp;
    mapping(address => uint256) public bids;
    bool public ended;
    bool public settled;

    constructor(
        address _token,
        uint256 _tokenAmount,
        uint256 _reservePrice,
        uint256 _minimumIncrement,
        uint256 _timeoutPeriod,
        uint256 _auctionEndTime)
    {
        owner = msg.sender;
        token = _token;
        tokenAmount = _tokenAmount;
        reservePrice = _reservePrice;
        minimumIncrement = _minimumIncrement;
        timeoutPeriod = _timeoutPeriod * 1 minutes;
        auctionEndTime = block.timestamp + (_auctionEndTime * 1 hours);
        auctionStartTime = block.timestamp;
    }

    // event
    event AuctionEnded(address winner, uint256 highestBid);
    event BidPlaced(address bidder, uint256 bidAmount);
    event SettledBid(address bidder, uint256 bidAmount, uint256 tokenAmount);

    function bid(uint amount) external {
        require(msg.sender != owner, "Owner cannot bid");
        require(amount >= reservePrice, "Bid amount must be greater than reserve price");
        require(amount > highestBid + minimumIncrement, "Bid amount must be greater than highest bid by minimum increment");
        require(block.timestamp < auctionEndTime, "Auction has ended");
        require(lastBidTimeStamp == 0 || lastBidTimeStamp + timeoutPeriod > block.timestamp, "Timeout has passed");
        require(!ended, "Auction has ended");

        lastBidTimeStamp = block.timestamp;
        highestBidder = msg.sender;
        highestBid = amount;
        bids[msg.sender] = amount;
        emit BidPlaced(msg.sender, amount);
    }

    function endAuction() external {
        require(msg.sender == owner, "Only owner can end the auction");
        require(!ended, "Auction has already ended");
        require(block.timestamp > auctionEndTime || (lastBidTimeStamp != 0 && lastBidTimeStamp + timeoutPeriod < block.timestamp), "Auction has not ended");
        ended = true;
        
        emit AuctionEnded(highestBidder, highestBid);
    }

    function settleBid() external payable{
       require(msg.sender == highestBidder, "Only highest bidder can settle the bid");
       require(msg.value == highestBid, "Bid amount must be equal to the highest bid");
       require(ended, "Auction has not ended");
       IERC20(token).transferFrom(owner, highestBidder, tokenAmount);
       settled = true;
       emit SettledBid(highestBidder, highestBid, tokenAmount);   
    }

    function withdrawEther() external {
        require(msg.sender == owner, "Only owner can withdraw ether");
        require(ended, "Auction has not ended");
        require(settled, "Auction is not settled yet");
        payable(owner).transfer(address(this).balance);
    }
}