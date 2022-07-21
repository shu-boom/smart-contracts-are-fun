// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
    Token Market.

    This is a simple token market contract that allows any one to add a token and start conducting sales against that token. 
    This TokenMarket is a simple exchange like intermediary between the seller and the buyer. 

    The token market contains a list of tokens. Token itself are represented as a structure
    The following information is required to add a token
        Seller : who has a balance of the token. (Most likely token owner, but could be anyone)
        Token address : The address of the token contract
        Price Numerator  : The amount in wei 
        Price Denominator : The amount of units available for price numerator

    Wei is the smallers unit of ether and Solidity does not do well with the floating point numbers. Therefore, expressing per unit price in wei could be a problem. 
    For example, a token could have a price of 0.001 WEI/UNIT or 1.5 wei/unit

    Representing price as a rational number is one simple way of calculating somewhat accurate cost. Remember that division operator in solidity would still lose remainder which is essentially lost ether. (Check Dividend contract)
    For now, we will use rational numbers. 

    Doing math in Solidity is complicated. Solidity does not allow fixed points. Although there are libararies available to handle fixed points, they are gas inefficient and use integers under the hoold to represent fixed points. 
    Another important point to note is that Soldity is filled with overflows. Therefore, calculating simple operations like percentage can he hard and may result in overflows. 
    Phantom overflows are overflows in which the primary result fits well into the data type, but the intermidiate result overflows

    For simplicity, we will use rational numbers for calculating price for respective units. 
*/
interface IERC20 {
    function totalSupply() external returns (uint);
    function balanceOf(address tokenlender) external returns (uint balance);
    function allowance(address tokenlender, address spender) external returns (uint remaining);
    function transfer(address to, uint tokens) external returns (bool success);
    function approve(address spender, uint tokens) external returns (bool success);
    function transferFrom(address from, address to, uint tokens) external returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenlender, address indexed spender, uint tokens);
}

contract TokenMarket {
    /*
        Prototyping and data structures: 
            Struct for listing -- contains respective token attributes described above
            list of listing
            owner of the market for administrative tasks

        Tasks: 
            Sellers can list a token for sale. The listing will include the quantity available and the price/unit.
            Buyers can buy a token advertised in a given listing. The purchase quantity can be any amount up to the total available in the listing, and the price will be computed based on the listing’s price/unit.
            Sellers can cancel an existing listing. Cancellation doesn’t affect any previously made sales, but it will prevent any subsequent sales.
    */

    struct Listing {
        address seller;
        IERC20 tokenAddress;
        uint256 priceNumerator;
        uint256 priceDenominator;
        bool isActive;
        uint unitsAvailable;
    }

    Listing[] public listings;
    mapping(address => uint) tokenAddressToIndex;

    event ListingAdded(address seller, IERC20 tokenAddress, uint256 priceNumerator, uint256 priceDenominator, bool isActive);

    function createListing(address tokenAddress, uint256 priceNumerator, uint256 priceDenominator, uint unitsAvailable) public {
        require(tokenAddress != address(0), "Token does not exists");
        require(priceNumerator > 0, "Price numerator should be greater than 0");
        require(priceDenominator > 0, "Price denominator should be greater than 0");
        require(unitsAvailable > 0, "Units should be greater than 0");
        Listing memory list = Listing(msg.sender, IERC20(tokenAddress), priceNumerator, priceDenominator, true, unitsAvailable);
        listings.push(list);
        tokenAddressToIndex[tokenAddress] = listings.length - 1;
        emit ListingAdded(msg.sender, IERC20(tokenAddress), priceNumerator, priceDenominator, true);
    }

    modifier checkTokenExists(address tokenAddress){
        require(listings[tokenAddressToIndex[tokenAddress]].tokenAddress == IERC20(tokenAddress), "TokenContract not available");
        _;
    }

    modifier onlySeller(address tokenAddress){
        require(msg.sender ==  listings[tokenAddressToIndex[tokenAddress]].seller, "Only seller allowed");
        _;
    }
  
    function cancelListing(address tokenAddress) checkTokenExists(tokenAddress) onlySeller(tokenAddress) public {
       listings[tokenAddressToIndex[tokenAddress]].isActive = false;
    }

    function getUnitsAvailable(address tokenAddress) public view checkTokenExists(tokenAddress) returns(uint){
       return listings[tokenAddressToIndex[tokenAddress]].unitsAvailable;
    }
    
    function getTotalListings() public view returns(uint){
       return listings.length;
    }

    function getListingDetails(address tokenAddress) checkTokenExists(tokenAddress) public view returns (address, IERC20, uint, uint, bool, uint){
        Listing memory listing = listings[tokenAddressToIndex[tokenAddress]];
        return(
            listing.seller,
            listing.tokenAddress,
            listing.priceNumerator,
            listing.priceDenominator,
            listing.isActive,
            listing.unitsAvailable);
    }
    /**
        Buying tokens is a critical function

        Context: User specifies the amount of units they want to purchase for a given token address. 
                 The tokenAddress is able to spend the given units of token from the seller because it is approved by the seller to do so. (Seller is responsible to approve spending before adding the listing)
                 The seller would receive the value sent by the user. The value will be sent to the tokenAddress. Therefore, this contract is simply an intermediary
                 The money should go to the seller or the token contract that depends on who the seller is and how the tokenContract is written
                 Therefore, it is safe to send it to the actual seller.
        Constraints:
                 Token address must be present (This shows that mapping could be problematic but can be simply be checked against the default value)
                 units must be less than equal to units available. 
                 If units are expensed then for simplicity the token should be automagically become inactive. (use a modifier)
                 Need another helper function to check units available for any given tokenAddress
                 We need to calculate cost for the units and test if the the cost is correct 
                 finally the state updates and the transfer happens. 
        Attack Potential Reduction: 
                 Check Effects Interaction (every time a contract makes a payment better be safe its a mean world!)
     */
    function buyTokens(address tokenAddress, uint units) checkTokenExists(tokenAddress) public payable{
            Listing storage listing = listings[tokenAddressToIndex[tokenAddress]];
            require(listing.isActive, "Sale is not active");
            require(units <= listing.unitsAvailable,"Units not available");
            uint cost = (units * listing.priceNumerator)/listing.priceDenominator; // This is very simplistic and could do phantom overflow. 
            require(msg.value == cost, "Amount provided not correct");
            listing.unitsAvailable -= units;
            listing.tokenAddress.transferFrom(listing.seller, msg.sender, units);
            payable(listing.seller).transfer(msg.value);
    }

    function getCostForAListing(address tokenAddress, uint units) checkTokenExists(tokenAddress) public view returns(uint cost) {
            Listing memory listing = listings[tokenAddressToIndex[tokenAddress]];
            require(units <= listing.unitsAvailable, "Units not available");
            cost = (units * listing.priceNumerator)/listing.priceDenominator; 
    }
}
