const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('LoanManager', function () {
    beforeEach(async () => {
        accounts = await hre.ethers.getSigners();
        sender = accounts[0];
        borrower = accounts[1];
        lender = accounts[2];
        //deploy token contract with borrower as owner
        const token = await hre.ethers.getContractFactory("TokenLoan", borrower);
        tokenContract = await token.deploy(1000);
        await tokenContract.deployed();

        //deploy loan manager contract with sender as owner
        LoanManager = await hre.ethers.getContractFactory("LoanManager", sender);
        contract = await LoanManager.deploy();
        await contract.deployed();
    });

    describe("LoanManager Deployment", () => {
        it("Should set the right owner", async () => {
            expect(await contract.owner()).to.equal(sender.address);
        });
    })

    describe("Creating Loan", () => {
        it("Should create a loan request with the right parameters", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            var loanRequestId = await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await loanRequestId.wait();
            expect(await contract.loanRequestCounter()).to.equal(1);
            expect(loanRequestId)
                .to.emit(LoanManager, "LoanRequestCreated")
                .withArgs(
                    1,
                    borrower.address,
                    loanAmount,
                    collateralAmount,
                    tokenContract.address,
                    payoffAmount,
                    loanDuration
                );
        });

        it("Should NOT create a loan request if payoff amount is lower than loan amount ", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("9");
            await expect(
                contract.connect(borrower).createLoanRequest(
                    loanAmount,
                    tokenContract.address,
                    collateralAmount,
                    payoffAmount,
                    loanDuration
                )
            ).to.be.revertedWith("Payoff amount must be greater than loanAmount");
        });
        
        it("Should NOT create a loan request if payoff amount is equal to loan amount ", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("10");
            await expect(
                contract.connect(borrower).createLoanRequest(
                    loanAmount,
                    tokenContract.address,
                    collateralAmount,
                    payoffAmount,
                    loanDuration
                )
            ).to.be.revertedWith("Payoff amount must be greater than loanAmount");
        });

        it("Should NOT create a loan request if loan amount is 0", async () => {
            collateralAmount = hre.ethers.utils.parseEther("9");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await expect(
                contract.connect(borrower).createLoanRequest(
                    0,
                    tokenContract.address,
                    collateralAmount,
                    payoffAmount,
                    loanDuration
                )
            ).to.be.revertedWith("Amount must be greater than 0.");
        });

        it("Should NOT create a loan request if Collateral amount is 0", async () => {
            collateralAmount = hre.ethers.utils.parseEther("0");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await expect(
                contract.connect(borrower).createLoanRequest(
                    loanAmount,
                    tokenContract.address,
                    collateralAmount,
                    payoffAmount,
                    loanDuration
                )
            ).to.be.revertedWith("Collateral Amount must be greater than 0.");
        });

        it("Should NOT create a loan request if loan duration is 0", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 0;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await expect(
                contract.connect(borrower).createLoanRequest(
                    loanAmount,
                    tokenContract.address,
                    collateralAmount,
                    payoffAmount,
                    loanDuration
                )
            ).to.be.revertedWith("Duration must be greater than 0.");
        });
    });

    describe("Lending Loan", () => {
        it("Should lend a loan request with the right parameters", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            var lendingTx = await contract.connect(lender).lend(1, { value: loanAmount });
            expect(await contract.loanRequestCounter()).to.equal(1);
            expect(await contract.loanCounter()).to.equal(1);
            expect(await tokenContract.balanceOf(contract.address)).to.equal(collateralAmount);
            expect(lendingTx)
            .to.emit(LoanManager, "LoanFulfilled")
            .withArgs(
                1,
                lender.address,
                borrower.address,
                loanAmount,
                collateralAmount,
                tokenContract.address,
                payoffAmount,
                loanDuration
            );
        });

        it("Should NOT lend a loan request if loan request does not exist", async () => {
            await expect(contract.connect(lender).lend(1, { value: loanAmount })).to.be.revertedWith(
                "Invalid loan request id."
            );
        });

        it("Should NOT lend a loan request if loan request is already fulfilled", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await contract.connect(lender).lend(1, { value: loanAmount });
            await expect(contract.connect(lender).lend(1, { value: loanAmount })).to.be.revertedWith(
                "Loan request is already fulfilled."
            );
        });

        it("Should NOT lend a loan request if loan amount is not equal to msg.value", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await expect(contract.connect(lender).lend(1, { value: payoffAmount })).to.be.revertedWith(
                "Amount must be equal to the loan request amount."
            );
        });


        it("Should NOT lend a loan if borrower is the lender", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await expect(contract.connect(borrower).lend(1, { value: loanAmount })).to.be.revertedWith(
                "Borrower cannot lend to their own loan request."
            );
        });

    
        it("Should NOT lend a loan if collateral token is not approved", async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await expect(contract.connect(lender).lend(1, { value: loanAmount })).to.be.revertedWith("Insufficent Allowance");
        });
    })

    describe("Repaying Loan", () => {
        beforeEach(async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await contract.connect(lender).lend(1, { value: loanAmount });
        });

        it("Should repay a loan with correct parameters", async ()=>{
            const payLoantx = await contract.connect(borrower).payLoan(1, {value: payoffAmount})
            expect(payLoantx)
            .to.emit(LoanManager, "LoanPaidBack")
            .withArgs(
                1,
                lender.address,
                borrower.address,
                loanAmount,
                collateralAmount,
                tokenContract.address,
                payoffAmount,
                loanDuration
            );
        });

        it("Should NOT allow repaying the loan after loan duration is expired", async ()=>{
            //forward time by 5 days in ganache
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [loanDuration * 24 * 60 * 60],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await expect(contract.connect(borrower).payLoan(1, {value: payoffAmount})).to.be.revertedWith("Loan duration expired");
        })

        it("Should NOT allow anyone other than borrower to repay the loan", async ()=>{
            await expect(contract.connect(lender).payLoan(1, {value: payoffAmount})).to.be.revertedWith("Only borrower can pay the loan.");
        })

        it("Should NOT allow repaying if msg.value is not equal to the payoff amount", async ()=>{
            await expect(contract.connect(borrower).payLoan(1, {value: loanAmount})).to.be.revertedWith("Amount must be equal to the payoff amount.");
        })

        it("Should increase balance of lender by payoff amount after repaying loan", async ()=>{
            const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);
            const payLoantx = await contract.connect(borrower).payLoan(1, {value: payoffAmount});
            const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);
            expect(lenderBalanceAfter).to.equal(lenderBalanceBefore.add(payoffAmount));
        })

        it("Should increase token balance of borrowe by collateral amount after repaying loan", async ()=>{
            const borrowerBalanceBefore = await tokenContract.balanceOf(borrower.address);
            const payLoantx = await contract.connect(borrower).payLoan(1, {value: payoffAmount});
            const borrowerBalanceAfter = await tokenContract.balanceOf(borrower.address);
            expect(borrowerBalanceAfter).to.equal(borrowerBalanceBefore.add(collateralAmount));
        })
    });

    describe("Liquidating Loan", () => {
        beforeEach(async () => {
            collateralAmount = hre.ethers.utils.parseEther("100");
            await tokenContract.connect(borrower).approve(contract.address, collateralAmount);
            loanAmount = hre.ethers.utils.parseEther("10");
            loanDuration = 5;
            payoffAmount = hre.ethers.utils.parseEther("11");
            await contract.connect(borrower).createLoanRequest(
                loanAmount,
                tokenContract.address,
                collateralAmount,
                payoffAmount,
                loanDuration
            );
            await contract.connect(lender).lend(1, { value: loanAmount });
        });

        it("Should liquidate a loan with correct parameters", async ()=>{
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [loanDuration * 24 * 60 * 60],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            const liquidateLoantx = await contract.connect(lender).liquidateLoan(1);
            expect(liquidateLoantx)
            .to.emit(LoanManager, "LoanLiquidated")
            .withArgs(
                1,
                lender.address,
                borrower.address,
                loanAmount,
                collateralAmount,
                tokenContract.address,
                payoffAmount,
                loanDuration
            );
        })

        it("Should NOT allow liquidating loan if id is not valid", async ()=>{
            await expect(contract.connect(lender).liquidateLoan(2)).to.be.revertedWith("Invalid loan id.");
        })

        it("Should NOT allow anyone other than lender to liquidate the loan", async ()=>{
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [loanDuration * 24 * 60 * 60],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await expect(contract.connect(borrower).liquidateLoan(1)).to.be.revertedWith("Only lender can liquidate the loan.");
        })

        it("Should increase the token balance of lender by collateral amount after liquidating loan", async ()=>{
            const lenderBalanceBefore = await tokenContract.balanceOf(lender.address);
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [loanDuration * 24 * 60 * 60],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            const liquidateLoantx = await contract.connect(lender).liquidateLoan(1);
            const lenderBalanceAfter = await tokenContract.balanceOf(lender.address);
            expect(lenderBalanceAfter).to.equal(lenderBalanceBefore.add(collateralAmount));
        })

    })
});