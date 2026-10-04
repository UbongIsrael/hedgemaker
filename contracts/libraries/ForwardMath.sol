// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Shared exact integer arithmetic for USD/NGN forward contracts.
library ForwardMath {
    uint256 internal constant BPS = 10_000;

    error InvalidRate();
    error SignedOverflow();
    error InvalidOffset();
    error InvalidTick();

    /// @dev Buyer value = truncTowardZero(N * (R-K) / R). Seller is its negation.
    function buyerValue(uint256 notionalRaw, uint256 rateRaw, uint256 strikeRaw) internal pure returns (int256) {
        if (rateRaw == 0) revert InvalidRate();
        bool positive = rateRaw >= strikeRaw;
        uint256 difference = positive ? rateRaw - strikeRaw : strikeRaw - rateRaw;
        uint256 magnitude = Math.mulDiv(notionalRaw, difference, rateRaw);
        if (magnitude > uint256(type(int256).max)) revert SignedOverflow();
        int256 value = int256(magnitude);
        return positive ? value : -value;
    }

    function sellerValue(uint256 notionalRaw, uint256 rateRaw, uint256 strikeRaw) internal pure returns (int256) {
        return -buyerValue(notionalRaw, rateRaw, strikeRaw);
    }

    function delta(int256 nextValue, int256 previousValue) internal pure returns (int256) {
        // Checked subtraction intentionally rejects values outside the contractual signed domain.
        return nextValue - previousValue;
    }

    /// @notice Peg limit rounded directly to a tick in the owner's protective direction.
    /// @param buyer true rounds down (maximum); false rounds up (minimum).
    function peggedLimit(uint256 rateRaw, int256 offsetBps, uint256 tickRaw, bool buyer)
        internal pure returns (uint256)
    {
        if (tickRaw == 0) revert InvalidTick();
        int256 factorSigned = int256(BPS) + offsetBps;
        if (factorSigned <= 0) revert InvalidOffset();
        uint256 factor = uint256(factorSigned);
        uint256 denominator = BPS * tickRaw;
        uint256 quotient = Math.mulDiv(rateRaw, factor, denominator);
        uint256 remainder = mulmod(rateRaw, factor, denominator);
        if (!buyer && remainder != 0) quotient += 1;
        return quotient * tickRaw;
    }

    function reservePerLot(uint256 initialMarginRaw, uint256 notionalPerLotRaw, int256 offsetBps, bool buyer)
        internal pure returns (uint256)
    {
        int256 signedOffset = buyer ? offsetBps : -offsetBps;
        uint256 adverse = signedOffset > 0
            ? Math.mulDiv(notionalPerLotRaw, uint256(signedOffset), BPS, Math.Rounding.Ceil)
            : 0;
        return initialMarginRaw + adverse;
    }

    function fixedReservePerLot(
        uint256 initialMarginRaw,
        uint256 notionalPerLotRaw,
        uint256 referenceRateRaw,
        uint256 limitStrikeRaw,
        bool buyer
    ) internal pure returns (uint256) {
        if (referenceRateRaw == 0) revert InvalidRate();
        bool adverse = buyer ? limitStrikeRaw > referenceRateRaw : limitStrikeRaw < referenceRateRaw;
        uint256 difference = buyer
            ? (adverse ? limitStrikeRaw - referenceRateRaw : 0)
            : (adverse ? referenceRateRaw - limitStrikeRaw : 0);
        uint256 reserveLoss = adverse
            ? Math.mulDiv(notionalPerLotRaw, difference, referenceRateRaw, Math.Rounding.Ceil)
            : 0;
        return initialMarginRaw + reserveLoss;
    }

    /// @notice Exact relative-band check without overflowing either cross-product.
    function withinRelativeBand(uint256 strikeRaw, uint256 rateRaw, uint16 bandBps) internal pure returns (bool) {
        if (rateRaw == 0) return false;
        uint256 distance = strikeRaw > rateRaw ? strikeRaw - rateRaw : rateRaw - strikeRaw;
        uint256 whole = Math.mulDiv(distance, BPS, rateRaw);
        if (whole < bandBps) return true;
        if (whole > bandBps) return false;
        return mulmod(distance, BPS, rateRaw) == 0;
    }

    function strikeInAbsoluteBounds(uint256 strikeRaw, uint256 minStrikeRaw, uint256 maxStrikeRaw)
        internal pure returns (bool)
    {
        return strikeRaw >= minStrikeRaw && strikeRaw <= maxStrikeRaw;
    }

    function marginForLots(uint256 perLot, uint256 lots) internal pure returns (uint256) {
        return perLot * lots;
    }

    function ceilBps(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return Math.mulDiv(amount, bps, BPS, Math.Rounding.Ceil);
    }

    function abs(int256 value) internal pure returns (uint256) {
        if (value == type(int256).min) revert SignedOverflow();
        return uint256(value < 0 ? -value : value);
    }
}
