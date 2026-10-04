// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICollateralVault {
    struct OrderLedger {
        address owner;
        uint256 collateral;
        uint256 feeEscrow;
    }

    struct PositionLedger {
        address buyer;
        address seller;
        uint256 buyerCollateral;
        uint256 sellerCollateral;
        bool active;
    }

    struct FillLeg {
        uint256 orderId;
        uint256 collateralConsumed;
        uint256 positionAllocation;
        uint256 feeEscrowConsumed;
        uint256 feeCharged;
    }

    function reserveOrder(uint256 orderId, address owner, uint256 collateral, uint256 feeEscrow) external;

    function releaseOrder(uint256 orderId, address owner) external returns (uint256 released);

    function openPosition(
        uint256 positionId,
        address buyer,
        address seller,
        FillLeg calldata buyerLeg,
        FillLeg calldata sellerLeg
    ) external;

    function addMargin(uint256 positionId, address owner, bool buyerSide, uint256 amount) external;

    function transferVariation(uint256 positionId, bool buyerPays, uint256 requestedAmount)
        external
        returns (uint256 paidAmount, bool exhausted);

    function closePosition(uint256 positionId) external returns (uint256 buyerPayout, uint256 sellerPayout);

    function positionLedger(uint256 positionId) external view returns (PositionLedger memory);

    function settlementToken() external view returns (IERC20);
}
