// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IERC20.sol";

/***
    First-price sealed-bid auctions proceed in a three-step process:
        During a bidding period, each bidder submits a secret bid.
        After the bidding period, all of the previously-secret bids are revealed.
        The high bidder wins the auction in exchange for their entire bid amount.

    This contract implements a first-price sealed-bid auction for ERC20 tokens.
    The contract owner sets the bidding period, the reserve price, and the ERC20 token contract address.
*/

contract SealedBidAuction {
    // State variables
    address public owner;
    address public token;
    uint256 public endOfBidding;
    uint256 public endOfRevealing;
    struct Bid {
        uint256 amount;
        bytes32 sealedBid;
    }
    mapping(address => Bid) public bids;
    address public highestBidder;
    uint256 public highestBid;
    uint256 public reservePrice;

    // Events
    event Claimed(address indexed bidder, uint256 amount);
    event Revealed(address indexed bidder, uint256 amount);

    constructor(
        address _token,
        uint256 _biddingPeriod,
        uint256 _revealPeriod,
        uint256 _reservePrice
    ) {
        owner = msg.sender;
        token = _token;
        endOfBidding = block.timestamp + (_biddingPeriod * 1 minutes);
        endOfRevealing = endOfBidding + (_revealPeriod * 1 minutes);
        reservePrice = _reservePrice;
    }

    function bid(bytes32 _bid) public payable {
        require(block.timestamp < endOfBidding, "Bidding period has ended");
        require(msg.value > reservePrice, "Bid must be greater than reserve price");
        bids[msg.sender].sealedBid = _bid;
        bids[msg.sender].amount = msg.value;
    }

    function reveal(uint nonce, uint256 amount) public {
        require(block.timestamp > endOfBidding, "Bidding period has not ended");
        require(block.timestamp < endOfRevealing, "Reveal period has ended");
        require(bids[msg.sender].sealedBid != 0, "Bidder has not placed a bid");
        require(bids[msg.sender].amount == amount, "Bid amount does not match");
        require(bids[msg.sender].sealedBid == keccak256(abi.encodePacked(nonce, amount, msg.sender, address(this))), "Incorrect hash");
        if (amount > highestBid) {
            highestBid = amount;
            highestBidder = msg.sender;
        }
        emit Revealed(msg.sender, amount);
    }

    function claim() public {
        require(block.timestamp>endOfRevealing, "Reveal period has not ended");
        require(address(0) != highestBidder, "Higest bidder has not been set");
        require(msg.sender == highestBidder, "Only highest bidder can claim");
        highestBidder = address(0);
        highestBid = 0;
        IERC20(token).transferFrom(owner, msg.sender, bids[msg.sender].amount);
        emit Claimed(msg.sender, bids[msg.sender].amount);
    }
    
    function withdraw() public {
        require(block.timestamp>endOfRevealing, "Reveal period has not ended");
        require(msg.sender != highestBidder, "Highest bidder cannot withdraw");
        require(bids[msg.sender].amount > 0, "Bidder is not allowed to withdraw");
        uint256 amount = bids[msg.sender].amount;
        bids[msg.sender].amount = 0;
        payable(msg.sender).transfer(amount);
    }
}