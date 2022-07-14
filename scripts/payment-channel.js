const hre = require("hardhat");
var abi = require('ethereumjs-abi')

async function main() {
  const accounts = await hre.ethers.getSigners();
  var sender = accounts[0];
  var recepient = accounts[1];
  const PaymentChannel = await hre.ethers.getContractFactory("PaymentChannel", sender);

  const paymentChannel = await PaymentChannel.deploy(1, recepient.address, {value: hre.ethers.utils.parseEther("10")});
  await paymentChannel.deployed();
  // sender signs a message with  9 ethers and hand it to the recepient. Therefore, first we need to build the hash and the signature.   
  console.log("Payment Channel deployed to:", paymentChannel.address);
  console.log("Payment Channel Balance Before", await paymentChannel.getBalance());
  console.log("Balance Before", await ethers.provider.getBalance(recepient.address));
  var sig = await sign(hre.ethers.utils.parseEther("10"), paymentChannel.address);
  var tx = await paymentChannel.connect(recepient).closeChannel(hre.ethers.utils.parseEther("10"), sig.signature);
  console.log("Balance After", await ethers.provider.getBalance(recepient.address));
  console.log(tx);
}

async function sign(amount, contract) {
    let hash = hre.ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract]);
    const testBytes = hre.ethers.utils.arrayify(hash);
    const accounts = await hre.ethers.getSigners();
    var sig = await accounts[0].signMessage(testBytes);
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
