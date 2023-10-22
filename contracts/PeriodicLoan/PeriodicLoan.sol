// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IERC20.sol";
import "hardhat/console.sol";
/***
    The lender creates a loan and each Number is a fraction with a numerator and denominator.

    Loan Amount is the amount lent out to the borrower against the collateral amount 
    The collateral amount is represented as a token
    So we have token and ether as loan 
    We have 1000 tokens which are represented as wei internally so we have 1000 * 10^18
    Suppose, we create a loan with 10 ethers and we would like to have 

 */

contract PeriodicLoan {
    // state variables
    struct Rational {
        uint256 numerator;
        uint256 denominator;
    }
 
    address public lender;
    address public borrower;
    uint256 public minimumPayment;
    Rational public interestRate;
    uint8 public collateralRate;
    uint256 public collateralAmount;
    uint256 public loanAmount;
    uint256 public remainingBalance;
    uint256 public timePeriod;
    uint256 public dueDate;
    IERC20 public token;
    bool public liquidated;
    bool public closed;

    constructor(
        address _borrower,
        uint256 _loanAmount,
        uint256 _timePeriod,
        uint8 _collateralRate,
        uint256 _minimumPayment,
        uint256 _interestRateNumerator,
        uint256 _interestRateDenominator,
        uint256 _collateralAmount,
        address _token
    ) payable {
        require(msg.value == _loanAmount, "Loan amount must be equal to the value sent");
        lender = msg.sender;
        borrower = _borrower;
        collateralRate = _collateralRate;
        timePeriod = _timePeriod * 1 days;
        loanAmount = _loanAmount;
        minimumPayment = _minimumPayment;
        interestRate = Rational(_interestRateNumerator, _interestRateDenominator);
        require(_collateralAmount >= loanAmount * collateralRate, "Collateral amount must be greater than collateral rate");
        collateralAmount = _collateralAmount;
        token = IERC20(_token);
    }


    //lend
    function lend(
    ) public payable {
        require(msg.sender == lender, "Only lender can lend");
        require(remainingBalance == 0, "Remaining balance must be zero");
        dueDate = block.timestamp + timePeriod;
        remainingBalance = loanAmount;
        token.transferFrom(borrower, address(this), collateralAmount);
        payable(borrower).transfer(loanAmount);
        emit LoanStarted(lender, borrower, minimumPayment, interestRate.numerator, interestRate.denominator, collateralRate, loanAmount, timePeriod, dueDate);
    }



    // events
    event LoanStarted(
        address indexed lender,
        address indexed borrower,
        uint256 minimumPayment,
        uint256 interestRateNumerator,
        uint256 interestRateDenominator,
        uint8 collateralRate,
        uint256 loanAmount,
        uint256 timePeriod,
        uint256 dueDate
    );

    event LoanPaymentMade(address indexed borrower, uint256 amount, uint256 principleAmount, uint256 remainingBalance);
    event LoanClosed(address indexed lender, address indexed borrower, uint256 contractBalance, uint256 collateralAmount);
    event LoanLiquidated(address indexed lender, uint256 tokenAmount, uint256 etherAmount);

    /**

     */
    function makePayment(uint _paymentAmount) public payable {
        require(block.timestamp <= dueDate, "Loan is past due");
        require(msg.value == _paymentAmount && msg.value>0, "Payment amount must be equal to the value sent");
        require(msg.sender == borrower, "Only borrower can make payment");
        require(remainingBalance > 0, "Remaining balance must be greater than zero");

        uint interest = calculateInterestAmount();
        require(_paymentAmount <= remainingBalance + interest, "Payment amount must be less than or equal to remaining balance plus interest");
        require(_paymentAmount >= minimumPayment + interest || remainingBalance <= minimumPayment  + interest, "Payment amount must be greater than minimum payment"); // minimum payment should become interest rate 
        uint principleAmount = _paymentAmount - interest;
        require(principleAmount > 0, "Principle amount must be greater than zero");

        remainingBalance = remainingBalance - principleAmount;
        dueDate += timePeriod;
        emit LoanPaymentMade(borrower, _paymentAmount, principleAmount, remainingBalance);
    }

    function calculateInterestAmount() public view returns(uint256) {
        return (remainingBalance * interestRate.numerator / interestRate.denominator);   
    }

    function close() public payable {
        require(remainingBalance == 0, "Remaining balance must be zero");
        require(msg.sender == lender || msg.sender == borrower, "Only borrower or lender can close the loan");
        closed = true;
        token.transfer(borrower, collateralAmount);
        payable(lender).transfer(address(this).balance);
        emit LoanClosed(lender, borrower, address(this).balance, collateralAmount);
    }


    function liquidateLoan() public payable {
        require(liquidated == false, "Loan is already liquidated");
        require(remainingBalance > 0, "Loan is already paid");
        require(block.timestamp > dueDate , "Loan is not past due");
        require(msg.sender == lender, "Only lender can liquidate the loan");
        liquidated = true;
        token.transfer(lender, collateralAmount);
        payable(lender).transfer(address(this).balance);
        emit LoanLiquidated(lender, collateralAmount, address(this).balance);
    }
}