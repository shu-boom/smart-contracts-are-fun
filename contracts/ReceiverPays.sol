// ERC20 token contract
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";
contract ReceiverPays {
    /**
        Contract -- Receiver Pay

        Owner fills the contract up with some ethers. 
        Owner builds off-chain signatures for recepients to redeem these ethers and pay the transaction fee. 

        Attack Vectors: Replay 
        Replay attack occours when the recepient uses the same signature twice to redeem unauthorized ethers. 
            This can be prevented using nonces in the signature. The nonces would prevent double spend and contract would register nonce that would successfully finish. 
            Additionally, if a new contract would be created then all of the nonces would be wiped out and the last version's recepients could simply redeem using their old signatures
            Therefore, contract address must also be present in the signature

        Signature/Data Fingerprints:
            Client:
                Ethereumjs-abi's soliditySHA3 method is used to create a hash. The required inputs are: recepient, amount, nonce, contractAddress
                The hash is then signed using an account
            Contract: 
                The recepient provides the signature as well as the necessary data to compute the hash. The hash and the signature are used to compute the key who signed the signature
        
        Data fingerprints are also need to be matched and verify that the contract owener signed this signature and no one elses.
        In order to verify the signature, we can simply use ecrecover. The function takes a signature and the message signed by the signature
        It either returns the account key that was used to sign transaction or it returns 0
     */

    mapping(uint=>bool) public usedNonces;
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function kill() public {
        require(msg.sender == owner, "Only Owner");
        selfdestruct(payable(msg.sender));
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
            public
            pure
            returns (bytes32)
        {
            return
                keccak256(
                    abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
                );
        }

    function claimPayment(bytes memory sig, uint nonce, uint amount) public {
        require(!usedNonces[nonce], "Nonce already used");
        usedNonces[nonce] = true;
        bytes32 hash = getEthSignedMessageHash(keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this))));
        address signer = getSigner(hash, sig);
        require(signer == owner, "Wrong Signer");
        payable(msg.sender).transfer(amount);
    }

    function getSigner(bytes32 hash, bytes memory sig) internal pure returns (address){
        require(sig.length == 65);
        (bytes32 r,
        bytes32 s,
        uint8 v) = splitSignature(sig);
        return ecrecover(hash, v, r, s);
    }

    function splitSignature(bytes memory sig) internal pure returns(bytes32, bytes32, uint8){
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return (r, s, v);
    }
}