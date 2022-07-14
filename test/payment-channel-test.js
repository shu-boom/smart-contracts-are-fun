const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('PaymentChannel', function () {
  beforeEach(async () => {
    accounts = await hre.ethers.getSigners();
    sender = accounts[0];
    recepient = accounts[1];
    PaymentChannel = await hre.ethers.getContractFactory("PaymentChannel", sender);
    contract = await PaymentChannel.deploy(1, recepient.address, {value: hre.ethers.utils.parseEther("10")});
    await contract.deployed();
  });
  // await hre.ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);

  it('Should retrieve the owner, recepient, and expirationTime correctly', async function () {
    expect(await contract.owner()).to.be.equal(sender.address);
    expect(await contract.recepient()).to.be.equal(recepient.address);
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp + (1 * 24 * 60 * 60);
    expect(await contract.expirationTime()).to.be.equal(timestampBefore);
  });

  it('Owner should be able to extend the time correctly', async function () {
    var blockNumBefore = await ethers.provider.getBlockNumber();
    var blockBefore = await ethers.provider.getBlock(blockNumBefore);
    var timestampBefore = blockBefore.timestamp + (1 * 24 * 60 * 60);
    var currentExpirationTime = await contract.expirationTime();
    expect(currentExpirationTime).to.be.equal(timestampBefore);
    await contract.extendExpirationTime(2); // extend the current expiration time by two days
    var blockNumAfter = await ethers.provider.getBlockNumber();
    var blockAfter = await ethers.provider.getBlock(blockNumAfter);
    var extendedTime = blockAfter.timestamp + (2 * 24 * 60 * 60)
    expect(await contract.expirationTime()).to.be.equal(extendedTime);
  });

  it('Owner should be able to claim once the expiration time is finished', async function () {
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
    const balanceBeforeContractDeletion =  await ethers.provider.getBalance(sender.address);
    await contract.claimTimeout();
    const balanceAfterContractDeletion =  await ethers.provider.getBalance(sender.address);
    expect(Number(balanceAfterContractDeletion)).to.be.greaterThan(Number(balanceBeforeContractDeletion));
    await expect(contract.getBalance()).to.be.reverted;
  });

  it('Owner should NOT be able to claim if the expiration time is NOT finished', async function () {
    await expect(contract.claimTimeout()).to.be.revertedWith('Channel is not expired');
    await expect(contract.connect(recepient).claimTimeout()).to.be.revertedWith('Only Owner');
  });

  it('Should NOT allow anyone other than the recepient to call the closeChannel function', async function () {
    var amount = ethers.utils.parseEther("1");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await sender.signMessage(testBytes);
    await expect(contract.closeChannel(amount, sig)).to.be.revertedWith('Only Recepient');
  });
  
  it('Should NOT allow the recepient to withdraw once the channel has expired', async function () {
    var amount = ethers.utils.parseEther("1");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await sender.signMessage(testBytes);
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
    await expect(contract.connect(recepient).closeChannel(amount, sig)).to.be.revertedWith('Channel only expired');
  });


  it('Should NOT allow the recepient to withdraw once the channel has expired', async function () {
    var amount = ethers.utils.parseEther("1");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await sender.signMessage(testBytes);
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
    await expect(contract.connect(recepient).closeChannel(amount, sig)).to.be.revertedWith('Channel only expired');
  });

  it('Should REVERT if the amount is larger than the ethers escrowed', async function () {
    var amount = ethers.utils.parseEther("11");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await sender.signMessage(testBytes);
    await expect(contract.connect(recepient).closeChannel(amount, sig)).to.be.revertedWith('Not enough ether escrowed');
  });

  it('Should REVERT if the signature is not signed by the owner', async function () {
    var amount = ethers.utils.parseEther("1");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await recepient.signMessage(testBytes);
    await expect(contract.connect(recepient).closeChannel(amount, sig)).to.be.revertedWith('Not signed by owner');
  });

  it('Should ALLOW the recepient to close the channel with a proper signature', async function () {
    var amount = ethers.utils.parseEther("1");
    let hash = ethers.utils.solidityKeccak256(["uint256", "address"], [amount, contract.address]);
    const testBytes = ethers.utils.arrayify(hash);
    var sig = await sender.signMessage(testBytes);
    await contract.connect(recepient).closeChannel(amount, sig)
    await expect(contract.getBalance()).to.be.reverted;
  });

})
