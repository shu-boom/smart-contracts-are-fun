const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("hardhat");


async function deployTokenFixture() {
    const [player1, player2] = await hre.ethers.getSigners();
    const betAmount = ethers.utils.parseEther("0.01");
    const TwentyOne = await ethers.getContractFactory("TwentyOne");
    const twentyOne = await TwentyOne.deploy(betAmount, {value: betAmount});
    const timeOut = 1; // in minutes
  
    // Fixtures can return anything you consider useful for your tests
    return { twentyOne, player1, player2, betAmount, timeOut };
  }

describe("TwentyOne contract", function () {
    it("Should deploy the game correctly", async function () {
      const { twentyOne, player1, player2, betAmount } = await loadFixture(
        deployTokenFixture
      );
      expect(await twentyOne.player1()).to.equal(player1.address);
      expect(await twentyOne.betAmount()).to.equal(betAmount);
    });

    describe("Joining Game", function () {
        it("Should allow player2 to join the game", async function () {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
              deployTokenFixture
            );
            const tx = await twentyOne.connect(player2).join(betAmount, {value: betAmount});
            const blockBefore = (await ethers.provider.getBlock("latest")).timestamp;
    
            expect(await twentyOne.player2()).to.equal(player2.address);
            expect(await twentyOne.betAmount()).to.equal(betAmount.mul(2));
            expect(await twentyOne.nextMove()).to.equal(player1.address)
            expect(await twentyOne.timeout()).to.equal(blockBefore+ timeOut * 60);
            //event emitted test
            await expect(tx)
            .to.emit(twentyOne, "PlayerJoined")
            .withArgs(
                player1.address,
                player2.address,
                betAmount.mul(2)
            );
            await expect(tx)
            .to.emit(twentyOne, "NextMove")
            .withArgs(
                player1.address,
                0
            );
        });
    
        it("Should NOT allow player1 to join the game", async function () {
            const { twentyOne, player1, player2, betAmount } = await loadFixture(
              deployTokenFixture
            );
            await expect(twentyOne.connect(player1).join(betAmount, {value: betAmount})).to.be.revertedWith("Player 1 cannot join the game");
        });
    
        it("Should NOT allow player2 to join the game with incorrect bet amount", async function () {
            const { twentyOne, player1, player2, betAmount } = await loadFixture(
              deployTokenFixture
            );
            await expect(twentyOne.connect(player2).join(betAmount.add(1), {value: betAmount.add(1)})).to.be.revertedWith("Incorrect bet amount");
        });
    
    });

 
    describe("Guessing the number", async () => {
        async function deployTokenFixtureGuessing() {
            const [player1, player2] = await hre.ethers.getSigners();
            const betAmount = ethers.utils.parseEther("0.01");
            const TwentyOne = await ethers.getContractFactory("TwentyOne");
            const twentyOne = await TwentyOne.deploy(betAmount, {value: betAmount});
            const timeOut = 1; // in minutes
          
            //join the game
            await twentyOne.connect(player2).join(betAmount, {value: betAmount});

            // Fixtures can return anything you consider useful for your tests
            return { twentyOne, player1, player2, betAmount, timeOut };
          }

        it("Should allow player2 to guess the number", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureGuessing
            );
            const guess = 3;
            const blockBefore = (await ethers.provider.getBlock("latest")).timestamp;
            const tx = await twentyOne.connect(player1).guessNumber(guess);
            const blockAfter = (await ethers.provider.getBlock("latest")).timestamp;
            
            expect(await twentyOne.player2()).to.equal(player2.address);
            expect(await twentyOne.nextMove()).to.equal(player2.address)
            expect(await twentyOne.timeout()).to.equal(blockAfter + timeOut * 60);
            //event emitted test
            await expect(tx)
            .to.emit(twentyOne, "NextMove")
            .withArgs(
                player2.address,
                3
            );
            expect(await twentyOne.total()).to.equal(guess);        
        });

        it("Should NOT allow player1 to guess the number", async () => {
            const { twentyOne, player1, player2, betAmount } = await loadFixture(
                deployTokenFixtureGuessing
            );

            const guess = 3;
            await expect(twentyOne.connect(player2).guessNumber(guess)).to.be.revertedWith("Not your turn");
        });

        it("Should allow guessing the number with correct parameters", async () => {
            const { twentyOne, player1, player2, betAmount } = await loadFixture(
                deployTokenFixtureGuessing
            );
            guess = 4;
            await expect(twentyOne.connect(player1).guessNumber(guess)).to.be.revertedWith("Guess must be between 1 and 3");
            guess = 0;
            await expect(twentyOne.connect(player1).guessNumber(guess)).to.be.revertedWith("Guess must be between 1 and 3");
            
        });

        it("Should NOT allow guessing after timeout", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureGuessing
            );
            const guess = 3;
            await ethers.provider.send('evm_increaseTime', [timeOut * 60]);
            await ethers.provider.send('evm_mine');

            await expect(twentyOne.connect(player1).guessNumber(guess)).to.be.revertedWith("Timeout");
            await expect(twentyOne.connect(player2).guessNumber(guess)).to.be.revertedWith("Timeout");
            const tx = await twentyOne.connect(player1).claimTimeout();
            await expect(tx)
            .to.emit(twentyOne, "Winner")
            .withArgs(
                player2.address,
                betAmount.mul(2)
            );
            await expect(twentyOne.connect(player1).guessNumber(guess)).to.be.revertedWith("Game is over");
        });

        it("Should not allow a single player to place consecutive bets", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureGuessing
            );
            const guess = 3;
            twentyOne.connect(player1).guessNumber(guess)
            await expect(twentyOne.connect(player1).guessNumber(guess)).to.be.revertedWith("Not your turn");
        });

        it("Should select the winner correctly", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureGuessing
            );
            const guess = 3;
            twentyOne.connect(player1).guessNumber(guess)
            twentyOne.connect(player2).guessNumber(guess)
            twentyOne.connect(player1).guessNumber(guess)
            twentyOne.connect(player2).guessNumber(guess)
            twentyOne.connect(player1).guessNumber(guess)
            twentyOne.connect(player2).guessNumber(guess)
            tx = twentyOne.connect(player1).guessNumber(guess)
            await expect(tx)
            .to.emit(twentyOne, "Winner")
            .withArgs(
                player1.address,
                betAmount.mul(2)
            );
            expect(await twentyOne.total()).to.equal(guess*7);
            await expect(twentyOne.connect(player2).guessNumber(guess)).to.be.revertedWith("Game is over");
        });

        it("Should allow player1 to claim the timeout", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureGuessing
            );
            const guess = 3;
            await twentyOne.connect(player1).guessNumber(guess)
            await ethers.provider.send('evm_increaseTime', [timeOut * 60]);
            await ethers.provider.send('evm_mine');
            const tx = await twentyOne.connect(player1).claimTimeout();
            await expect(tx)
            .to.emit(twentyOne, "Winner")
            .withArgs(
                player1.address,
                betAmount.mul(2)
            );
        });
    });


    describe("Cancelling", async () => {
        async function deployTokenFixtureCancel() {
            const [player1, player2] = await hre.ethers.getSigners();
            const betAmount = ethers.utils.parseEther("0.01");
            const TwentyOne = await ethers.getContractFactory("TwentyOne");
            const twentyOne = await TwentyOne.deploy(betAmount, {value: betAmount});
            const timeOut = 1; // in minutes
          
            //join the game

            // Fixtures can return anything you consider useful for your tests
            return { twentyOne, player1, player2, betAmount, timeOut };
          }

        it("Should allow player 1 to cancel if player2 has not joined", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureCancel
            );
            const tx = await twentyOne.connect(player1).cancel();
            await expect(tx)
            .to.emit(twentyOne, "Cancelled")
            .withArgs(
                player1.address,
                betAmount
            );
        });

        it("Should NOT allow player 1 to cancel if player2 has joined", async () => {
            const { twentyOne, player1, player2, betAmount, timeOut } = await loadFixture(
                deployTokenFixtureCancel
            );
            await twentyOne.connect(player2).join(betAmount, {value: betAmount});
            await expect(twentyOne.connect(player1).cancel()).to.be.revertedWith("Player 2 has joined");
        });
    });

  });