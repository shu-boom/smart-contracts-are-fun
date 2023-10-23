const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('ReceiverPays', function () {
  beforeEach(async () => {
    const ReceiverPays = await ethers.getContractFactory('ReceiverPays')
    contract = await ReceiverPays.deploy({
      value: ethers.utils.parseEther('10'),
    })
    await contract.deployed();
    signers = await ethers.getSigners();
    owner = signers[0];
    recepient1 = signers[1];
    recepient2 = signers[2];
  });

  it('Should be able to retreive the owner correctly', async function () {
    expect(await contract.owner()).to.be.equal(owner.address);
  });

  it('Should allow only owner to kill the contract', async function () {
    await expect(contract.connect(recepient1).kill()).to.be.revertedWith(
      'Only Owner',
    );
  });

  it('Should allow the recepient with proper credentials to claim the payment', async function () {
    // This test case could be rewritten to measure exact state changes
    let hash = ethers.utils.solidityKeccak256(["address", "uint256", "uint256", "address"], [recepient1.address, ethers.utils.parseEther("1"), 1, contract.address]);
    var sig = await owner.signMessage(ethers.utils.arrayify(hash));
    var balanceBefore = await ethers.provider.getBalance(recepient1.address);
    await contract
      .connect(recepient1)
      .claimPayment(sig, 1, ethers.utils.parseEther('1'));
    var balanceAfter = await ethers.provider.getBalance(recepient1.address);
    expect(Number(balanceAfter)).to.be.greaterThan(Number(balanceBefore));
  })

  it('Should fail on reused nonce', async function () {
    let hash = ethers.utils.solidityKeccak256(["address", "uint256", "uint256", "address"], [recepient1.address, ethers.utils.parseEther("1"), 1, contract.address]);
    var sig = await owner.signMessage(ethers.utils.arrayify(hash));
    await contract
      .connect(recepient1)
      .claimPayment(sig, 1, ethers.utils.parseEther('1'));
    await expect(contract.connect(recepient1).claimPayment(sig, 1, ethers.utils.parseEther('1'))).to.be.revertedWith(
      "Nonce already used",
    );
  })

  it('Should fail on wrong signer', async function () {
    let hash = ethers.utils.solidityKeccak256(["address", "uint256", "uint256", "address"], [recepient1.address, ethers.utils.parseEther("1"), 1, contract.address]);
    var sig = await recepient2.signMessage(ethers.utils.arrayify(hash));
    await expect(contract.connect(recepient1).claimPayment(sig, 1, ethers.utils.parseEther('1'))).to.be.revertedWith(
      "Wrong Signer"
    );
  })
})
