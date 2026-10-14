// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";

/// @notice Quorum-attested source medians and scheduled, fully covered 60-minute TWAPs.
/// @dev Rates are NGN per USD at 1e6. A TWAP is a synthetic benchmark; this contract
/// does not assert equivalence to an official daily fixing. Source independence
/// and redistribution rights require offchain qualification. Configurations are
/// immutable and every configured source is required (fail closed on omissions).
contract RateOracleV2 is AccessManaged, EIP712, IRateOracle {
    uint64 public constant WINDOW_SECONDS = 3600;
    uint64 public constant MAX_TWAP_SAMPLES = 256;
    uint8 public constant SIGNER_THRESHOLD = 3;

    bytes32 public constant SAMPLE_TYPEHASH = keccak256(
        "Sample(bytes32 deploymentId,uint64 configVersion,bytes32 policyHash,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot)"
    );
    bytes32 public constant ROUND_TYPEHASH = keccak256(
        "Round(bytes32 deploymentId,uint64 configVersion,bytes32 policyHash,uint64 roundId,bytes32 candidateId,uint64 observationTime,uint64 failureDeadline,uint64 firstSampleId,uint64 lastSampleId,uint128 rateRaw,bytes32 sampleRoot,uint64 validUntil)"
    );

    enum Status { None, Proposed, Quarantined, Disputed, Rejected, Finalized }
    enum FeedStatus { Unconfigured, InsufficientHistory, Pending, Disputed, Stale, Healthy }

    struct Source {
        bytes32 sourceId;
        bytes32 independenceGroupId;
        uint64 maxAgeSeconds;
    }
    struct Policy {
        address resolver;
        bytes32 methodologyHash;
        uint64 sourceSetVersion;
        uint64 signerSetVersion;
        uint64 challengePeriod;
        uint64 maxSubmissionDelay;
        uint64 maxFailureDelay;
        uint64 staleAfter;
        uint64 maxSourceSkew;
        uint64 maxSampleGap;
        uint64 maxHold;
        uint16 circuitBreakerBps;
        uint16 maxSourceSpreadBps;
        uint128 minRateRaw;
        uint128 maxRateRaw;
        uint128 bootstrapRateRaw;
    }
    struct SourceObservation {
        bytes32 sourceId;
        uint64 observedAt;
        uint64 publishedAt;
        uint64 fetchedAt;
        uint128 rateRaw;
        bytes32 payloadHash;
    }
    struct SampleReport {
        uint64 configVersion;
        uint64 sampleId;
        uint64 observedAt;
        uint64 validUntil;
        uint128 medianRateRaw;
        bytes32 observationsHash;
        bytes32 evidenceRoot;
    }
    struct Sample {
        SampleReport report;
        bytes32 digest;
        uint64 challengeEndsAt;
        uint128 referenceRateRaw;
        Status status;
    }
    struct RoundReport {
        uint64 configVersion;
        uint64 roundId;
        bytes32 candidateId;
        uint64 firstSampleId;
        uint64 lastSampleId;
        uint128 rateRaw;
        bytes32 sampleRoot;
        uint64 validUntil;
    }
    struct RoundCandidate {
        RoundReport report;
        bytes32 digest;
        uint64 challengeEndsAt;
        uint128 referenceRateRaw;
        Status status;
    }

    bytes32 public immutable deploymentId;
    mapping(uint64 => Policy) public policies;
    mapping(uint64 => bytes32) public policyHashes;
    mapping(uint64 => bytes32) public sourceSetHashes;
    mapping(uint64 => bytes32) public signerSetHashes;
    mapping(uint64 => Source[]) private _sources;
    mapping(uint64 => address[]) private _signers;
    mapping(uint64 => mapping(address => bool)) public isSigner;
    mapping(uint64 => uint64) public latestSampleId;
    mapping(uint64 => uint64) public latestAcceptedSampleId;
    mapping(uint64 => uint64) public sealedThrough;
    mapping(uint64 => mapping(uint64 => Sample)) private _samples;
    mapping(uint64 => mapping(uint64 => SourceObservation[])) private _observations;
    mapping(uint64 => uint64) public nextRoundId;
    mapping(uint64 => uint64) public nextScheduleRoundId;
    mapping(uint64 => mapping(uint64 => ScheduledRound)) private _schedules;
    mapping(bytes32 => RoundCandidate) private _candidates;
    mapping(uint64 => mapping(uint64 => bytes32)) public activeCandidate;
    mapping(uint64 => mapping(uint64 => FinalizedRound)) private _rounds;
    mapping(uint64 => FinalizedRound) private _latestRounds;

    event FeedConfigured(uint64 indexed configVersion, bytes32 policyHash, bytes32 sourceSetHash, bytes32 signerSetHash);
    event SourceConfigured(uint64 indexed configVersion, bytes32 indexed sourceId, bytes32 independenceGroupId, uint64 maxAgeSeconds);
    event SignerConfigured(uint64 indexed configVersion, address indexed signer);
    event SampleProposed(uint64 indexed configVersion, uint64 indexed sampleId, bytes32 digest, uint64 observedAt, uint128 medianRateRaw, bytes32 evidenceRoot, Status status);
    event SourceObserved(uint64 indexed configVersion, uint64 indexed sampleId, bytes32 indexed sourceId, uint64 observedAt, uint64 publishedAt, uint64 fetchedAt, uint128 rateRaw, bytes32 payloadHash);
    event SampleFinalized(uint64 indexed configVersion, uint64 indexed sampleId, uint128 rateRaw);
    event CandidateDisputed(bytes32 indexed digest, bytes32 evidenceHash);
    event CandidateResolved(bytes32 indexed digest, bool accepted, uint128 referenceRateRaw, uint128 rateRaw, bytes32 rationaleHash, uint64 expiresAt);
    event SampleExpired(uint64 indexed configVersion, uint64 indexed sampleId);
    event RoundScheduled(uint64 indexed configVersion, uint64 indexed roundId, uint64 observationTime, uint64 failureDeadline);
    event RoundProposed(uint64 indexed configVersion, uint64 indexed roundId, bytes32 indexed candidateId, bytes32 digest, uint128 rateRaw, bytes32 sampleRoot, Status status);
    event RoundFinalized(uint64 indexed configVersion, uint64 indexed roundId, bytes32 indexed candidateId, uint64 windowStart, uint64 windowEnd, uint64 coverageSeconds, uint64 firstSampleId, uint64 lastSampleId, uint128 rateRaw, bytes32 sampleRoot);

    error InvalidPolicy();
    error InvalidSource();
    error InvalidTimestamp();
    error InvalidRate();
    error InvalidQuorum();
    error InvalidState();
    error InvalidRound();
    error InvalidCoverage();
    error UnauthorizedResolver();

    constructor(address authority, bytes32 deploymentId_) AccessManaged(authority) EIP712("HedgeMaker Rate Oracle", "2") {
        if (deploymentId_ == bytes32(0)) revert InvalidPolicy();
        deploymentId = deploymentId_;
    }

    function configureFeed(uint64 version, Policy calldata policy, Source[] calldata sources_, address[] calldata signers_) external restricted {
        if (version == 0 || policyHashes[version] != bytes32(0) || policy.resolver == address(0)
            || policy.methodologyHash == bytes32(0) || policy.sourceSetVersion == 0 || policy.signerSetVersion == 0
            || policy.challengePeriod == 0 || policy.maxSubmissionDelay <= policy.challengePeriod
            || policy.maxFailureDelay <= policy.challengePeriod || policy.staleAfter <= policy.challengePeriod
            || policy.maxSampleGap == 0 || policy.maxSampleGap > WINDOW_SECONDS
            || policy.maxHold == 0 || policy.maxHold > WINDOW_SECONDS
            || policy.circuitBreakerBps == 0 || policy.circuitBreakerBps > 10_000
            || policy.maxSourceSpreadBps == 0 || policy.maxSourceSpreadBps > 10_000
            || policy.minRateRaw == 0 || policy.maxRateRaw <= policy.minRateRaw
            || policy.bootstrapRateRaw < policy.minRateRaw || policy.bootstrapRateRaw > policy.maxRateRaw
            || sources_.length < 3 || sources_.length > 5 || signers_.length != 5) revert InvalidPolicy();
        for (uint256 i; i < sources_.length; ++i) {
            Source calldata s = sources_[i];
            if (s.sourceId == bytes32(0) || s.independenceGroupId == bytes32(0)
                || s.maxAgeSeconds < policy.maxHold + policy.maxSourceSkew
                || (i > 0 && s.sourceId <= sources_[i - 1].sourceId)) revert InvalidSource();
            for (uint256 j; j < i; ++j) {
                if (sources_[j].independenceGroupId == s.independenceGroupId) revert InvalidSource();
            }
            _sources[version].push(s);
            emit SourceConfigured(version, s.sourceId, s.independenceGroupId, s.maxAgeSeconds);
        }
        for (uint256 i; i < signers_.length; ++i) {
            address signer = signers_[i];
            if (signer == address(0) || (i > 0 && signer <= signers_[i - 1])) revert InvalidQuorum();
            isSigner[version][signer] = true;
            _signers[version].push(signer);
            emit SignerConfigured(version, signer);
        }
        policies[version] = policy;
        sourceSetHashes[version] = keccak256(abi.encode(policy.sourceSetVersion, sources_));
        signerSetHashes[version] = keccak256(abi.encode(policy.signerSetVersion, signers_, SIGNER_THRESHOLD));
        policyHashes[version] = keccak256(abi.encode(policy, sourceSetHashes[version], signerSetHashes[version], WINDOW_SECONDS));
        nextRoundId[version] = 1;
        nextScheduleRoundId[version] = 1;
        emit FeedConfigured(version, policyHashes[version], sourceSetHashes[version], signerSetHashes[version]);
    }

    function sources(uint64 version) external view returns (Source[] memory) { return _sources[version]; }
    function signers(uint64 version) external view returns (address[] memory) { return _signers[version]; }
    function sample(uint64 version, uint64 id) external view returns (Sample memory) { return _samples[version][id]; }
    function observations(uint64 version, uint64 id) external view returns (SourceObservation[] memory) { return _observations[version][id]; }
    function candidate(bytes32 id) external view returns (RoundCandidate memory) { return _candidates[id]; }

    function hashSample(SampleReport calldata report) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(SAMPLE_TYPEHASH, deploymentId, report.configVersion,
            policyHashes[report.configVersion], report.sampleId, report.observedAt, report.validUntil,
            report.medianRateRaw, report.observationsHash, report.evidenceRoot)));
    }

    function proposeSample(SampleReport calldata report, SourceObservation[] calldata observations_, bytes[] calldata signatures) external {
        uint64 version = report.configVersion;
        Policy storage p = policies[version];
        uint64 previousId = latestSampleId[version];
        if (policyHashes[version] == bytes32(0) || report.sampleId != previousId + 1) revert InvalidState();
        if (previousId != 0) {
            Sample storage previous = _samples[version][previousId];
            if (previous.status != Status.Finalized && previous.status != Status.Rejected) revert InvalidState();
            if (report.observedAt <= previous.report.observedAt) revert InvalidTimestamp();
        }
        if (report.observedAt <= sealedThrough[version] || report.observedAt > block.timestamp
            || block.timestamp > uint256(report.observedAt) + p.maxSubmissionDelay
            || report.validUntil <= block.timestamp + p.challengePeriod
            || report.validUntil > uint256(report.observedAt) + p.maxSubmissionDelay) revert InvalidTimestamp();
        if (report.observationsHash != keccak256(abi.encode(observations_)) || report.evidenceRoot == bytes32(0)) revert InvalidSource();
        if (_validateObservations(version, report.observedAt, observations_) != report.medianRateRaw) revert InvalidRate();
        bytes32 digest = hashSample(report);
        _verifyQuorum(version, digest, signatures);
        uint64 acceptedId = latestAcceptedSampleId[version];
        uint128 referenceRate = acceptedId == 0 ? p.bootstrapRateRaw : _samples[version][acceptedId].report.medianRateRaw;
        Status status = _deviates(report.medianRateRaw, referenceRate, p.circuitBreakerBps) ? Status.Quarantined : Status.Proposed;
        _samples[version][report.sampleId] = Sample(report, digest, uint64(block.timestamp) + p.challengePeriod, referenceRate, status);
        latestSampleId[version] = report.sampleId;
        for (uint256 i; i < observations_.length; ++i) {
            SourceObservation calldata o = observations_[i];
            _observations[version][report.sampleId].push(o);
            emit SourceObserved(version, report.sampleId, o.sourceId, o.observedAt, o.publishedAt, o.fetchedAt, o.rateRaw, o.payloadHash);
        }
        emit SampleProposed(version, report.sampleId, digest, report.observedAt, report.medianRateRaw, report.evidenceRoot, status);
    }

    function finalizeSample(uint64 version, uint64 id) external {
        Sample storage s = _samples[version][id];
        if (s.status != Status.Proposed || block.timestamp < s.challengeEndsAt || block.timestamp > s.report.validUntil) revert InvalidState();
        // Governance cannot turn an expired underlying quote into a fresh sample.
        _validateObservations(version, s.report.observedAt, _observations[version][id]);
        s.status = Status.Finalized;
        latestAcceptedSampleId[version] = id;
        emit SampleFinalized(version, id, s.report.medianRateRaw);
    }

    function disputeSample(uint64 version, uint64 id, bytes32 evidenceHash) external {
        _onlyResolver(version);
        Sample storage s = _samples[version][id];
        if (s.status != Status.Proposed || block.timestamp >= s.challengeEndsAt || evidenceHash == bytes32(0)) revert InvalidState();
        s.status = Status.Disputed;
        emit CandidateDisputed(s.digest, evidenceHash);
    }

    function resolveSample(uint64 version, uint64 id, bool accept, bytes32 rationaleHash, uint64 expiresAt) external {
        _onlyResolver(version);
        Sample storage s = _samples[version][id];
        _checkResolution(s.status, rationaleHash, expiresAt, s.report.validUntil);
        if (accept) _validateObservations(version, s.report.observedAt, _observations[version][id]);
        s.status = accept ? Status.Proposed : Status.Rejected;
        emit CandidateResolved(s.digest, accept, s.referenceRateRaw, s.report.medianRateRaw, rationaleHash, expiresAt);
    }

    function expireSample(uint64 version, uint64 id) external {
        Sample storage s = _samples[version][id];
        if (s.status == Status.None || s.status == Status.Finalized || s.status == Status.Rejected || block.timestamp <= s.report.validUntil) revert InvalidState();
        s.status = Status.Rejected;
        emit SampleExpired(version, id);
    }

    function scheduleRound(uint64 version, uint64 id, uint64 observationTime, uint64 failureDeadline) external restricted {
        Policy storage p = policies[version];
        if (policyHashes[version] == bytes32(0) || id != nextScheduleRoundId[version]
            || observationTime < WINDOW_SECONDS || failureDeadline <= uint256(observationTime) + p.challengePeriod
            || failureDeadline > uint256(observationTime) + p.maxFailureDelay
            || (id > 1 && (observationTime <= _schedules[version][id - 1].observationTime
                || failureDeadline <= _schedules[version][id - 1].failureDeadline))) revert InvalidRound();
        _schedules[version][id] = ScheduledRound(observationTime, failureDeadline, true);
        nextScheduleRoundId[version] = id + 1;
        emit RoundScheduled(version, id, observationTime, failureDeadline);
    }

    /// @notice Piecewise-constant TWAP. The range must use the last sample at or
    /// before windowStart and every later sample through windowEnd. Rejected or
    /// unresolved intervals are holes, never removed from the denominator.
    function previewTwap(uint64 version, uint64 roundId, uint64 firstId, uint64 lastId) public view returns (uint128 rateRaw, bytes32 sampleRoot) {
        ScheduledRound storage schedule = _schedules[version][roundId];
        if (!schedule.configured || schedule.observationTime > block.timestamp || firstId == 0 || lastId < firstId
            || lastId > latestSampleId[version] || lastId - firstId >= MAX_TWAP_SAMPLES) revert InvalidCoverage();
        uint64 end = schedule.observationTime;
        uint64 start = end - WINDOW_SECONDS;
        if (_samples[version][firstId].report.observedAt > start
            || (firstId < lastId && _samples[version][firstId + 1].report.observedAt <= start)
            || _samples[version][lastId].report.observedAt > end
            || (lastId < latestSampleId[version] && _samples[version][lastId + 1].report.observedAt <= end)) revert InvalidCoverage();
        Policy storage p = policies[version];
        uint256 weighted;
        sampleRoot = keccak256(abi.encode(version, roundId, start, end));
        for (uint64 id = firstId; id <= lastId; ++id) {
            Sample storage s = _samples[version][id];
            if (s.status != Status.Finalized) revert InvalidCoverage();
            uint64 intervalStart = s.report.observedAt < start ? start : s.report.observedAt;
            uint64 intervalEnd = id == lastId ? end : _samples[version][id + 1].report.observedAt;
            if (intervalEnd < intervalStart || intervalEnd - s.report.observedAt > p.maxHold
                || intervalEnd - s.report.observedAt > p.maxSampleGap) revert InvalidCoverage();
            for (uint256 i; i < _sources[version].length; ++i) {
                if (intervalEnd > uint256(_observations[version][id][i].observedAt) + _sources[version][i].maxAgeSeconds) {
                    revert InvalidCoverage();
                }
            }
            weighted += uint256(s.report.medianRateRaw) * (intervalEnd - intervalStart);
            sampleRoot = keccak256(abi.encode(sampleRoot, id, s.digest));
        }
        rateRaw = uint128(weighted / WINDOW_SECONDS);
    }

    function hashRound(RoundReport calldata report) public view returns (bytes32) {
        ScheduledRound storage s = _schedules[report.configVersion][report.roundId];
        return _hashTypedDataV4(keccak256(abi.encode(ROUND_TYPEHASH, deploymentId, report.configVersion,
            policyHashes[report.configVersion], report.roundId, report.candidateId, s.observationTime, s.failureDeadline,
            report.firstSampleId, report.lastSampleId, report.rateRaw, report.sampleRoot, report.validUntil)));
    }

    function proposeRound(RoundReport calldata report, bytes[] calldata signatures) external {
        uint64 version = report.configVersion;
        Policy storage p = policies[version];
        ScheduledRound storage schedule = _schedules[version][report.roundId];
        if (report.roundId != nextRoundId[version] || !schedule.configured || report.candidateId == bytes32(0)
            || _candidates[report.candidateId].status != Status.None) revert InvalidRound();
        bytes32 previousId = activeCandidate[version][report.roundId];
        if (previousId != bytes32(0) && _candidates[previousId].status != Status.Rejected) revert InvalidState();
        if (report.validUntil <= block.timestamp + p.challengePeriod || report.validUntil >= schedule.failureDeadline) revert InvalidTimestamp();
        (uint128 rate, bytes32 root) = previewTwap(version, report.roundId, report.firstSampleId, report.lastSampleId);
        if (rate != report.rateRaw || root != report.sampleRoot) revert InvalidRate();
        bytes32 digest = hashRound(report);
        _verifyQuorum(version, digest, signatures);
        uint128 referenceRate = _latestRounds[version].roundId == 0 ? p.bootstrapRateRaw : _latestRounds[version].rateRaw;
        Status status = _deviates(rate, referenceRate, p.circuitBreakerBps) ? Status.Quarantined : Status.Proposed;
        _candidates[report.candidateId] = RoundCandidate(report, digest, uint64(block.timestamp) + p.challengePeriod, referenceRate, status);
        activeCandidate[version][report.roundId] = report.candidateId;
        // Seal the historical stream so a later backdated sample cannot alter a
        // proposed or finalized round's canonical range.
        sealedThrough[version] = schedule.observationTime;
        emit RoundProposed(version, report.roundId, report.candidateId, digest, rate, root, status);
    }

    function disputeRound(bytes32 candidateId, bytes32 evidenceHash) external {
        RoundCandidate storage c = _candidates[candidateId];
        _onlyResolver(c.report.configVersion);
        if (c.status != Status.Proposed || block.timestamp >= c.challengeEndsAt || evidenceHash == bytes32(0)) revert InvalidState();
        c.status = Status.Disputed;
        emit CandidateDisputed(c.digest, evidenceHash);
    }

    function resolveRound(bytes32 candidateId, bool accept, bytes32 rationaleHash, uint64 expiresAt) external {
        RoundCandidate storage c = _candidates[candidateId];
        _onlyResolver(c.report.configVersion);
        _checkResolution(c.status, rationaleHash, expiresAt, c.report.validUntil);
        // Recompute immutable accepted inputs; no resolver-supplied replacement rate.
        if (accept) previewTwap(c.report.configVersion, c.report.roundId, c.report.firstSampleId, c.report.lastSampleId);
        c.status = accept ? Status.Proposed : Status.Rejected;
        emit CandidateResolved(c.digest, accept, c.referenceRateRaw, c.report.rateRaw, rationaleHash, expiresAt);
    }

    function expireRound(bytes32 candidateId) external {
        RoundCandidate storage c = _candidates[candidateId];
        if (c.status == Status.None || c.status == Status.Finalized || c.status == Status.Rejected || block.timestamp <= c.report.validUntil) revert InvalidState();
        c.status = Status.Rejected;
    }

    function finalizeRound(bytes32 candidateId) external {
        RoundCandidate storage c = _candidates[candidateId];
        RoundReport storage r = c.report;
        if (c.status != Status.Proposed || block.timestamp < c.challengeEndsAt || block.timestamp > r.validUntil
            || r.roundId != nextRoundId[r.configVersion]) revert InvalidState();
        (uint128 rate, bytes32 root) = previewTwap(r.configVersion, r.roundId, r.firstSampleId, r.lastSampleId);
        if (rate != r.rateRaw || root != r.sampleRoot) revert InvalidCoverage();
        ScheduledRound storage schedule = _schedules[r.configVersion][r.roundId];
        c.status = Status.Finalized;
        FinalizedRound memory round = FinalizedRound(r.roundId, schedule.observationTime, uint64(block.timestamp), rate, candidateId, root);
        _rounds[r.configVersion][r.roundId] = round;
        _latestRounds[r.configVersion] = round;
        nextRoundId[r.configVersion] = r.roundId + 1;
        emit RoundFinalized(r.configVersion, r.roundId, candidateId, schedule.observationTime - WINDOW_SECONDS,
            schedule.observationTime, WINDOW_SECONDS, r.firstSampleId, r.lastSampleId, rate, root);
    }

    function feedStatus(uint64 version) public view returns (FeedStatus) {
        if (policyHashes[version] == bytes32(0)) return FeedStatus.Unconfigured;
        uint64 sampleId = latestSampleId[version];
        if (sampleId == 0 || _latestRounds[version].roundId == 0) return FeedStatus.InsufficientHistory;
        Status sampleStatus = _samples[version][sampleId].status;
        Status roundStatus = _candidates[activeCandidate[version][nextRoundId[version]]].status;
        if (sampleStatus == Status.Quarantined || sampleStatus == Status.Disputed || sampleStatus == Status.Rejected
            || roundStatus == Status.Quarantined || roundStatus == Status.Disputed || roundStatus == Status.Rejected) return FeedStatus.Disputed;
        if (sampleStatus == Status.Proposed || roundStatus == Status.Proposed) return FeedStatus.Pending;
        Policy storage p = policies[version];
        if (block.timestamp > uint256(_samples[version][sampleId].report.observedAt) + p.staleAfter
            || block.timestamp > uint256(_latestRounds[version].observationTime) + p.staleAfter) return FeedStatus.Stale;
        for (uint256 i; i < _sources[version].length; ++i) {
            if (block.timestamp > uint256(_observations[version][sampleId][i].observedAt) + _sources[version][i].maxAgeSeconds) {
                return FeedStatus.Stale;
            }
        }
        if (!_schedules[version][nextRoundId[version]].configured) return FeedStatus.InsufficientHistory;
        return FeedStatus.Healthy;
    }
    function canOpen(uint64 version) public view returns (bool) { return feedStatus(version) == FeedStatus.Healthy; }
    function canSettle(uint64 version, uint64 id) external view returns (bool) { return _rounds[version][id].roundId != 0; }
    function isTradingOpen(uint64 version) external view override returns (bool) { return canOpen(version); }
    function latestFinalizedRound(uint64 version) external view override returns (FinalizedRound memory) { return _latestRounds[version]; }
    function finalizedRound(uint64 version, uint64 id) external view override returns (FinalizedRound memory) { return _rounds[version][id]; }
    function scheduledRound(uint64 version, uint64 id) external view override returns (ScheduledRound memory) { return _schedules[version][id]; }
    function feedPolicy(uint64 version) external view override returns (bool, bytes32, uint128, uint128, uint16) {
        Policy storage p = policies[version];
        return (policyHashes[version] != bytes32(0), p.methodologyHash, p.minRateRaw, p.maxRateRaw, p.circuitBreakerBps);
    }

    function _validateObservations(uint64 version, uint64 sampleTime, SourceObservation[] memory observations_) private view returns (uint128) {
        Source[] storage sourceSet = _sources[version];
        if (observations_.length != sourceSet.length || sourceSet.length < 3) revert InvalidSource();
        Policy storage p = policies[version];
        uint128[] memory rates = new uint128[](observations_.length);
        uint64 oldest = type(uint64).max;
        uint64 newest;
        for (uint256 i; i < observations_.length; ++i) {
            SourceObservation memory o = observations_[i];
            if (o.sourceId != sourceSet[i].sourceId || o.payloadHash == bytes32(0)) revert InvalidSource();
            if (o.observedAt == 0 || o.observedAt > sampleTime || o.publishedAt < o.observedAt
                || o.fetchedAt < o.publishedAt || o.fetchedAt > block.timestamp
                || block.timestamp > uint256(o.observedAt) + sourceSet[i].maxAgeSeconds) revert InvalidTimestamp();
            if (o.rateRaw < p.minRateRaw || o.rateRaw > p.maxRateRaw) revert InvalidRate();
            if (o.observedAt < oldest) oldest = o.observedAt;
            if (o.observedAt > newest) newest = o.observedAt;
            rates[i] = o.rateRaw;
            for (uint256 j = i; j > 0 && rates[j] < rates[j - 1]; --j) {
                (rates[j], rates[j - 1]) = (rates[j - 1], rates[j]);
            }
        }
        // The median becomes effective at the newest economic timestamp. Fetching
        // the same old prices again cannot manufacture fresh TWAP coverage.
        if (newest - oldest > p.maxSourceSkew || sampleTime != newest) revert InvalidTimestamp();
        uint256 n = rates.length;
        uint128 median = n % 2 == 1 ? rates[n / 2] : uint128((uint256(rates[n / 2 - 1]) + rates[n / 2]) / 2);
        if (uint256(rates[n - 1] - rates[0]) * 10_000 > uint256(median) * p.maxSourceSpreadBps) revert InvalidRate();
        return median;
    }

    function _verifyQuorum(uint64 version, bytes32 digest, bytes[] calldata signatures) private view {
        if (signatures.length < SIGNER_THRESHOLD || signatures.length > 5) revert InvalidQuorum();
        address previous;
        for (uint256 i; i < signatures.length; ++i) {
            address signer = ECDSA.recover(digest, signatures[i]);
            if (signer <= previous || !isSigner[version][signer]) revert InvalidQuorum();
            previous = signer;
        }
    }
    function _deviates(uint128 rate, uint128 referenceRate, uint16 bps) private pure returns (bool) {
        uint256 difference = rate > referenceRate ? rate - referenceRate : referenceRate - rate;
        return difference * 10_000 > uint256(referenceRate) * bps;
    }
    function _onlyResolver(uint64 version) private view {
        if (msg.sender != policies[version].resolver) revert UnauthorizedResolver();
    }
    function _checkResolution(Status status, bytes32 rationaleHash, uint64 expiresAt, uint64 validUntil) private view {
        if ((status != Status.Quarantined && status != Status.Disputed) || rationaleHash == bytes32(0)
            || expiresAt < block.timestamp || expiresAt > validUntil || block.timestamp > validUntil) revert InvalidState();
    }
}
