const hre = require("hardhat");
var abi = require('ethereumjs-abi')

async function main() {
  const accounts = await hre.ethers.getSigners();
  const ReceiverPays = await hre.ethers.getContractFactory("ReceiverPays", accounts[1]);
  console.log("Deployer Account", accounts[1].address);

  const receiverPays = await ReceiverPays.deploy({value: hre.ethers.utils.parseEther("10")});
  await receiverPays.deployed();

  console.log("Receiver Pays deployed to:", receiverPays.address);

  var signatureForUser0 = await sign(hre.ethers.utils.parseEther("1"), accounts[0].address, 1, receiverPays.address);
  await receiverPays.connect(accounts[0]).claimPayment(signatureForUser0.signature, 1, hre.ethers.utils.parseEther("1"));
  
  var signatureForUser2 = await sign(hre.ethers.utils.parseEther("1"), accounts[2].address, 2, receiverPays.address);
  await receiverPays.connect(accounts[2]).claimPayment(signatureForUser2.signature, 2, hre.ethers.utils.parseEther("1"));
}

async function sign(amount, recepient, nonce, contract) {
    let hash = hre.ethers.utils.solidityKeccak256(["address", "uint256", "uint256", "address"], [recepient, amount, nonce, contract]);
    const testBytes = hre.ethers.utils.arrayify(hash);
    const accounts = await hre.ethers.getSigners();
    var sig = await accounts[1].signMessage(testBytes);
    return {message: hash, signature: sig};
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


module.exports = {
  sign
};
