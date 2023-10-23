const { expect } = require('chai')
const { ethers } = require('hardhat')
/**
 * Bool state true = heads
 * Bool state false = tails
 */
describe('CoinFlip', function () {
    beforeEach(async () => {
        accounts = await hre.ethers.getSigners();
        player1 = accounts[0];
        player2 = accounts[1];
        //deploy flipcoin contract with player1 as owner
        const FlipCoin = await hre.ethers.getContractFactory("FlipCoin", player1);
        flipCoin = await FlipCoin.deploy();
        await flipCoin.deployed();
    });

    describe("FlipCoin Deployment", () => {
        it("Should set player1 correctly", async () => {
            expect(await flipCoin.player1()).to.equal(player1.address);
        });
    })

    describe("Flipping Coin", () => {
        it("Should flip the coin with correct parameters", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            const flipCoinTx = await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await expect(flipCoinTx)
                .to.emit(flipCoin, "CoinFlipped")
                .withArgs(
                    player1.address,
                    testBytes
            );
        });

        it("Should NOT allow player2 to flip a coin", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await expect(flipCoin.connect(player2).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") }))
                .to.be.revertedWith("Only player1 can flip the coin");
        });
        
        it("Should NOT allow to flip a coin if the value is zero", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await expect(flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("0.0") }))
                .to.be.revertedWith("You need to bet some ether");
        });

        it("Should set the coinFlipped variable correctly", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            expect(await flipCoin.coinFlipped()).to.equal(testBytes);
        });

        it("Should set the bet amount correctly", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            expect(await flipCoin.betAmount()).to.equal(ethers.utils.parseEther("1.0"));
        });
    });

    describe("Guessing Coin Flip", () => {
        it("Should allow guessing coin flip with correct parameters", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            const guessCoinFlipTx = await flipCoin.connect(player2).guessCoinFlip(true);
            expect(await flipCoin.player2()).to.equal(player2.address);
            expect(await flipCoin.outcome()).to.equal(true);
            await expect(guessCoinFlipTx)
            .to.emit(flipCoin, "CoinFlippedGuess")
            .withArgs(
                player2.address,
                true
            );
        });

        it("Should NOT allow player 1 to guess coin flip", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await expect(flipCoin.connect(player1).guessCoinFlip(true))
                .to.be.revertedWith("Player 1 cannot guess the outcome of the coin flip");
        });

        it("Should NOT allow guessCoinflip to be called once a player2 has already guessed", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            await expect(flipCoin.connect(player2).guessCoinFlip(true))
                .to.be.revertedWith("Player 2 has already guessed the outcome of the coin flip");
            await expect(flipCoin.connect(accounts[3]).guessCoinFlip(true))
                .to.be.revertedWith("Player 2 has already guessed the outcome of the coin flip");
        });
    })

    describe("Reveal Coin Flip", () => {
        it("Should allow reveal coin flip with all correct parameters", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            const revealCoinFlipTx = await flipCoin.connect(player1).revealCoinFlip(111, true);
            expect(await flipCoin.player2()).to.equal(player2.address);
            expect(await flipCoin.outcome()).to.equal(true);
            await expect(revealCoinFlipTx)
            .to.emit(flipCoin, "CoinFlippedOutcome")
            .withArgs(
                player1.address,
                player2.address,
                true
            );
        });

        it("Should ONLY allow player 1 to invoke revealCoinFlip", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            await expect(flipCoin.connect(player2).revealCoinFlip(111, true))
                .to.be.revertedWith("Only player 1 can reveal the outcome of the coin flip");
        });
        it("Should ONLY allow invoking revealCoinFlip once player2 has guessed the outcome", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await expect(flipCoin.connect(player1).revealCoinFlip(111, true))
                .to.be.revertedWith("Player 2 has not guessed the outcome of the coin flip");   
            await flipCoin.connect(player2).guessCoinFlip(true);
            expect(await flipCoin.player2()).to.equal(player2.address);
            expect(await flipCoin.outcome()).to.equal(true);
            await expect(flipCoin.connect(player1).revealCoinFlip(111, true))
            .to.emit(flipCoin, "CoinFlippedOutcome")
            .withArgs(
                player1.address,
                player2.address,
                true
            );
        });
        it("Should send ether to player2 if the outcome was correct", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            var player2BalanceBefore = await ethers.provider.getBalance(player2.address);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            const tx = await flipCoin.connect(player2).guessCoinFlip(true);
            const receipt = await tx.wait()
            const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
            await flipCoin.connect(player1).revealCoinFlip(111, true);
            var player2BalanceAfter = await ethers.provider.getBalance(player2.address);
            expect(player2BalanceAfter).to.equal(player2BalanceBefore.add(ethers.utils.parseEther("1.0")).sub(gasSpent));
        });

        it("Should send ether to player1 if the outcome was incorrect", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, false]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            var player1BalanceBefore = await ethers.provider.getBalance(player1.address);
            const tx = await flipCoin.connect(player1).revealCoinFlip(111, false);
            const receipt = await tx.wait()
            const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
            var player1BalanceAfter = await ethers.provider.getBalance(player1.address);
            expect(player1BalanceAfter).to.equal(player1BalanceBefore.add(ethers.utils.parseEther("1.0")).sub(gasSpent));
        });


        it("Should NOT allow player1 to manipulate the outcome with incorrect secret", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, false]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            await expect(flipCoin.connect(player1).revealCoinFlip(112, false))
                .to.be.revertedWith("Incorrect secret or outcome");
        });

        it("Should NOT allow player1 to manipulate the outcome with incorrect choice", async () => {
            var testBytes = hre.ethers.utils.solidityKeccak256(["uint256", "bool"], [111, true]);
            await flipCoin.connect(player1).flipCoin(testBytes, { value: ethers.utils.parseEther("1.0") });
            await flipCoin.connect(player2).guessCoinFlip(true);
            await expect(flipCoin.connect(player1).revealCoinFlip(111, false))
                .to.be.revertedWith("Incorrect secret or outcome");
        });
    })


});