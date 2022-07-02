// ERC20 token contract
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract ERC20 {
    /**
          /*
        This contract redistributes profits as dividend to all the token contract holders.  
        In order to keep track of dividends, This contract uses sparse data structure like mappings. 

        This contract contains the deposit method which calculates the dividend per token on each deposit. 
        We need another data structure to maintain how much dividend is owed to which account and we should also be able to withdraw that amount // use mapping 
    
    */

    string public name;
    string public symbol;
    uint public totalSupply;
    uint public decimals = 0;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    mapping(address=>mapping(address=> uint)) allowances;
    mapping(address=>uint) public balanceOf;
    mapping(address => uint) public dividendBalanceOf; // this keeps track of the current balance for each account. Users can claim this balance. 
    mapping(address => uint) public dividendCreditedTo; // this keeps track of the dividend that is credited but not yet taken out by the holder. 
    uint public dividendPerToken;
    event DividendPerTokenUpdated(uint amount);
    event updateDividendEVENT(address holder, uint amount, uint owed);
    constructor(string memory _name, string memory _symbol){
        name = _name;
        symbol = _symbol;
        _mint(1000);
    }

    // calculate dividend when money is deposited to the contract
    function deposit(uint _value) public payable {
        // store the dividend each time a deposit is made. 
        // stores the dividend perToken at the time of deposit.
        require(msg.value == _value, "The amount is not correct");
        dividendPerToken += msg.value/totalSupply;
        emit DividendPerTokenUpdated(msg.value);
    }   


    // This method resets the dividend balance for the user and transfers them their share of the dividend. 
    function claimDividend() public payable {
        updateDividend(msg.sender); // takes all the dividend applicable when clicked. 
        payable(msg.sender).transfer(dividendBalanceOf[msg.sender]);
        dividendBalanceOf[msg.sender]=0;
    }

    /* 
       We need to figure out a way to calculate the amount of dividend and populate the dividendBalanceOf. 
       Since dividend depeneds on the ownership of the tokens. 
       Any time token ownership changes (transfer method call for simplicity), we calculate the amount of dividend owed to each token.

       function updateDividend(address holder) internal {
        uint owed = dividendPerToken * balanceOf[holder];
        dividendBalanceOf[msg.sender] += owed;
       } 

       Updating the dividend like this misses a key part. Holders can take dividend time to time. 
       Therefore, we must use another data structure to keep track of the dividend balance that is already credited to the user on each transfer.
       dividendCreditedTo is a mapping which aims to acheive this functionality.  
    */
    function updateDividend(address holder) internal {
        uint owed = dividendPerToken - dividendCreditedTo[holder];
        uint amount = owed * balanceOf[holder];
        emit updateDividendEVENT(holder, amount, owed);
        dividendCreditedTo[holder] = dividendPerToken;
        dividendBalanceOf[holder] += amount;
    } 


    function _mint(uint amount) internal {
        require(msg.sender != address(0));
        totalSupply = amount * (uint(10) ** decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    function transfer(address to, uint256 value) external returns (bool success) {
        require(balanceOf[msg.sender]>=value, "Insufficent Balance");
        updateDividend(to);
        updateDividend(msg.sender);
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to , value);
        return true; 
    }

    function transferFrom(address from, address to, uint value) external returns (bool success) {
            require(value <= balanceOf[from]);
            require(value <= allowances[from][msg.sender]);
            updateDividend(to);
            updateDividend(from);
            balanceOf[from] -= value;
            balanceOf[to] += value;
            allowances[from][msg.sender] -= value;
            emit Transfer(from, to , value);
            return true;
    }

    function approve(address spender, uint value) external returns (bool success) {
        allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender , value);
        return success;
    }
}
