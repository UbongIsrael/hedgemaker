// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";

/// @notice Signed, challengeable reference-rate observations for HedgeMaker.
/// @dev Feed policies are immutable once configured so live positions cannot have
///      their signer, methodology, bounds, or timing rules rewritten by an admin.
contract RateOracle is AccessManaged, EIP712, IRateOracle {
    using SignatureChecker for address;

    bytes32 public constant OBSERVATION_TYPEHASH = keccak256(
        "Observation(bytes32 deploymentId,uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 observationTime,uint64 publicationTime,uint64 validUntil,uint64 failureDeadline,uint128 rateRaw,bytes32 sourceHash,bytes32 methodologyHash)"
    );

    enum CandidateStatus {
        None,
        Proposed,
        Disputed,
        Rejected,
        Finalized
    }

    struct FeedPolicy {
        address signer;
        address resolver;
        bytes32 methodologyHash;
        uint64 challengePeriod;
        uint64 maxPublicationDelay;
        uint64 maxFailureDelay;
        uint64 staleAfter;
        uint16 circuitBreakerBps;
        uint128 minRateRaw;
        uint128 maxRateRaw;
        bool configured;
    }

    struct Observation {
        uint64 configVersion;
        uint64 roundId;
        bytes32 candidateId;
        uint64 observationTime;
        uint64 publicationTime;
        uint64 validUntil;
        uint64 failureDeadline;
        uint128 rateRaw;
        bytes32 sourceHash;
        bytes32 methodologyHash;
    }

    struct Candidate {
        Observation observation;
        uint64 proposedAt;
        uint64 challengeEndsAt;
        CandidateStatus status;
        bool disputeAccepted;
    }

    bytes32 public immutable deploymentId;

    mapping(uint64 configVersion => FeedPolicy) public feedPolicies;
    mapping(uint64 configVersion => mapping(uint64 roundId => ScheduledRound)) private _scheduledRounds;
    mapping(uint64 configVersion => uint64) public nextScheduleRoundId;
    mapping(bytes32 candidateId => Candidate) public candidates;
    mapping(bytes32 candidateId => bool) public candidateIdUsed;
    mapping(uint64 configVersion => uint64) public nextRoundId;
    mapping(uint64 configVersion => mapping(uint64 roundId => bytes32 candidateId)) public activeCandidate;
    mapping(uint64 configVersion => mapping(uint64 roundId => FinalizedRound)) private _finalizedRounds;
    mapping(uint64 configVersion => FinalizedRound) private _latestFinalizedRounds;
    mapping(bytes32 candidateId => mapping(bytes32 evidenceHash => bool)) public evidenceSubmitted;

    event FeedPolicyConfigured(
        uint64 indexed configVersion,
        address indexed signer,
        address indexed resolver,
        bytes32 methodologyHash
    );
    event RoundScheduled(
        uint64 indexed configVersion,
        uint64 indexed roundId,
        uint64 observationTime,
        uint64 failureDeadline
    );
    event ObservationProposed(
        uint64 indexed configVersion,
        uint64 indexed roundId,
        bytes32 indexed candidateId,
        uint128 rateRaw,
        uint64 observationTime,
        uint64 challengeEndsAt,
        uint64 failureDeadline,
        bytes32 sourceHash
    );
    event EvidenceSubmitted(bytes32 indexed candidateId, address indexed submitter, bytes32 indexed evidenceHash);
    event ObservationDisputed(bytes32 indexed candidateId, address indexed disputer, bytes32 evidenceHash);
    event DisputeResolved(bytes32 indexed candidateId, bool accepted, bytes32 rationaleHash);
    event ObservationFinalized(
        uint64 indexed configVersion,
        uint64 indexed roundId,
        bytes32 indexed candidateId,
        uint128 rateRaw,
        uint64 finalizedAt
    );
    event CircuitBreakerTriggered(
        uint64 indexed configVersion,
        uint64 indexed roundId,
        bytes32 indexed candidateId,
        uint128 previousRateRaw,
        uint128 proposedRateRaw
    );

    error AlreadyConfigured(uint64 configVersion);
    error InvalidAddress();
    error InvalidBounds();
    error FeedNotConfigured(uint64 configVersion);
    error InvalidRound(uint64 expected, uint64 supplied);
    error CandidateAlreadyUsed(bytes32 candidateId);
    error RoundAlreadyHasCandidate(bytes32 candidateId);
    error PreviousCandidateNotRejected(bytes32 candidateId);
    error InvalidObservationTime();
    error InvalidPublicationTime();
    error SignatureExpired();
    error InvalidFailureDeadline();
    error InvalidRate(uint128 rateRaw);
    error MethodologyMismatch();
    error InvalidSourceHash();
    error InvalidSignature();
    error InvalidCandidateState(CandidateStatus status);
    error ChallengeStillOpen(uint64 challengeEndsAt);
    error FailureDeadlineReached(uint64 failureDeadline);
    error UnauthorizedResolver(address caller);
    error EmptyEvidence();
    error DuplicateEvidence(bytes32 evidenceHash);
    error RoundNotScheduled(uint64 configVersion, uint64 roundId);

    constructor(address initialAuthority, bytes32 deploymentId_)
        AccessManaged(initialAuthority)
        EIP712("HedgeMaker Rate Oracle", "1")
    {
        if (deploymentId_ == bytes32(0)) revert InvalidSourceHash();
        deploymentId = deploymentId_;
    }

    function configureFeed(uint64 configVersion, FeedPolicy calldata policy) external restricted {
        if (feedPolicies[configVersion].configured) revert AlreadyConfigured(configVersion);
        if (policy.signer == address(0) || policy.resolver == address(0)) revert InvalidAddress();
        if (
            policy.methodologyHash == bytes32(0) || policy.challengePeriod == 0 || policy.maxPublicationDelay == 0
                || policy.maxFailureDelay <= policy.challengePeriod || policy.staleAfter == 0
                || policy.circuitBreakerBps == 0 || policy.circuitBreakerBps > 10_000
                || policy.minRateRaw == 0 || policy.minRateRaw >= policy.maxRateRaw
        ) revert InvalidBounds();

        feedPolicies[configVersion] = FeedPolicy({
            signer: policy.signer,
            resolver: policy.resolver,
            methodologyHash: policy.methodologyHash,
            challengePeriod: policy.challengePeriod,
            maxPublicationDelay: policy.maxPublicationDelay,
            maxFailureDelay: policy.maxFailureDelay,
            staleAfter: policy.staleAfter,
            circuitBreakerBps: policy.circuitBreakerBps,
            minRateRaw: policy.minRateRaw,
            maxRateRaw: policy.maxRateRaw,
            configured: true
        });
        nextRoundId[configVersion] = 1;
        nextScheduleRoundId[configVersion] = 1;

        emit FeedPolicyConfigured(configVersion, policy.signer, policy.resolver, policy.methodologyHash);
    }

    function scheduleRound(
        uint64 configVersion,
        uint64 roundId,
        uint64 observationTime,
        uint64 failureDeadline
    ) external restricted {
        FeedPolicy storage policy = feedPolicies[configVersion];
        if (!policy.configured) revert FeedNotConfigured(configVersion);
        uint64 expected = nextScheduleRoundId[configVersion];
        if (roundId != expected) revert InvalidRound(expected, roundId);
        if (observationTime == 0 || failureDeadline <= observationTime + policy.challengePeriod) {
            revert InvalidFailureDeadline();
        }
        if (failureDeadline > observationTime + policy.maxFailureDelay) revert InvalidFailureDeadline();
        if (roundId > 1) {
            ScheduledRound storage previous = _scheduledRounds[configVersion][roundId - 1];
            if (observationTime <= previous.observationTime || failureDeadline <= previous.failureDeadline) {
                revert InvalidObservationTime();
            }
        }
        _scheduledRounds[configVersion][roundId] = ScheduledRound({
            observationTime: observationTime,
            failureDeadline: failureDeadline,
            configured: true
        });
        nextScheduleRoundId[configVersion] = roundId + 1;
        emit RoundScheduled(configVersion, roundId, observationTime, failureDeadline);
    }

    function hashObservation(Observation calldata observation) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OBSERVATION_TYPEHASH,
                    deploymentId,
                    observation.configVersion,
                    observation.roundId,
                    observation.candidateId,
                    observation.observationTime,
                    observation.publicationTime,
                    observation.validUntil,
                    observation.failureDeadline,
                    observation.rateRaw,
                    observation.sourceHash,
                    observation.methodologyHash
                )
            )
        );
    }

    function proposeObservation(Observation calldata observation, bytes calldata signature) external {
        FeedPolicy storage policy = feedPolicies[observation.configVersion];
        if (!policy.configured) revert FeedNotConfigured(observation.configVersion);
        uint64 expectedRound = nextRoundId[observation.configVersion];
        if (observation.roundId != expectedRound) revert InvalidRound(expectedRound, observation.roundId);
        ScheduledRound storage schedule = _scheduledRounds[observation.configVersion][observation.roundId];
        if (!schedule.configured) revert RoundNotScheduled(observation.configVersion, observation.roundId);
        if (
            observation.observationTime != schedule.observationTime
                || observation.failureDeadline != schedule.failureDeadline
        ) revert InvalidFailureDeadline();
        if (observation.candidateId == bytes32(0) || candidateIdUsed[observation.candidateId]) {
            revert CandidateAlreadyUsed(observation.candidateId);
        }

        bytes32 priorCandidateId = activeCandidate[observation.configVersion][observation.roundId];
        if (priorCandidateId != bytes32(0)) {
            CandidateStatus priorStatus = candidates[priorCandidateId].status;
            if (priorStatus != CandidateStatus.Rejected) revert PreviousCandidateNotRejected(priorCandidateId);
            Observation storage prior = candidates[priorCandidateId].observation;
            if (
                observation.observationTime != prior.observationTime
                    || observation.failureDeadline != prior.failureDeadline
            ) revert InvalidFailureDeadline();
        }
        if (observation.observationTime > block.timestamp) revert InvalidObservationTime();
        if (
            observation.publicationTime < observation.observationTime
                || observation.publicationTime > observation.observationTime + policy.maxPublicationDelay
                || observation.publicationTime > block.timestamp
        ) revert InvalidPublicationTime();
        if (observation.validUntil < block.timestamp) revert SignatureExpired();
        if (
            observation.failureDeadline <= block.timestamp + policy.challengePeriod
                || observation.failureDeadline > observation.observationTime + policy.maxFailureDelay
        ) revert InvalidFailureDeadline();
        if (observation.rateRaw < policy.minRateRaw || observation.rateRaw > policy.maxRateRaw) {
            revert InvalidRate(observation.rateRaw);
        }
        if (observation.methodologyHash != policy.methodologyHash) revert MethodologyMismatch();
        if (observation.sourceHash == bytes32(0)) revert InvalidSourceHash();
        if (!policy.signer.isValidSignatureNowCalldata(hashObservation(observation), signature)) {
            revert InvalidSignature();
        }

        uint64 proposedAt = uint64(block.timestamp);
        uint64 challengeEndsAt = proposedAt + policy.challengePeriod;
        candidateIdUsed[observation.candidateId] = true;
        activeCandidate[observation.configVersion][observation.roundId] = observation.candidateId;
        CandidateStatus initialStatus = CandidateStatus.Proposed;
        FinalizedRound storage previousRound = _latestFinalizedRounds[observation.configVersion];
        if (previousRound.roundId != 0) {
            uint256 rateDifference = observation.rateRaw > previousRound.rateRaw
                ? observation.rateRaw - previousRound.rateRaw
                : previousRound.rateRaw - observation.rateRaw;
            if (rateDifference * 10_000 > uint256(previousRound.rateRaw) * policy.circuitBreakerBps) {
                initialStatus = CandidateStatus.Disputed;
                emit CircuitBreakerTriggered(
                    observation.configVersion,
                    observation.roundId,
                    observation.candidateId,
                    previousRound.rateRaw,
                    observation.rateRaw
                );
            }
        }
        candidates[observation.candidateId] = Candidate({
            observation: observation,
            proposedAt: proposedAt,
            challengeEndsAt: challengeEndsAt,
            status: initialStatus,
            disputeAccepted: false
        });

        emit ObservationProposed(
            observation.configVersion,
            observation.roundId,
            observation.candidateId,
            observation.rateRaw,
            observation.observationTime,
            challengeEndsAt,
            observation.failureDeadline,
            observation.sourceHash
        );
    }

    function submitEvidence(bytes32 candidateId, bytes32 evidenceHash) public {
        Candidate storage candidate = candidates[candidateId];
        if (candidate.status != CandidateStatus.Proposed && candidate.status != CandidateStatus.Disputed) {
            revert InvalidCandidateState(candidate.status);
        }
        if (block.timestamp >= candidate.observation.failureDeadline) {
            revert FailureDeadlineReached(candidate.observation.failureDeadline);
        }
        if (evidenceHash == bytes32(0)) revert EmptyEvidence();
        if (evidenceSubmitted[candidateId][evidenceHash]) revert DuplicateEvidence(evidenceHash);
        evidenceSubmitted[candidateId][evidenceHash] = true;
        emit EvidenceSubmitted(candidateId, msg.sender, evidenceHash);
    }

    function disputeObservation(bytes32 candidateId, bytes32 evidenceHash) external {
        Candidate storage candidate = candidates[candidateId];
        if (candidate.status != CandidateStatus.Proposed) revert InvalidCandidateState(candidate.status);
        if (candidate.disputeAccepted) revert InvalidCandidateState(candidate.status);
        if (block.timestamp >= candidate.challengeEndsAt) revert ChallengeStillOpen(candidate.challengeEndsAt);
        FeedPolicy storage policy = feedPolicies[candidate.observation.configVersion];
        if (msg.sender != policy.resolver) revert UnauthorizedResolver(msg.sender);
        submitEvidence(candidateId, evidenceHash);
        candidate.status = CandidateStatus.Disputed;
        emit ObservationDisputed(candidateId, msg.sender, evidenceHash);
    }

    function resolveDispute(bytes32 candidateId, bool accept, bytes32 rationaleHash) external {
        Candidate storage candidate = candidates[candidateId];
        if (candidate.status != CandidateStatus.Disputed) revert InvalidCandidateState(candidate.status);
        if (block.timestamp >= candidate.observation.failureDeadline) {
            revert FailureDeadlineReached(candidate.observation.failureDeadline);
        }
        FeedPolicy storage policy = feedPolicies[candidate.observation.configVersion];
        if (msg.sender != policy.resolver) revert UnauthorizedResolver(msg.sender);
        if (rationaleHash == bytes32(0)) revert EmptyEvidence();

        if (accept) {
            candidate.status = CandidateStatus.Proposed;
            candidate.disputeAccepted = true;
        } else {
            candidate.status = CandidateStatus.Rejected;
        }
        emit DisputeResolved(candidateId, accept, rationaleHash);
    }

    function finalizeObservation(bytes32 candidateId) external {
        Candidate storage candidate = candidates[candidateId];
        if (candidate.status != CandidateStatus.Proposed) revert InvalidCandidateState(candidate.status);
        if (block.timestamp < candidate.challengeEndsAt) revert ChallengeStillOpen(candidate.challengeEndsAt);
        if (block.timestamp >= candidate.observation.failureDeadline) {
            revert FailureDeadlineReached(candidate.observation.failureDeadline);
        }

        candidate.status = CandidateStatus.Finalized;
        Observation storage observation = candidate.observation;
        FinalizedRound memory round = FinalizedRound({
            roundId: observation.roundId,
            observationTime: observation.observationTime,
            finalizedAt: uint64(block.timestamp),
            rateRaw: observation.rateRaw,
            candidateId: candidateId,
            sourceHash: observation.sourceHash
        });
        _finalizedRounds[observation.configVersion][observation.roundId] = round;
        _latestFinalizedRounds[observation.configVersion] = round;
        nextRoundId[observation.configVersion] = observation.roundId + 1;

        emit ObservationFinalized(
            observation.configVersion,
            observation.roundId,
            candidateId,
            observation.rateRaw,
            uint64(block.timestamp)
        );
    }

    function finalizedRound(uint64 configVersion, uint64 roundId)
        external
        view
        override
        returns (FinalizedRound memory)
    {
        return _finalizedRounds[configVersion][roundId];
    }

    function latestFinalizedRound(uint64 configVersion) external view override returns (FinalizedRound memory) {
        return _latestFinalizedRounds[configVersion];
    }

    function scheduledRound(uint64 configVersion, uint64 roundId)
        external
        view
        override
        returns (ScheduledRound memory)
    {
        return _scheduledRounds[configVersion][roundId];
    }

    function feedPolicy(uint64 configVersion)
        external
        view
        override
        returns (
            bool configured,
            bytes32 methodologyHash,
            uint128 minRateRaw,
            uint128 maxRateRaw,
            uint16 circuitBreakerBps
        )
    {
        FeedPolicy storage policy = feedPolicies[configVersion];
        return (
            policy.configured,
            policy.methodologyHash,
            policy.minRateRaw,
            policy.maxRateRaw,
            policy.circuitBreakerBps
        );
    }

    function isTradingOpen(uint64 configVersion) external view override returns (bool) {
        FeedPolicy storage policy = feedPolicies[configVersion];
        if (!policy.configured) return false;
        FinalizedRound storage latest = _latestFinalizedRounds[configVersion];
        if (latest.roundId == 0 || block.timestamp > uint256(latest.observationTime) + policy.staleAfter) return false;
        if (!_scheduledRounds[configVersion][nextRoundId[configVersion]].configured) return false;

        bytes32 pendingId = activeCandidate[configVersion][nextRoundId[configVersion]];
        if (pendingId == bytes32(0)) return true;
        return false;
    }
}
