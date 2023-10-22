// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiPaymentsChannel{
    address public receiver;
    address public sender;
    uint public withdrawn;

    constructor(address payable _receiver) payable {
        receiver = _receiver;
        sender = msg.sender;
    }


    function withdraw(uint _amount, uint _nonce ,bytes memory signature) public payable
    {
        require(msg.sender == receiver, "Only Receiver allowed");
        require(address(this).balance >=_amount, "Not enough balance");
        require(isValidSignature(_amount, _nonce ,signature), "Not valid signature");
        uint amountToWithdraw = _amount - withdrawn;
        withdrawn += amountToWithdraw;         
        payable(msg.sender).transfer(amountToWithdraw);
    }

    function isValidSignature(uint _amount,  uint256 _nonce, bytes memory signature) internal view returns (bool){
        // message must be generated on chain for us to validate signature
        bytes32 message = prefixed(keccak256(abi.encodePacked(msg.sender, _amount, _nonce, this)));
        return recoverSigner(message, signature) == sender;
    }

      function splitSignature(bytes memory  sig)
        internal
        pure
        returns (uint8, bytes32, bytes32)
    {
        require(sig.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;

        (v, r, s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}