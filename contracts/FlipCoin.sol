// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
    The Flip coin Game: 
        Play the game by betting on a coin flip.
        There are two players in a game. Player 1 and Player 2.
        Player 1 flips the coin and Player 2 guesses the outcome of the coin flip.
        Player 1 flips the coin off chain and the outcome is kept secret. 
        Player 2 guesses the outcome of the coin flip and sends the guess to the contract.
        Player 1 reveals the outcome of the coin flip. 
 */

 contract FlipCoin {
    // State variables
    address public player1;
    address public player2;
    bytes32 public coinFlipped;
    bool public outcome;
    uint public betAmount;
    
    constructor() {
        player1 = msg.sender;
    }

    // Events
    event CoinFlipped(address indexed player1, bytes32 outcome);
    event CoinFlippedGuess(address player2, bool guess);
    event CoinFlippedOutcome(address indexed player1, address indexed player2, bool outcome);

    // Function to flip the coin
    function flipCoin(bytes32 _coinFlipped) payable external {
        require(msg.sender == player1, "Only player1 can flip the coin");
        require(msg.value>0, "You need to bet some ether");
        coinFlipped = _coinFlipped;
        betAmount = msg.value;
        emit CoinFlipped(player1, coinFlipped);
    }

    // Function to guess the outcome of the coin flip
    function guessCoinFlip(bool _outcome) external {
        require(player2 == address(0), "Player 2 has already guessed the outcome of the coin flip");
        require(msg.sender != player1, "Player 1 cannot guess the outcome of the coin flip");
        player2 = msg.sender;
        outcome = _outcome;
        emit CoinFlippedGuess(player2, outcome);
    }

    // Function to reveal the outcome of the coin flip
    function revealCoinFlip(uint256 secret, bool choice) external {
        require(msg.sender == player1, "Only player 1 can reveal the outcome of the coin flip");
        require(player2 != address(0), "Player 2 has not guessed the outcome of the coin flip");
        require(coinFlipped == keccak256(abi.encodePacked(secret, choice)), "Incorrect secret or outcome");
        bool result = choice;
        if(result){
            payable(player2).transfer(betAmount);
        }
        else{
            payable(player1).transfer(betAmount);
        }
        emit CoinFlippedOutcome(player1, player2, result);
    }
 }
