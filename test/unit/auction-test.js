const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction", function () {
  let Auction;
  let auction;
  let owner;
  let bidder1;
  let bidder2;
  let token;
  let tokenAmount;
  let reservePrice;
  let minimumIncrement;
  let timeoutPeriod;
  let auctionEndTime;

  beforeEach(async function () {
    [owner, bidder1, bidder2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("AuctionToken", owner);
    token = await Token.deploy(1000);
    tokenAmount = ethers.utils.parseEther("100");
    Auction = await ethers.getContractFactory("Auction", owner);
    reservePrice = ethers.utils.parseEther("10");
    minimumIncrement = ethers.utils.parseEther("1");
    timeoutPeriod = 5; // in minutes
    auctionEndTime = 1; // in hours
    auction = await Auction.deploy(
      token.address,
      tokenAmount,
      reservePrice,
      minimumIncrement,
      timeoutPeriod,
      auctionEndTime
    );
    await token.connect(owner).approve(auction.address, tokenAmount);
  });

  it("should allow bidding and end the auction", async function () {
    const bidAmount1 = ethers.utils.parseEther("15");
    const bidAmount2 = ethers.utils.parseEther("20");
    await auction.connect(bidder1).bid(bidAmount1);
    await auction.connect(bidder2).bid(bidAmount2);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    const winner = await auction.highestBidder();
    const highestBid = await auction.highestBid();
    expect(winner).to.equal(bidder2.address);
    expect(highestBid).to.equal(bidAmount2);
  });

  it("should not allow owner to bid", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await expect(auction.connect(owner).bid(bidAmount)).to.be.revertedWith(
      "Owner cannot bid"
    );
  });

  it("should not allow bidding below reserve price", async function () {
    const bidAmount = ethers.utils.parseEther("5");
    await expect(auction.connect(bidder1).bid(bidAmount)).to.be.revertedWith(
      "Bid amount must be greater than reserve price"
    );
  });

  it("should not allow bidding below highest bid plus minimum increment", async function () {
    const bidAmount1 = ethers.utils.parseEther("15");
    const bidAmount2 = ethers.utils.parseEther("16");
    await auction.connect(bidder1).bid(bidAmount1);
    await expect(auction.connect(bidder2).bid(bidAmount2)).to.be.revertedWith(
      "Bid amount must be greater than highest bid by minimum increment"
    );
  });

  it("should not allow bidding after auction end time", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await ethers.provider.send("evm_increaseTime", [auctionEndTime * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await expect(auction.connect(bidder1).bid(bidAmount)).to.be.revertedWith(
      "Auction has ended"
    );
  });

  it("should not allow bidding during timeout period", async function () {
    const bidAmount1 = ethers.utils.parseEther("15");
    const bidAmount2 = ethers.utils.parseEther("20");
    await auction.connect(bidder1).bid(bidAmount1);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await expect(auction.connect(bidder2).bid(bidAmount2)).to.be.revertedWith(
      "Timeout has passed"
    );
  });

  it("should settle the bid and transfer tokens to the winner", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    const winner = await auction.highestBidder();
    const signer = await ethers.getSigner(winner);
    const highestBid = await auction.highestBid();
    const tokenBalanceBefore = await token.balanceOf(winner);
    await auction.connect(signer).settleBid({ value: highestBid });
    const tokenBalanceAfter = await token.balanceOf(winner);
    expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.equal(tokenAmount);
  });

  it("should not allow non-winner to settle the bid", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    const highestBid = await auction.highestBid();
    await expect(
      auction.connect(bidder2).settleBid({ value: highestBid })
    ).to.be.revertedWith("Only highest bidder can settle the bid");
  });

  it("should not allow settling the bid with incorrect amount", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    const winner = await auction.highestBidder();
    const signer = await ethers.getSigner(winner);

    await expect(
      auction.connect(signer).settleBid({ value:  ethers.utils.parseEther("14") })
    ).to.be.revertedWith("Bid amount must be equal to the highest bid");
  });

  it("should not allow settling the bid before auction end", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await expect(
      auction.connect(bidder1).settleBid({ value: bidAmount })
    ).to.be.revertedWith("Auction has not ended");
  });

  it("should not allow withdrawing ether before auction end and settlement", async function () {
    await expect(auction.withdrawEther()).to.be.revertedWith(
      "Auction has not ended"
    );
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    await expect(auction.withdrawEther()).to.be.revertedWith(
      "Auction is not settled yet"
    );
  });

  it("should allow owner to withdraw ether after auction end and settlement", async function () {
    const bidAmount = ethers.utils.parseEther("15");
    await auction.connect(bidder1).bid(bidAmount);
    await ethers.provider.send("evm_increaseTime", [timeoutPeriod * 60]);
    await ethers.provider.send("evm_mine");
    await auction.endAuction();
    const winner = await auction.highestBidder();
    const signer = await ethers.getSigner(winner);

    const highestBid = await auction.highestBid();
    await auction.connect(signer).settleBid({ value: highestBid });
    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await auction.withdrawEther();
    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    const highestBidBN = ethers.BigNumber.from(highestBid);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(highestBidBN.sub(gasSpent));
  });
});