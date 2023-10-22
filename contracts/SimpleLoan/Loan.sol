// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
    * @title LoanManager
    * @dev Implements the loan management
    
    This loan manager contract allows users to request loans and lenders to provide loans.
    The loan manager contract allows borrowers to request loans and lenders to fulfill the loan requests based on the preferred collateral.
    
    A borrower creates a loan request by specifying the amount of loan, the collateral, payoff amount, and the duration of the loan.
    Payoff amount is used to replace interest rates and penalty fees. The payoff amount is the amount that the borrower will pay back to the lender.
    The duration of the loan is the time period that the borrower has to pay back the loan.
    The collateral is the ERC20 token that the borrower will use to secure the loan.

    A lender is only able to fulfill the existing request by lending ether against the collateral specified by the borrower.
    The LoanManager contract holds a number of collateral tokens that are used to secure the loans requested by the borrowers.
    
    The borrower is able to pay back the loan by paying the payoff amount to the lender.
    The lender is able to liquidate the loan if the borrower fails to pay back the loan within the specified duration.
    The lender is able to liquidate the loan by transferring the collateral tokens to their address.
    The borrower is able to get back the collateral tokens by paying the payoff amount to the lender.
    

 */
import "./IERC20.sol";

contract LoanManager {
    // State variables
    address public owner;
    struct LoanRequest {
        address borrower;
        uint256 loanAmount;
        uint256 collateralAmount;
        address token;
        uint256 payoffAmount;
        uint256 duration;
        uint256 timestamp;
    }
    struct Loan {
        address lender;
        address borrower;
        uint256 loanAmount;
        uint256 collateralAmount;
        address token;
        uint256 payoffAmount;
        uint256 duration;
        uint256 timestamp;
    }
    mapping(uint256 => LoanRequest) public loanRequests;
    mapping(uint256 => Loan) public loans;
    uint256 public loanRequestCounter;
    uint256 public loanCounter;

    // Events
    event LoanRequestCreated(
        uint256 indexed loanRequestCounter,
        address indexed borrower,
        uint256 loanAmount,
        uint256 collateralAmount,
        address token,
        uint256 payoffAmount,
        uint256 duration,
        uint256 timestamp
    );
    event LoanFulfilled(
        uint256 indexed loanCounter,
        address indexed lender,
        address indexed borrower,
        uint256 loanAmount,
        uint256 collateralAmount,
        address token,
        uint256 payoffAmount,
        uint256 duration,
        uint256 timestamp
    );
    event LoanPaidBack(
        uint256 indexed loanCounter,
        address indexed lender,
        address indexed borrower,
        uint256 loanAmount,
        uint256 collateralAmount,
        address token,
        uint256 payoffAmount,
        uint256 duration,
        uint256 timestamp
    );

    event LoanLiquidated(
        uint256 indexed loanCounter,
        address indexed lender,
        address indexed borrower,
        uint256 loanAmount,
        uint256 collateralAmount,
        address token,
        uint256 payoffAmount,
        uint256 duration,
        uint256 timestamp
    );

    

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function.");
        _;
    }

    // Constructor
    constructor() {
        owner = msg.sender;
    }

    // Functions

    /**
        * @dev Creates a loan request
        * @param _loanAmount The amount of loan requested
        * @param _token The collateral token address
        * @param _collateralAmount The collateral token address
        * @param _payoffAmount The payoff amount
        * @param _duration The duration of the loan
        * @return loanRequestCounter The loan request counter
     */
    function createLoanRequest(
        uint256 _loanAmount,
        address _token,
        uint256 _collateralAmount,
        uint256 _payoffAmount,
        uint256 _duration) external returns (uint256) {
        require(_loanAmount > 0, "Amount must be greater than 0.");
        require(_collateralAmount > 0, "Collateral Amount must be greater than 0.");
        require(_token != address(0), "Collateral address must not be 0.");
        require(_payoffAmount > _loanAmount, "Payoff amount must be greater than loanAmount");
        require(_duration > 0, "Duration must be greater than 0.");
        loanRequestCounter++;
        loanRequests[loanRequestCounter] = LoanRequest(
            msg.sender,
            _loanAmount,
            _collateralAmount,
            _token,
            _payoffAmount,
            _duration,
            block.timestamp
        );
        emit LoanRequestCreated(
            loanRequestCounter,
            msg.sender,
            _loanAmount,
            _collateralAmount,
            _token,
            _payoffAmount,
            _duration,
            block.timestamp
        );
        return loanRequestCounter;
    }

    /**
        * @dev Fulfills a loan request
        * @param _loanRequestId The loan request counter
        * @return loanCounter The loan counter
     */
     function lend(uint _loanRequestId) external payable returns(uint){
        require(_loanRequestId > 0 && _loanRequestId <= loanRequestCounter, "Invalid loan request id.");
        LoanRequest storage loanRequest = loanRequests[_loanRequestId];
        require(msg.sender != loanRequest.borrower, "Borrower cannot lend to their own loan request.");
        require(msg.value == loanRequest.loanAmount, "Amount must be equal to the loan request amount.");
        require(loans[_loanRequestId].timestamp == 0, "Loan request is already fulfilled.");
        loanCounter++;
        loans[loanCounter] = Loan(
            msg.sender,
            loanRequest.borrower,
            loanRequest.loanAmount,
            loanRequest.collateralAmount,
            loanRequest.token,
            loanRequest.payoffAmount,
            loanRequest.duration,
            block.timestamp
        );
        IERC20(loanRequest.token).transferFrom(loanRequest.borrower, address(this), loanRequest.collateralAmount);
        payable(loanRequest.borrower).transfer(loanRequest.loanAmount);
        emit LoanFulfilled(
            loanCounter,
            msg.sender,
            loanRequest.borrower,
            loanRequest.loanAmount,
            loanRequest.collateralAmount,
            loanRequest.token,
            loanRequest.payoffAmount,
            loanRequest.duration,
            block.timestamp
        );
        return loanCounter;
     }

    /**
        * @dev Pays back a loan
        * @param _loanId The loan counter
     */
     function payLoan(uint _loanId) external payable returns(bool){ 
        require(_loanId > 0 && _loanId <= loanCounter, "Invalid loan id.");
        Loan storage loan = loans[_loanId];
        require(block.timestamp < (loan.timestamp + (loan.duration * 1 days)) , "Loan duration expired");
        require(msg.sender == loan.borrower, "Only borrower can pay the loan.");
        require(msg.value == loan.payoffAmount, "Amount must be equal to the payoff amount.");
        payable(loan.lender).transfer(loan.payoffAmount);
        IERC20(loan.token).transfer(loan.borrower, loan.collateralAmount);
        emit LoanLiquidated(
            _loanId,
            loan.lender,
            loan.borrower,
            loan.loanAmount,
            loan.collateralAmount,
            loan.token,
            loan.payoffAmount,
            loan.duration,
            block.timestamp
        );
        return true;
     }

     function liquidateLoan(uint _loanId) external payable returns (bool)     
     {
        require(_loanId > 0 && _loanId <= loanCounter, "Invalid loan id.");
        Loan storage loan = loans[_loanId];
        require(block.timestamp > (loan.timestamp + (loan.duration * 1 days)) , "Duration to pay back loan  is not expired");
        require(msg.sender == loan.lender, "Only lender can liquidate the loan.");
        IERC20(loan.token).transfer(loan.lender, loan.collateralAmount);
        emit LoanLiquidated(
            _loanId,
            loan.lender,
            loan.borrower,
            loan.loanAmount,
            loan.collateralAmount,
            loan.token,
            loan.payoffAmount,
            loan.duration,
            block.timestamp
        );
        return true;
     }
}


