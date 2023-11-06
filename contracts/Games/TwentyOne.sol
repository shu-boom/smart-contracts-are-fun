// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TwentyOne {
    address public player1;
    address public player2;
    uint256 public betAmount;
    address public winner;
    uint public total;
    address public nextMove;
    uint public timeout;

    event PlayerJoined(address player1, address player2, uint betAmount);
    event NextMove(address nextMove, uint total);
    event Winner(address winner, uint betAmount);
    event Withdrawn(address winner, uint betAmount);
    event Cancelled(address player1, uint betAmount);

    constructor(uint _amount) payable {
        player1 = msg.sender;
        betAmount = _amount;
    }

    function join(uint _amount) payable external {
        require(msg.value == _amount, "You need to bet some ether");
        require(msg.value == betAmount, "Incorrect bet amount");
        require(msg.sender != player1, "Player 1 cannot join the game");
        player2 = msg.sender;
        betAmount += _amount;   
        nextMove = player1;
        timeout = block.timestamp + 1 minutes;
        emit PlayerJoined(player1, player2, betAmount);
        emit NextMove(nextMove, total);
    }

    function guessNumber(uint guess) public
    {
        require(total<= 21 && address(0) == winner, "Game is over");
        require(block.timestamp < timeout, "Timeout");
        require(msg.sender == player1 || msg.sender == player2, "Only players can guess");
        require(nextMove == msg.sender, "Not your turn");
        require(guess >= 1 && guess <= 3, "Guess must be between 1 and 3");

        total += guess;
        timeout = block.timestamp + 1 minutes;

        if(total == 21){
            winner = msg.sender;
            emit Winner(msg.sender, betAmount);
        }

        nextMove = msg.sender == player1 ? player2 : player1;
        emit NextMove(nextMove, total);
    }

    function claimTimeout() public {
        require(block.timestamp > timeout, "Timeout not reached");
        require(address(0) == winner, "Game is over");
        winner = nextMove == player1 ? player2 : player1;
        emit Winner(winner, betAmount);
    }

    function withdraw() public {
        require(msg.sender == winner, "Only winner can withdraw");
        payable(msg.sender).transfer(betAmount);
        emit Withdrawn(msg.sender, betAmount);
    }

    function cancel() public {
        require(msg.sender == player1, "Only player 1 can cancel");
        require(address(0) == player2, "Player 2 has joined");
        payable(player1).transfer(betAmount);
        emit Cancelled(player1, betAmount);
    }
 }