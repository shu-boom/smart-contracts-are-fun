// ERC20 token contract
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract ERC20 {
    /**
        AN ERC 20 TOKEN:
            name
            symbol
            totalSupply
            decimals
            transfer
            approve
            allowances
            transferFrom 

        What are we trying to acheive here? 

            We want the users to be able to call this contract and create an ERC-20 standard compatible contract. 
            If this contract is inherited by another contract. Simply, passing the constructor params and calling the mint function would create a token for the user. 

        How can we create a Factory contract such that users are able to create a number of ERC-20 contracts?
            
            We will specify this contract to actually create another contract which is an ERC 20 contract. 
            The method create uses a function and in it creates the new contract and return the address of thre contract,

        Can we save code space by using libraries? 

            Library contracts are ideally used to abstract out simple and common functionality from the contracts. There are two types of libraries
                Embedded Libraries : Embedded libraries only contain internal functions --> embedded in the contract code at the run time
                Linked Libraries : External libraries contain public or external function --> created separatly and used as address in contract
                    How to reuse an external library ?? Libraries deployed at an address can be loaded using the ABI
            Restrictions with Libraries: 
                They can't have state variables
                They can't hold ether 
                They can't be instantiated or do state modifications. 

        This particular problem is best solved using contract inhertitance. Remember that each solidity contract has a 24 KB maximum limit 
        However, this is not the case here


        This is a simple ERC-20 contract: 

    */

    string public name;
    string public symbol;
    uint public totalSupply;
    uint public decimals;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    mapping(address=>mapping(address=> uint)) allowances;
    mapping(address=>uint) public balanceOf;


    constructor(string memory _name, string memory _symbol, uint _decimals){
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function _mint(uint amount) internal {
        require(msg.sender != address(0));
        totalSupply = amount * (uint(10) ** decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    function transfer(address to, uint256 value) external returns (bool success) {
        require(balanceOf[msg.sender]>=value, "Insufficent Balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to , value);
        return true; 
    }

    function transferFrom(address from, address to, uint value) external returns (bool success) {
            require(value <= balanceOf[from]);
            require(value <= allowances[from][msg.sender]);
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
