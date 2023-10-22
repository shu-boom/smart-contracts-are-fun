const { min } = require('bn.js');
const { expect } = require('chai')
const { ethers } = require('hardhat')
describe('PeriodicLoan', function () {
    beforeEach(async () => {
        accounts = await hre.ethers.getSigners();
        lender = accounts[0];
        borrower = accounts[1];
        // deploy token
        totalSupply = 1000;
        Token = await ethers.getContractFactory("TokenPeriodic", borrower);
        token = await Token.deploy(totalSupply);
        await token.deployed();
        // deploy periodic loan contract with lender as owner
        PeriodicLoan = await hre.ethers.getContractFactory("PeriodicLoan", lender);
        loanAmount = ethers.utils.parseEther("3");
        minimumPayment = ethers.utils.parseEther("0.1");
        interestRateNumerator = 1;
        interestRateDenominator = 20;
        collateralRate = 10;
        collateralAmount = ethers.utils.parseEther("30");
        timePeriod = 10;

        periodicLoan = await PeriodicLoan.deploy(
            borrower.address,
            loanAmount,
            timePeriod,
            collateralRate,
            minimumPayment,
            interestRateNumerator,
            interestRateDenominator,
            collateralAmount,
            token.address,
            {value: loanAmount}
            );
        await periodicLoan.deployed();
        // approve token transfer
        timestampContractCreation = (await ethers.provider.getBlock("latest")).timestamp;
    });

    describe("PeriodicLoan Deployment", () => {
          it("Should set all the parameters correctly", async () => {
            expect(await periodicLoan.lender()).to.equal(lender.address);
            expect(await periodicLoan.borrower()).to.equal(borrower.address);
            expect(await periodicLoan.loanAmount()).to.equal(loanAmount);
            expect(await periodicLoan.minimumPayment()).to.equal(minimumPayment);
            interestRate = await periodicLoan.interestRate();
            expect(interestRate.numerator).to.equal(interestRateNumerator);
            expect(interestRate.denominator).to.equal(interestRateDenominator);
            expect(await periodicLoan.collateralRate()).to.equal(collateralRate);
            expect(await periodicLoan.collateralAmount()).to.equal(loanAmount.mul(collateralRate).toString());
            expect(await periodicLoan.token()).to.equal(token.address);
            expectedTimePeriod = timePeriod * 86400;
            expect(await periodicLoan.timePeriod()).to.equal(timePeriod * 86400);
            contractBalance = await ethers.provider.getBalance(periodicLoan.address);
            expect(contractBalance).to.equal(loanAmount); //transferred to borrower
           
        });
    })


    describe("Lending", () => {
      it("Should lend when all the parameters are correctly defined", async () => {
          await token.connect(borrower).approve(periodicLoan.address, collateralAmount);
          borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);
          lendTx = await periodicLoan.lend();
          timestampLendingStart = (await ethers.provider.getBlock("latest")).timestamp;
          expectedDueDate = ethers.BigNumber.from(timestampLendingStart).add(timePeriod * 86400);
          expect(await periodicLoan.dueDate()).to.equal(expectedDueDate);
          expect(await token.balanceOf(periodicLoan.address)).to.equal(collateralAmount);
          totalSupplyAsBN = ethers.BigNumber.from(ethers.utils.parseEther(totalSupply+""));
          expect(await token.balanceOf(borrower.address)).to.equal(totalSupplyAsBN.sub(ethers.BigNumber.from(collateralAmount)));
          borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);
          expect(borrowerBalanceAfter).to.equal(borrowerBalanceBefore.add(loanAmount));
          await expect(lendTx)
              .to.emit(periodicLoan, "LoanStarted")
              .withArgs(
                lender.address,
                borrower.address,
                minimumPayment,
                interestRate.numerator,
                interestRate.denominator,
                collateralRate,
                loanAmount,
                expectedTimePeriod,
                expectedDueDate
              );
      });

      it("Should empty the contract balance after lend", async () => {
            // check for balance before lending
            expect(await ethers.provider.getBalance(periodicLoan.address)).to.equal(loanAmount);
            await token.connect(borrower).approve(periodicLoan.address, collateralAmount);
            await periodicLoan.lend();
            expect(await ethers.provider.getBalance(periodicLoan.address)).to.equal(0);
      });

      it("Should not lend when collateral is not approved", async () => {
        await token.connect(borrower).approve(periodicLoan.address, 0);
        await expect(periodicLoan.lend())
            .to.be.revertedWith("Insufficent Allowance");
      });
    })


    describe("Payment", () => {
        beforeEach(async () => {
            await token.connect(borrower).approve(periodicLoan.address, collateralAmount);
            await periodicLoan.lend();
            timestampLendingStart = (await ethers.provider.getBlock("latest")).timestamp;
            expectedDueDate = ethers.BigNumber.from(timestampLendingStart).add(timePeriod * 86400);
        });

        it("Should allow borrower to make payment", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = ethers.utils.parseEther("0.1").add(interestAmount);
            paymentTx = await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            expect(await periodicLoan.remainingBalance()).to.equal(loanAmount.sub(paymentAmount.sub(interestAmount)));
        });

        it("Should emit PaymentMade event", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = ethers.utils.parseEther("0.1").add(interestAmount);            paymentTx = await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            expect(paymentTx)
                .to.emit(periodicLoan, "PaymentMade")
                .withArgs(
                    borrower.address,
                    paymentAmount,
                    loanAmount.sub(paymentAmount)
                );
        });

        it("Should revert if payment is not made by borrower", async () => {
            paymentAmount = ethers.utils.parseEther("0.1");
            await expect(periodicLoan.connect(lender).makePayment(paymentAmount, {value: paymentAmount}))
                .to.be.revertedWith("Only borrower can make payment");
        });

        it("Should revert if payment is not made with correct amount", async () => {
            paymentAmount = ethers.utils.parseEther("0.1");
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount.add(1), {value: paymentAmount}))
                .to.be.revertedWith("Payment amount must be equal to the value sent");
        });

        it("Should revert if payment is higher than remaining balance ", async () => {
            paymentAmount = ethers.utils.parseEther("5");
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount}))
                .to.be.revertedWith("Payment amount must be less than or equal to remaining balance plus interest");
        });

        it("Should revert if payment is made after due date", async () => {
            paymentAmount = ethers.utils.parseEther("0.1");
            await ethers.provider.send("evm_increaseTime", [timePeriod * 86400 + 1]);
            await ethers.provider.send("evm_mine");
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount}))
                .to.be.revertedWith("Loan is past due");
        });

        it("Should allow last payment to be less than minimum payment", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = ethers.utils.parseEther("1");
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            principalAmount = paymentAmount.sub(interestAmount);
            expect(await periodicLoan.remainingBalance()).to.equal(loanAmount.sub(principalAmount));
            
            remainingBalance = await periodicLoan.remainingBalance();
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = ethers.utils.parseEther("2.17");
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            principalAmount = paymentAmount.sub(interestAmount);
            expect(await periodicLoan.remainingBalance()).to.equal(remainingBalance.sub(principalAmount));
          
            remainingBalance = await periodicLoan.remainingBalance();
            interestAmount = await periodicLoan.calculateInterestAmount();
            finalPaymentAmount = remainingBalance.add(interestAmount);
            expect(finalPaymentAmount).to.lte(minimumPayment);
            await periodicLoan.connect(borrower).makePayment(finalPaymentAmount, {value: finalPaymentAmount});
            expect(await periodicLoan.remainingBalance()).to.equal(0);            
        })

        it("Should revert if payment is made after loan is fully paid", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount}))
                .to.be.revertedWith("Remaining balance must be greater than zero");
        });

        it("Should revert if payment is made with zero amount", async () => {
            paymentAmount = 0;
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount}))
                .to.be.revertedWith("Payment amount must be equal to the value sent");
        });

        it("Should keep track of due date between payments", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = ethers.utils.parseEther("0.1").add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            expectedDueDate = expectedDueDate.add(timePeriod*86400);
            expect(await periodicLoan.dueDate()).to.equal(expectedDueDate);
            paymentAmount = ethers.utils.parseEther("0.1").add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            expectedDueDate = expectedDueDate.add(timePeriod*86400);
            expect(await periodicLoan.dueDate()).to.equal(expectedDueDate);
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [3 * timePeriod * 86400],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            paymentAmount = ethers.utils.parseEther("0.1").add(interestAmount);
            await expect(periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount}))
            .to.be.revertedWith("Loan is past due");
        });
    });
    
    describe("Liquidation", () => {
        beforeEach(async () => {
            await token.connect(borrower).approve(periodicLoan.address, collateralAmount);
            await periodicLoan.lend();
            timestampLendingStart = (await ethers.provider.getBlock("latest")).timestamp;
            expectedDueDate = ethers.BigNumber.from(timestampLendingStart).add(timePeriod * 86400);
        });

        it("Should allow lender to liquidate loan", async () => {
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await periodicLoan.connect(lender).liquidateLoan();
            expect(await periodicLoan.liquidated()).to.equal(true);
        });

        it("Should set balances correctly after liquidations", async () => {
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            // check balances before liquidation
            contractBalanceBefore = await ethers.provider.getBalance(periodicLoan.address);
            lenderBalanceBefore = await ethers.provider.getBalance(lender.address);
            
            lendingTx = await periodicLoan.connect(lender).liquidateLoan();
            lendingTxReceipt = await lendingTx.wait();
            gasSpent = lendingTxReceipt.gasUsed.mul(lendingTxReceipt.effectiveGasPrice);

            lenderBalanceAfter = await ethers.provider.getBalance(lender.address);
            expect(await token.balanceOf(periodicLoan.address)).to.equal(0);
            expect(await token.balanceOf(lender.address)).to.equal(collateralAmount);
            expect(await periodicLoan.liquidated()).to.equal(true);
            expect(lenderBalanceAfter).to.equal(lenderBalanceBefore.sub(gasSpent));
        });

        it("Should emit Liquidation event", async () => {
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });

            await expect(periodicLoan.connect(lender).liquidateLoan())
                .to.emit(periodicLoan, "LoanLiquidated")
                .withArgs(
                    lender.address,
                    collateralAmount,
                    0
                );
        });

        it("Should revert if loan is not past due", async () => {
            await expect(periodicLoan.connect(lender).liquidateLoan())
                .to.be.revertedWith("Loan is not past due");
        });

        it("Should revert if loan is already liquidated", async () => {
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await periodicLoan.connect(lender).liquidateLoan();
            await expect(periodicLoan.connect(lender).liquidateLoan())
                .to.be.revertedWith("Loan is already liquidated");
        });

        it("Should revert if loan is already paid", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            await expect(periodicLoan.connect(lender).liquidateLoan())
                .to.be.revertedWith("Loan is already paid");
        });

        it("Should revert if loan is already paid and past due", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await expect(periodicLoan.connect(lender).liquidateLoan())
                .to.be.revertedWith("Loan is already paid");
        });

        it("Should only allow lender to pay the loan", async () => {
            await hre.network.provider.request({
                method: "evm_increaseTime",
                params: [timePeriod * 86400 + 1],
            });
            await hre.network.provider.request({
                method: "evm_mine",
                params: [],
            });
            await expect(periodicLoan.connect(borrower).liquidateLoan())
                .to.be.revertedWith("Only lender can liquidate the loan");
        });
    });


    describe("Close", () => {
        beforeEach(async () => {
            await token.connect(borrower).approve(periodicLoan.address, collateralAmount);
            await periodicLoan.lend();
            timestampLendingStart = (await ethers.provider.getBlock("latest")).timestamp;
            expectedDueDate = ethers.BigNumber.from(timestampLendingStart).add(timePeriod * 86400);
        });

        it("Should allow borrower to close loan", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            tokenBalanceBefore = await token.balanceOf(borrower.address);
            closeTx = await periodicLoan.connect(borrower).close();
            colseTxReceipt = await closeTx.wait();
            gasSpent = colseTxReceipt.gasUsed.mul(colseTxReceipt.effectiveGasPrice);
            expect(await token.balanceOf(borrower.address)).to.equal(tokenBalanceBefore.add(collateralAmount));
            expect(await periodicLoan.closed()).to.equal(true);
            // check for emit event
            expect(closeTx)
                .to.emit(periodicLoan, "LoanClosed")
                .withArgs(
                    lender.address,
                    borrower.address,
                    loanAmount,
                    collateralAmount
                );
        });

        it("Should allow lender to close loan", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            balanceBefore = await ethers.provider.getBalance(lender.address);
            contractBalance = await ethers.provider.getBalance(periodicLoan.address);
            closeTx = await periodicLoan.connect(lender).close();
            colseTxReceipt = await closeTx.wait();
            gasSpent = colseTxReceipt.gasUsed.mul(colseTxReceipt.effectiveGasPrice);
            lenderBalanceAfter= await ethers.provider.getBalance(lender.address);
            expect(await periodicLoan.closed()).to.equal(true);
            expect(lenderBalanceAfter).to.equal(balanceBefore.add(contractBalance).sub(gasSpent));
            // check for emit event
            expect(closeTx)
                .to.emit(periodicLoan, "LoanClosed")
                .withArgs(
                    lender.address,
                    borrower.address,
                    loanAmount,
                    collateralAmount
                );
        });

        it("Should revert if remaining balance is not zero", async () => {
            await expect(periodicLoan.connect(borrower).close())
                .to.be.revertedWith("Remaining balance must be zero");
        });

        it("Should NOT allow anyone other than lender or borrower to close the loan", async () => {
            interestAmount = await periodicLoan.calculateInterestAmount();
            paymentAmount = loanAmount.add(interestAmount);
            await periodicLoan.connect(borrower).makePayment(paymentAmount, {value: paymentAmount});
            await expect(periodicLoan.connect(accounts[3]).close())
                .to.be.revertedWith("Only borrower or lender can close the loan");
        });
    });
});
