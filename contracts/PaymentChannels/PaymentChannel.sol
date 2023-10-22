// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/*
    Payament Channel
    
    Due to block time, blockchains are unable to offer micropayments. In other words, each transaction on a blockchain need to be mined. This takes transaction fees and mining time. 
    Micropayments are payments that involve a very small amount. Transaction fees make micropayments a difficult use case for Ethereum and other blockchains like it.
    Payment channels allow participants to make repeated transfers of ether without using transactions

    AVOID DELAY AND FEE ASSOCIATED WITH THE TRANSACTIONS 

    How it works?
    
    We learned from the ReceiverPays contract that signing and verifying messages can be done off chain. 
    Instead of creating a common contract to pay any type of recepient (this is why we added recepient address in the hash)
    We can create a contract per payment channel that only handles the payments between the sender and a specific recepient (This means that the recepient address need not be stored in the hash)
    Another issue that we learned from the last contract was that replay attacks can be prevented by hashing nonces and contract addresses together.
    If the payment channel is designed such that the recepient could only do a single withdrawl and close the channel, the nonce can also be omitted from the hash. 
    
    The sender opens the payment channel(Smart Contract) by making the initial payment and specifying an expiration time.
    The sender is able to extend the expiration time once the payment channel is open.
    The recepient can make a withdrawl for amount of ether owed out of the amount of ether escrowed by the sender and close the payment channel.
    Closing the payment channel deletes the contract(Payment Channel) and sends remainder of the escrowed ether to the sender. 

    This setup requires only two transactions. The sender signs the message offline and send it to the recepient. In fact, it is recepient's responsibility to use the latest message 
    for retrieving the actual amount.

    The recepient also have the following responsibilities:
        - Verify that the message is for the correct channel  | 
        - Verify that the signature is valid |
        - Verify that the new total is the expected amount | Can be verified offchain message and signature verification
        - Verify that the new total is not exceeding the escrowed ether amount | Recepient can just check this easily from the smart contract

    In order to carry out the above mentioned responsibilities, the recepient must be able to create the message and use the signature to verify that the correct sender has sent the message. 
    Using the address and appropriate amount the recepient should also arrive at a correct address. This gives the recepient power to verify information offchain. 
*/

contract PaymentChannel {
    uint public expirationTime;
    address public recepient;
    address public owner;

    event ExpirationExtended(uint duration);

    // the sender initiate the payment channel | added the amount of ether | specified expiration time and recepient 
    constructor(uint _duration, address _recepient) payable {
        expirationTime = block.timestamp + (_duration * 1 days);
        recepient = _recepient;
        owner = msg.sender;
    }

    // tells the recepient of the total amount of ether escrowed by the sender
    function getBalance() public view returns(uint)
    {
        return address(this).balance;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    // only the sender can increase the expiration days. 
    function extendExpirationTime(uint _newDuration) public onlyOwner{
        expirationTime = block.timestamp + (_newDuration * 1 days);
        emit ExpirationExtended(expirationTime);
    }

    // If the expiration time is reached, the sender is able to retrieve the escrowed ether.
    function claimTimeout() public payable onlyOwner {
        require(block.timestamp >= expirationTime, "Channel is not expired");
        selfdestruct(payable(owner));
    }

    // The recepient must be able to close the channel by providing a signature and amount. 
    function closeChannel(uint _amount, bytes memory _signature) public payable {
        require(msg.sender == recepient, "Only Recepient");
        require(block.timestamp < expirationTime, "Channel only expired");
        require(address(this).balance >= _amount, "Not enough ether escrowed");
        // verify that the _signature is valid and the amount is correct
        // split the signature build the message and use ecreover to check if sender signed this message with appropriate amount 
        (bytes32 r, bytes32 s, uint8 v) = splitsignature(_signature);
        bytes32 prefixedMessage = getPrefixedMessage(_amount);
        require(owner == ecrecover(prefixedMessage, v, r, s), "Not signed by owner");
        payable(recepient).transfer(_amount);
        selfdestruct(payable(owner));
    }

    function getPrefixedMessage(uint _amount) internal view returns (bytes32 prefixedMessage){
       prefixedMessage =  keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(_amount, address(this)))));
    }

    function splitsignature(bytes memory sig) internal pure returns(bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
