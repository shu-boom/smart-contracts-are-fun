const hre = require("hardhat");
var abi = require('ethereumjs-abi')

async function main() {
  const accounts = await hre.ethers.getSigners();
  var owner = accounts[0];

  var seller1 = accounts[1];
  var seller2 = accounts[2];

  var customer1 = accounts[3];
  var customer2 = accounts[4];
  var customer3 = accounts[5];

  /**
   * Scenario : seller1 publishes token 1 and all customers are able to buy
   * 
   * Scenario : seller2 publishes token 2 and first customer buys all
   */
  const TokenMarket = await hre.ethers.getContractFactory("TokenMarket", owner);
  const tokenMarket = await TokenMarket.deploy();
  await tokenMarket.deployed();
  console.log("Token Market is published on ", tokenMarket.address);

  // publish two erc 20 tokens
  const Token1 = await hre.ethers.getContractFactory("Token1", seller1);
  const token1 = await Token1.deploy("Token1", "TOK1", 18);
  await token1.deployed();
  console.log("Token 1 is published on ", token1.address);
  console.log("Token 1 totalSupply ", await token1.totalSupply());
  console.log("Token 1 balance of seller ", await token1.balanceOf(seller1.address));

  const Token2 = await hre.ethers.getContractFactory("Token2", seller2);
  const token2 = await Token2.deploy("Token2", "TOK2", 18);
  await token2.deployed();
  console.log("Token 2 is published on ", token2.address);
  console.log("Token 2 totalSupply ", await token2.totalSupply());
  console.log("Token 2 balance of seller ", await token2.balanceOf(seller2.address));

  await tokenMarket.connect(seller1).createListing(token1.address, 100, 100, hre.ethers.utils.parseEther("50"));
  await token1.approve(tokenMarket.address, hre.ethers.utils.parseEther("50"));
  await tokenMarket.connect(seller2).createListing(token2.address, 70, 30, hre.ethers.utils.parseEther("100"));
  await token2.approve(tokenMarket.address, hre.ethers.utils.parseEther("100")); 
  console.log("Token Market Listing 1 cost for 10 units ", await tokenMarket.getCostForAListing(token1.address, 10));
  console.log("Token Market Listing 2 cost for 10 units ", await tokenMarket.getCostForAListing(token2.address, 10));
  console.log("Token Market Listing 1 units available ", await tokenMarket.getUnitsAvailable(token1.address));
  console.log("Token Market Listing 2 units available ", await tokenMarket.getUnitsAvailable(token2.address));
  await tokenMarket.connect(customer1).buyTokens(token1.address, hre.ethers.utils.parseEther("1"), {value: hre.ethers.utils.parseEther("1")});
  console.log("Token Market Listing 1 units available ", await tokenMarket.getUnitsAvailable(token1.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
