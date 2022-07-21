const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('TokenMarket', function () {
  beforeEach(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0];
  
    seller1 = accounts[1];
    seller2 = accounts[2];
  
    customer1 = accounts[3];
    customer2 = accounts[4];
    customer3 = accounts[5];

    TokenMarket = await ethers.getContractFactory("TokenMarket", owner);
    tokenMarket = await TokenMarket.deploy();
    await tokenMarket.deployed();
  
    Token1 = await ethers.getContractFactory("Token1", seller1);
    token1 = await Token1.deploy("Token1", "TOK1", 18);
    await token1.deployed();

    Token2 = await ethers.getContractFactory("Token2", seller2);
    token2 = await Token2.deploy("Token2", "TOK2", 18);
    await token2.deployed();  
  });

  it('Should be able to create a listing', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    var [seller, tokenAddress, priceNumerator, priceDenominator, isActive, unitsAvailable] = await tokenMarket.getListingDetails(token1.address);
    expect(seller).to.be.equal(seller1.address);
    expect(tokenAddress).to.be.equal(tokenAddress);
    expect(priceNumerator).to.be.equal(100);
    expect(priceDenominator).to.be.equal(100);
    expect(isActive).to.be.true;
    expect(unitsAvailable).to.be.equal(ethers.utils.parseEther("50"));
    expect(await tokenMarket.getTotalListings()).to.be.equal(1);
  });

  it('Only Seller should be able to cancel the listing', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    await tokenMarket.connect(seller2).createListing(token2.address, 70, 30, hre.ethers.utils.parseEther("100"));
    expect(await tokenMarket.getTotalListings()).to.be.equal(2);
    await expect(tokenMarket.connect(seller2).cancelListing(token1.address)).to.be.revertedWith('Only seller allowed');
    await tokenMarket.connect(seller1).cancelListing(token1.address);
    var [,,,,isActive,] = await tokenMarket.getListingDetails(token1.address);
    expect(isActive).to.be.false;
 });

  it('Should throw an error if token doesnot exists', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    expect(await tokenMarket.getTotalListings()).to.be.equal(1);
    await expect(tokenMarket.connect(seller1).cancelListing(token2.address)).to.be.revertedWith('TokenContract not available');
    await expect(tokenMarket.connect(seller1).getUnitsAvailable(token2.address)).to.be.revertedWith('TokenContract not available');
    await expect(tokenMarket.connect(seller1).getListingDetails(token2.address)).to.be.revertedWith('TokenContract not available');
    await expect(tokenMarket.connect(seller1).buyTokens(token2.address, 10)).to.be.revertedWith('TokenContract not available');
    await expect(tokenMarket.connect(seller1).getCostForAListing(token2.address, 10)).to.be.revertedWith('TokenContract not available');
  });

  it('Should not be able to buy a token that is not active', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    await tokenMarket.connect(seller1).cancelListing(token1.address);
    await expect(tokenMarket.connect(customer1).buyTokens(token1.address, ethers.utils.parseEther("1"), {value: ethers.utils.parseEther("1")})).to.be.revertedWith('Sale is not active');
  });

  it('Should not be able to buy a token if units are less than units available', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    await expect(tokenMarket.connect(customer1).buyTokens(token1.address, ethers.utils.parseEther("60"), {value: ethers.utils.parseEther("60")})).to.be.revertedWith("Units not available");
  });

  it('Should not be able to buy if the msg.value does not equals the cost', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    await expect(tokenMarket.connect(customer1).buyTokens(token1.address, ethers.utils.parseEther("1"), {value: ethers.utils.parseEther("10")})).to.be.revertedWith("Amount provided not correct");
  });

  it('Successfully buying tokens should reduce the units available', async function () {
    await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, ethers.utils.parseEther("50"));
    await token1.approve(tokenMarket.address, ethers.utils.parseEther("50"));
    await tokenMarket.connect(customer1).buyTokens(token1.address, ethers.utils.parseEther("1"), {value: ethers.utils.parseEther("1")});
    var [,,,,,unitsAvailable] = await tokenMarket.getListingDetails(token1.address);
    expect(unitsAvailable).to.be.equal(ethers.utils.parseEther("49"));
    expect(await token1.balanceOf(customer1.address)).to.be.equal(ethers.utils.parseEther("1"))
    // can also check balance
  });

})