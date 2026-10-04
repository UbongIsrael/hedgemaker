// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ForwardMath} from "../libraries/ForwardMath.sol";

contract ForwardMathHarness {
    function buyerValue(uint256 notionalRaw, uint256 rateRaw, uint256 strikeRaw) external pure returns (int256) {
        return ForwardMath.buyerValue(notionalRaw, rateRaw, strikeRaw);
    }

    function fixedReservePerLot(
        uint256 initialMarginRaw,
        uint256 notionalPerLotRaw,
        uint256 referenceRateRaw,
        uint256 limitStrikeRaw,
        bool buyer
    ) external pure returns (uint256) {
        return ForwardMath.fixedReservePerLot(
            initialMarginRaw,
            notionalPerLotRaw,
            referenceRateRaw,
            limitStrikeRaw,
            buyer
        );
    }

    function peggedLimit(uint256 rateRaw, int256 offsetBps, uint256 tickRaw, bool buyer)
        external
        pure
        returns (uint256)
    {
        return ForwardMath.peggedLimit(rateRaw, offsetBps, tickRaw, buyer);
    }
}
