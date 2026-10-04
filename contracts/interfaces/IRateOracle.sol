// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IRateOracle {
    struct FinalizedRound {
        uint64 roundId;
        uint64 observationTime;
        uint64 finalizedAt;
        uint128 rateRaw;
        bytes32 candidateId;
        bytes32 sourceHash;
    }

    struct ScheduledRound {
        uint64 observationTime;
        uint64 failureDeadline;
        bool configured;
    }

    function latestFinalizedRound(uint64 configVersion) external view returns (FinalizedRound memory);

    function finalizedRound(uint64 configVersion, uint64 roundId) external view returns (FinalizedRound memory);

    function isTradingOpen(uint64 configVersion) external view returns (bool);

    function scheduledRound(uint64 configVersion, uint64 roundId) external view returns (ScheduledRound memory);

    function feedPolicy(uint64 configVersion)
        external
        view
        returns (
            bool configured,
            bytes32 methodologyHash,
            uint128 minRateRaw,
            uint128 maxRateRaw,
            uint16 circuitBreakerBps
        );
}
