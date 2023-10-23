const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SealedBid Auction", function () {
    beforeEach(async () => {
        accounts = await hre.ethers.getSigners();
        owner = accounts[0];
        bidder1 = accounts[1];
        bidder2 = accounts[2];
        bidder3 = accounts[3];

        // deploy token
        totalSupply = 1000;
        const Token = await ethers.getContractFactory("AuctionToken", owner);
        token = await Token.deploy(totalSupply);
        
        // deploy sealed bid auction
        const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction", owner);
        bidding_period = 100; // in minutes
        reveal_period = 10; // in minutes
        reserve_price = ethers.utils.parseEther("1");
        auction = await SealedBidAuction.deploy(token.address, bidding_period, reveal_period, reserve_price);
        timestamp = (await ethers.provider.getBlock("latest")).timestamp;
        await auction.deployed();
        await token.connect(owner).approve(auction.address, totalSupply);
    });

    describe("SealedBidAuction Deployment", () => {
        it("Should set owner correctly", async () => {
            expect(await auction.owner()).to.equal(owner.address);
        });

        it("Should set bidding period correctly", async () => {
            expect(await auction.endOfBidding()).to.equal( ethers.BigNumber.from(timestamp).add(bidding_period * 60));
        });

        it("Should set reveal period correctly", async () => {
            const bidding_period_end = await auction.endOfBidding();
            expect(await auction.endOfRevealing()).to.equal( ethers.BigNumber.from(bidding_period_end).add(reveal_period * 60));
        });

        it("Should set reserve price correctly", async () => {
            expect(await auction.reservePrice()).to.equal(ethers.utils.parseEther("1"));
        }); 

        it("Should set token correctly", async () => {
            expect(await auction.token()).to.equal(token.address);
        });

        it("Should set highest bidder correctly", async () => {
            expect(await auction.highestBidder()).to.equal(ethers.constants.AddressZero);
        });

        it("Should set highest bid correctly", async () => {
            expect(await auction.highestBid()).to.equal(0);
        });
    }); 

    describe("Bidding", () => {
        beforeEach(async () => {
            //Before bidding starts we need to create the hashes for the bids
            
            async function hash(nonce, amount, sender, contract) {
                let hash = ethers.utils.solidityKeccak256(["uint256", "uint256", "address" , "address"], [nonce, amount, sender.address, contract]);
                return hash;
            }

            // bidder1
            bidAmount1 = ethers.utils.parseEther("10");
            nonce1 = 1;
            hash1 = await hash(nonce1, bidAmount1, bidder1, auction.address);
            // bidder2
            bidAmount2 = ethers.utils.parseEther("20");
            nonce2 = 2;
            hash2 = await hash(nonce2, bidAmount2, bidder2, auction.address);
            // bidder3
            bidAmount3 = ethers.utils.parseEther("30");
            nonce3 = 3;
            hash3 = await hash(nonce3, bidAmount3, bidder3, auction.address);


        });


        it("Should allow bidding with correct parameters", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});
            bid1 = await auction.bids(bidder1.address);
            bid2 = await auction.bids(bidder2.address);
            bid3 = await auction.bids(bidder3.address);
            expect(bid1.sealedBid).to.equal(hash1);
            expect(bid2.sealedBid).to.equal(hash2);
            expect(bid3.sealedBid).to.equal(hash3);
        })

        it("Should NOT allow bidding after endOfBidding", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            await expect(auction.connect(bidder3).bid(hash3, {value: bidAmount3})).to.be.revertedWith("Bidding period has ended");
        });

        it("Should NOT allow bidding below reserve price", async () => {
            await expect(auction.connect(bidder1).bid(hash1, {value: ethers.utils.parseEther("0")})).to.be.revertedWith("Bid must be greater than reserve price");
        });
    })


    describe("Revealing", () => {
        beforeEach(async () => {
            //Before bidding starts we need to create the hashes for the bids
            
            async function hash(nonce, amount, sender, contract) {
                let hash = ethers.utils.solidityKeccak256(["uint256", "uint256", "address" , "address"], [nonce, amount, sender.address, contract]);
                return hash;
            }

            // bidder1
            bidAmount1 = ethers.utils.parseEther("10");
            nonce1 = 1;
            hash1 = await hash(nonce1, bidAmount1, bidder1, auction.address);
            // bidder2
            bidAmount2 = ethers.utils.parseEther("20");
            nonce2 = 2;
            hash2 = await hash(nonce2, bidAmount2, bidder2, auction.address);
            // bidder3
            bidAmount3 = ethers.utils.parseEther("30");
            nonce3 = 3;
            hash3 = await hash(nonce3, bidAmount3, bidder3, auction.address);

          


        })

        it("Should allow revealing with correct parameters", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);
            expect(await auction.highestBidder()).to.equal(bidder3.address);
            expect(await auction.highestBid()).to.equal(bidAmount3);
    
        });

        it("Should select the correct highest bidder", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            //reveal
            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);
            expect(await auction.highestBidder()).to.equal(bidder3.address);
            expect(await auction.highestBid()).to.equal(bidAmount3);

        });


        it("Should NOT allow revealing before endOfBidding", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});
            await expect(auction.connect(bidder1).reveal(nonce1, bidAmount1)).to.be.revertedWith("Bidding period has not ended");
        });

        it("Should NOT allow revealing after endOfRevealing", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});
            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            //end of revealing
            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");
            await expect(auction.connect(bidder1).reveal(nonce1, bidAmount1)).to.be.revertedWith("Reveal period has ended");
        });

        it("Should NOT allow revealing bid if the user did not bid", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            await expect(auction.connect(bidder3).reveal(nonce3, bidAmount3)).to.be.revertedWith("Bidder has not placed a bid");
        });

        it("Should NOT allow revealing bid if the amount is incorrect", async () => 
        {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            await expect(auction.connect(bidder1).reveal(nonce1, bidAmount2)).to.be.revertedWith("Bid amount does not match");
        });

        it("Should NOT allow revealing bid if the nonce is incorrect", async () => 
        {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");
            await expect(auction.connect(bidder1).reveal(nonce2, bidAmount1)).to.be.revertedWith("Incorrect hash");
        });
    })

    describe("Claiming", () => {
        beforeEach(async () => {
            //Before bidding starts we need to create the hashes for the bids
            
            async function hash(nonce, amount, sender, contract) {
                let hash = ethers.utils.solidityKeccak256(["uint256", "uint256", "address" , "address"], [nonce, amount, sender.address, contract]);
                return hash;
            }
            //approve token supply
            await token.connect(owner).approve(auction.address, ethers.utils.parseEther(""+totalSupply));

            // bidder1
            bidAmount1 = ethers.utils.parseEther("10");
            nonce1 = 1;
            hash1 = await hash(nonce1, bidAmount1, bidder1, auction.address);
            // bidder2
            bidAmount2 = ethers.utils.parseEther("20");
            nonce2 = 2;
            hash2 = await hash(nonce2, bidAmount2, bidder2, auction.address);
            // bidder3
            bidAmount3 = ethers.utils.parseEther("30");
            nonce3 = 3;
            hash3 = await hash(nonce3, bidAmount3, bidder3, auction.address);
        })

        it("Should allow claiming with correct parameters", async () => {
            
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            expect(await auction.highestBidder()).to.equal(bidder3.address);
            expect(await auction.highestBid()).to.equal(bidAmount3);

            await auction.connect(bidder3).claim();
           
            expect(await token.balanceOf(bidder3.address)).to.equal(bidAmount3);
        });

        it("Should NOT allow claiming twice", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder3).claim();
            await expect(auction.connect(bidder3).claim()).to.be.revertedWith("Higest bidder has not been set");
        });

        it("Should NOT allow claiming before endOfRevealing", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);

            await expect(auction.connect(bidder3).claim()).to.be.revertedWith("Reveal period has not ended");
        });

        it("Shold NOT allow claiming if the user is not the highest bidder", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            await expect(auction.connect(bidder3).claim()).to.be.revertedWith("Only highest bidder can claim");
        });

        it("Should NOT allow claiming if the user has not revealed", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            await expect(auction.connect(bidder2).claim()).to.be.revertedWith("Only highest bidder can claim");

            await auction.connect(bidder1).claim();
            expect(await token.balanceOf(bidder1.address)).to.equal(bidAmount1);


        });


    })

    describe("Withdraw", () => {
        beforeEach(async () => {
            //Before bidding starts we need to create the hashes for the bids
            
            async function hash(nonce, amount, sender, contract) {
                let hash = ethers.utils.solidityKeccak256(["uint256", "uint256", "address" , "address"], [nonce, amount, sender.address, contract]);
                return hash;
            }
            //approve token supply
            await token.connect(owner).approve(auction.address, ethers.utils.parseEther(""+totalSupply));

            // bidder1
            bidAmount1 = ethers.utils.parseEther("10");
            nonce1 = 1;
            hash1 = await hash(nonce1, bidAmount1, bidder1, auction.address);
            // bidder2
            bidAmount2 = ethers.utils.parseEther("20");
            nonce2 = 2;
            hash2 = await hash(nonce2, bidAmount2, bidder2, auction.address);
            // bidder3
            bidAmount3 = ethers.utils.parseEther("30");
            nonce3 = 3;
            hash3 = await hash(nonce3, bidAmount3, bidder3, auction.address);
        })

        it("Should allow withdrawing with correct parameters", async () => {
                
                await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
                await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
                await auction.connect(bidder3).bid(hash3, {value: bidAmount3});
    
                //end of bidding
                await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
                await ethers.provider.send("evm_mine");
    
                await auction.connect(bidder1).reveal(nonce1, bidAmount1);
                await auction.connect(bidder2).reveal(nonce2, bidAmount2);
                await auction.connect(bidder3).reveal(nonce3, bidAmount3);
    
                await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
                await ethers.provider.send("evm_mine");
    
                expect(await auction.highestBidder()).to.equal(bidder3.address);
                expect(await auction.highestBid()).to.equal(bidAmount3);
                // expect balance change for bidder 1 and bidder 2
                const balance1Before = await ethers.provider.getBalance(bidder1.address);
                const balance2Before = await ethers.provider.getBalance(bidder2.address);
                // use gasSpent to calculate the balance change for withdraw function
                const tx1 = await auction.connect(bidder1).withdraw();
                const tx2 = await auction.connect(bidder2).withdraw();
                const receipt1 = await tx1.wait();
                const receipt2 = await tx2.wait();
                const gasSpent1 = receipt1.gasUsed.mul(receipt1.effectiveGasPrice);
                const gasSpent2 = receipt2.gasUsed.mul(receipt2.effectiveGasPrice);

                const balance1After = await ethers.provider.getBalance(bidder1.address);
                const balance2After = await ethers.provider.getBalance(bidder2.address);

                expect(balance1After).to.equal(balance1Before.add(bidAmount1).sub(gasSpent1));
                expect(balance2After).to.equal(balance2Before.add(bidAmount2).sub(gasSpent2));
        
            })

        it("Should NOT allow withdrawing twice", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).withdraw();
            await expect(auction.connect(bidder1).withdraw()).to.be.revertedWith("Bidder is not allowed to withdraw");
        })

        it("Should NOT allow withdrawing before endOfRevealing", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});
            await auction.connect(bidder3).bid(hash3, {value: bidAmount3});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);
            await auction.connect(bidder3).reveal(nonce3, bidAmount3);

            await expect(auction.connect(bidder1).withdraw()).to.be.revertedWith("Reveal period has not ended");
        })

        it("Should NOT allow withdrawing if the user is the highest bidder", async () => {
            await auction.connect(bidder1).bid(hash1, {value: bidAmount1});
            await auction.connect(bidder2).bid(hash2, {value: bidAmount2});

            //end of bidding
            await ethers.provider.send("evm_increaseTime", [bidding_period * 60]);
            await ethers.provider.send("evm_mine");

            await auction.connect(bidder1).reveal(nonce1, bidAmount1);
            await auction.connect(bidder2).reveal(nonce2, bidAmount2);

            await ethers.provider.send("evm_increaseTime", [reveal_period * 60]);
            await ethers.provider.send("evm_mine");

            await expect(auction.connect(bidder2).withdraw()).to.be.revertedWith("Highest bidder cannot withdraw");
        })

        

    })

});