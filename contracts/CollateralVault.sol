// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICollateralVault} from "./interfaces/ICollateralVault.sol";

/// @notice Custodies the one configured settlement asset and maintains explicit,
///         conserved ledgers for orders, positions, claims, and earned fees.
contract CollateralVault is AccessManaged, ReentrancyGuard, ICollateralVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable override settlementToken;
    address public controller;

    uint256 public totalOrderCollateral;
    uint256 public totalFeeEscrow;
    uint256 public totalPositionCollateral;
    uint256 public totalClaims;
    uint256 public earnedFees;

    mapping(uint256 orderId => OrderLedger) private _orderLedgers;
    mapping(uint256 positionId => PositionLedger) private _positionLedgers;
    mapping(address owner => uint256 amount) public claimable;

    event ControllerBound(address indexed controller);
    event OrderReserved(
        uint256 indexed orderId,
        address indexed owner,
        uint256 collateral,
        uint256 feeEscrow
    );
    event OrderReleased(uint256 indexed orderId, address indexed owner, uint256 released);
    event PositionOpened(
        uint256 indexed positionId,
        address indexed buyer,
        address indexed seller,
        uint256 buyerCollateral,
        uint256 sellerCollateral,
        uint256 feesEarned
    );
    event MarginAdded(uint256 indexed positionId, address indexed owner, bool buyerSide, uint256 amount);
    event VariationTransferred(
        uint256 indexed positionId,
        bool buyerPays,
        uint256 requestedAmount,
        uint256 paidAmount,
        bool exhausted
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed buyer,
        address indexed seller,
        uint256 buyerPayout,
        uint256 sellerPayout
    );
    event ClaimWithdrawn(address indexed owner, uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    error InvalidToken();
    error InvalidAmount();
    error ControllerAlreadyBound();
    error UnauthorizedController(address caller);
    error LedgerAlreadyExists();
    error LedgerNotFound();
    error InvalidOwner();
    error InsufficientLedgerBalance();
    error UnsupportedTokenBehavior(uint256 expected, uint256 received);
    error Insolvent(uint256 assets, uint256 liabilities);

    modifier onlyController() {
        if (msg.sender != controller) revert UnauthorizedController(msg.sender);
        _;
    }

    constructor(address initialAuthority, IERC20 settlementToken_) AccessManaged(initialAuthority) {
        if (address(settlementToken_) == address(0) || address(settlementToken_).code.length == 0) revert InvalidToken();
        if (IERC20Metadata(address(settlementToken_)).decimals() != 6) revert InvalidToken();
        settlementToken = settlementToken_;
    }

    /// @notice Irreversibly binds the only contract allowed to mutate protocol ledgers.
    function bindController(address controller_) external restricted {
        if (controller != address(0)) revert ControllerAlreadyBound();
        if (controller_ == address(0) || controller_.code.length == 0) revert InvalidToken();
        controller = controller_;
        emit ControllerBound(controller_);
    }

    function reserveOrder(uint256 orderId, address owner, uint256 collateral, uint256 feeEscrow)
        external
        override
        onlyController
    {
        if (owner == address(0) || collateral == 0) revert InvalidAmount();
        if (_orderLedgers[orderId].owner != address(0)) revert LedgerAlreadyExists();

        uint256 amount = uint256(collateral) + feeEscrow;
        _pullExact(owner, amount);
        _orderLedgers[orderId] = OrderLedger({owner: owner, collateral: collateral, feeEscrow: feeEscrow});
        totalOrderCollateral += collateral;
        totalFeeEscrow += feeEscrow;
        _assertSolvent();
        emit OrderReserved(orderId, owner, collateral, feeEscrow);
    }

    function releaseOrder(uint256 orderId, address owner)
        external
        override
        onlyController
        returns (uint256 released)
    {
        OrderLedger storage ledger = _orderLedgers[orderId];
        if (ledger.owner == address(0)) revert LedgerNotFound();
        if (ledger.owner != owner) revert InvalidOwner();
        released = uint256(ledger.collateral) + ledger.feeEscrow;
        totalOrderCollateral -= ledger.collateral;
        totalFeeEscrow -= ledger.feeEscrow;
        delete _orderLedgers[orderId];
        _creditClaim(owner, released);
        _assertSolvent();
        emit OrderReleased(orderId, owner, released);
    }

    function openPosition(
        uint256 positionId,
        address buyer,
        address seller,
        FillLeg calldata buyerLeg,
        FillLeg calldata sellerLeg
    ) external override onlyController {
        if (buyer == address(0) || seller == address(0) || buyer == seller) revert InvalidOwner();
        if (_positionLedgers[positionId].active) revert LedgerAlreadyExists();

        (uint256 buyerClaim, uint256 buyerFee) = _consumeFillLeg(buyerLeg, buyer);
        (uint256 sellerClaim, uint256 sellerFee) = _consumeFillLeg(sellerLeg, seller);
        _positionLedgers[positionId] = PositionLedger({
            buyer: buyer,
            seller: seller,
            buyerCollateral: buyerLeg.positionAllocation,
            sellerCollateral: sellerLeg.positionAllocation,
            active: true
        });
        totalPositionCollateral += uint256(buyerLeg.positionAllocation) + sellerLeg.positionAllocation;
        _creditClaim(buyer, buyerClaim);
        _creditClaim(seller, sellerClaim);
        earnedFees += buyerFee + sellerFee;
        _assertSolvent();

        emit PositionOpened(
            positionId,
            buyer,
            seller,
            buyerLeg.positionAllocation,
            sellerLeg.positionAllocation,
            buyerFee + sellerFee
        );
    }

    function addMargin(uint256 positionId, address owner, bool buyerSide, uint256 amount)
        external
        override
        onlyController
    {
        if (amount == 0) revert InvalidAmount();
        PositionLedger storage ledger = _positionLedgers[positionId];
        if (!ledger.active) revert LedgerNotFound();
        if ((buyerSide ? ledger.buyer : ledger.seller) != owner) revert InvalidOwner();
        _pullExact(owner, amount);
        if (buyerSide) ledger.buyerCollateral += amount;
        else ledger.sellerCollateral += amount;
        totalPositionCollateral += amount;
        _assertSolvent();
        emit MarginAdded(positionId, owner, buyerSide, amount);
    }

    function transferVariation(uint256 positionId, bool buyerPays, uint256 requestedAmount)
        external
        override
        onlyController
        returns (uint256 paidAmount, bool exhausted)
    {
        PositionLedger storage ledger = _positionLedgers[positionId];
        if (!ledger.active) revert LedgerNotFound();
        uint256 available = buyerPays ? ledger.buyerCollateral : ledger.sellerCollateral;
        paidAmount = requestedAmount < available ? requestedAmount : available;
        exhausted = requestedAmount >= available && requestedAmount != 0;
        if (paidAmount != 0) {
            if (buyerPays) {
                ledger.buyerCollateral -= paidAmount;
                ledger.sellerCollateral += paidAmount;
            } else {
                ledger.sellerCollateral -= paidAmount;
                ledger.buyerCollateral += paidAmount;
            }
        }
        emit VariationTransferred(positionId, buyerPays, requestedAmount, paidAmount, exhausted);
    }

    function closePosition(uint256 positionId)
        external
        override
        onlyController
        returns (uint256 buyerPayout, uint256 sellerPayout)
    {
        PositionLedger storage ledger = _positionLedgers[positionId];
        if (!ledger.active) revert LedgerNotFound();
        buyerPayout = ledger.buyerCollateral;
        sellerPayout = ledger.sellerCollateral;
        address buyer = ledger.buyer;
        address seller = ledger.seller;
        ledger.active = false;
        ledger.buyerCollateral = 0;
        ledger.sellerCollateral = 0;
        totalPositionCollateral -= uint256(buyerPayout) + sellerPayout;
        _creditClaim(buyer, buyerPayout);
        _creditClaim(seller, sellerPayout);
        _assertSolvent();
        emit PositionClosed(positionId, buyer, seller, buyerPayout, sellerPayout);
    }

    function withdrawClaimable(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > claimable[msg.sender]) revert InvalidAmount();
        claimable[msg.sender] -= amount;
        totalClaims -= amount;
        settlementToken.safeTransfer(msg.sender, amount);
        _assertSolvent();
        emit ClaimWithdrawn(msg.sender, amount);
    }

    function withdrawEarnedFees(address recipient, uint256 amount) external restricted nonReentrant {
        if (recipient == address(0) || amount == 0 || amount > earnedFees) revert InvalidAmount();
        earnedFees -= amount;
        settlementToken.safeTransfer(recipient, amount);
        _assertSolvent();
        emit FeesWithdrawn(recipient, amount);
    }

    function orderLedger(uint256 orderId) external view returns (OrderLedger memory) {
        return _orderLedgers[orderId];
    }

    function positionLedger(uint256 positionId) external view override returns (PositionLedger memory) {
        return _positionLedgers[positionId];
    }

    function liabilities() public view returns (uint256) {
        return totalOrderCollateral + totalFeeEscrow + totalPositionCollateral + totalClaims + earnedFees;
    }

    function surplus() external view returns (uint256) {
        uint256 assets = settlementToken.balanceOf(address(this));
        uint256 owed = liabilities();
        return assets > owed ? assets - owed : 0;
    }

    function _consumeFillLeg(FillLeg calldata leg, address expectedOwner)
        private
        returns (uint256 claimCredit, uint256 feeEarned)
    {
        OrderLedger storage ledger = _orderLedgers[leg.orderId];
        if (ledger.owner == address(0)) revert LedgerNotFound();
        if (ledger.owner != expectedOwner) revert InvalidOwner();
        if (
            leg.collateralConsumed > ledger.collateral || leg.positionAllocation > leg.collateralConsumed
                || leg.feeEscrowConsumed > ledger.feeEscrow || leg.feeCharged > leg.feeEscrowConsumed
        ) revert InsufficientLedgerBalance();

        ledger.collateral -= leg.collateralConsumed;
        ledger.feeEscrow -= leg.feeEscrowConsumed;
        totalOrderCollateral -= leg.collateralConsumed;
        totalFeeEscrow -= leg.feeEscrowConsumed;
        claimCredit = uint256(leg.collateralConsumed - leg.positionAllocation)
            + (leg.feeEscrowConsumed - leg.feeCharged);
        feeEarned = leg.feeCharged;
    }

    function _pullExact(address owner, uint256 amount) private {
        uint256 beforeBalance = settlementToken.balanceOf(address(this));
        settlementToken.safeTransferFrom(owner, address(this), amount);
        uint256 received = settlementToken.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert UnsupportedTokenBehavior(amount, received);
    }

    function _creditClaim(address owner, uint256 amount) private {
        if (amount == 0) return;
        claimable[owner] += amount;
        totalClaims += amount;
    }

    function _assertSolvent() private view {
        uint256 assets = settlementToken.balanceOf(address(this));
        uint256 owed = liabilities();
        if (assets < owed) revert Insolvent(assets, owed);
    }
}
