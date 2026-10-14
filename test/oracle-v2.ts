import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {network} from 'hardhat';
import {encodeAbiParameters, keccak256, type Hex} from 'viem';

const {viem, networkHelpers} = await network.create();
const wallets = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();
const [admin, resolver, ...candidates] = wallets;

const SOURCE_IDS = [1, 2, 3].map((value) => (
  `0x${value.toString(16).padStart(64, '0')}` as Hex
));
const GROUP_IDS = [0xa1, 0xa2, 0xa3].map((value) => (
  `0x${value.toString(16).padStart(64, '0')}` as Hex
));
const METHODOLOGY_HASH = `0x${'22'.repeat(32)}` as const;

const observationParameters = [{
  type: 'tuple[]',
  components: [
    {name: 'sourceId', type: 'bytes32'},
    {name: 'observedAt', type: 'uint64'},
    {name: 'publishedAt', type: 'uint64'},
    {name: 'fetchedAt', type: 'uint64'},
    {name: 'rateRaw', type: 'uint128'},
    {name: 'payloadHash', type: 'bytes32'},
  ],
}] as const;

async function fixture() {
  const authority = await viem.deployContract('HedgeMakerAccessManager', [admin.account.address]);
  const oracle = await viem.deployContract('RateOracleV2', [
    authority.address,
    `0x${'11'.repeat(32)}`,
  ]);
  const signerClients = candidates.slice(0, 5).sort((left, right) => (
    left.account.address.toLowerCase().localeCompare(right.account.address.toLowerCase())
  ));
  const policy = {
    resolver: resolver.account.address,
    methodologyHash: METHODOLOGY_HASH,
    sourceSetVersion: 1n,
    signerSetVersion: 1n,
    challengePeriod: 2n,
    maxSubmissionDelay: 60n,
    maxFailureDelay: 300n,
    staleAfter: 600n,
    maxSourceSkew: 10n,
    maxSampleGap: 120n,
    maxHold: 120n,
    circuitBreakerBps: 500,
    maxSourceSpreadBps: 100,
    minRateRaw: 500_000_000n,
    maxRateRaw: 5_000_000_000n,
    bootstrapRateRaw: 1_500_000_000n,
  };
  const sources = SOURCE_IDS.map((sourceId, index) => ({
    sourceId,
    independenceGroupId: GROUP_IDS[index],
    maxAgeSeconds: 180n,
  }));
  await oracle.write.configureFeed([
    1n,
    policy,
    sources,
    signerClients.map((client) => client.account.address),
  ]);
  return {oracle, policy, signerClients};
}

function observations(observedAt: bigint, rates: readonly bigint[]) {
  return SOURCE_IDS.map((sourceId, index) => ({
    sourceId,
    observedAt,
    publishedAt: observedAt,
    fetchedAt: observedAt,
    rateRaw: rates[index],
    payloadHash: `0x${(index + 0x31).toString(16).padStart(2, '0').repeat(32)}` as Hex,
  }));
}

async function signSample(
  f: Awaited<ReturnType<typeof fixture>>,
  report: {
    configVersion: bigint;
    sampleId: bigint;
    observedAt: bigint;
    validUntil: bigint;
    medianRateRaw: bigint;
    observationsHash: Hex;
    evidenceRoot: Hex;
  },
  count = 3,
) {
  const [deploymentId, policyHash, chainId] = await Promise.all([
    f.oracle.read.deploymentId() as Promise<Hex>,
    f.oracle.read.policyHashes([report.configVersion]) as Promise<Hex>,
    publicClient.getChainId(),
  ]);
  return Promise.all(f.signerClients.slice(0, count).map((client) => client.signTypedData({
    domain: {
      name: 'HedgeMaker Rate Oracle',
      version: '2',
      chainId,
      verifyingContract: f.oracle.address,
    },
    types: {Sample: [
      {name: 'deploymentId', type: 'bytes32'},
      {name: 'configVersion', type: 'uint64'},
      {name: 'policyHash', type: 'bytes32'},
      {name: 'sampleId', type: 'uint64'},
      {name: 'observedAt', type: 'uint64'},
      {name: 'validUntil', type: 'uint64'},
      {name: 'medianRateRaw', type: 'uint128'},
      {name: 'observationsHash', type: 'bytes32'},
      {name: 'evidenceRoot', type: 'bytes32'},
    ]},
    primaryType: 'Sample',
    message: {deploymentId, policyHash, ...report},
  })));
}

async function signRound(
  f: Awaited<ReturnType<typeof fixture>>,
  report: {
    configVersion: bigint;
    roundId: bigint;
    candidateId: Hex;
    firstSampleId: bigint;
    lastSampleId: bigint;
    rateRaw: bigint;
    sampleRoot: Hex;
    validUntil: bigint;
  },
  count = 3,
) {
  const [deploymentId, policyHash, schedule, chainId] = await Promise.all([
    f.oracle.read.deploymentId() as Promise<Hex>,
    f.oracle.read.policyHashes([report.configVersion]) as Promise<Hex>,
    f.oracle.read.scheduledRound([report.configVersion, report.roundId]) as Promise<{
      observationTime: bigint;
      failureDeadline: bigint;
      configured: boolean;
    }>,
    publicClient.getChainId(),
  ]);
  return Promise.all(f.signerClients.slice(0, count).map((client) => client.signTypedData({
    domain: {
      name: 'HedgeMaker Rate Oracle',
      version: '2',
      chainId,
      verifyingContract: f.oracle.address,
    },
    types: {Round: [
      {name: 'deploymentId', type: 'bytes32'},
      {name: 'configVersion', type: 'uint64'},
      {name: 'policyHash', type: 'bytes32'},
      {name: 'roundId', type: 'uint64'},
      {name: 'candidateId', type: 'bytes32'},
      {name: 'observationTime', type: 'uint64'},
      {name: 'failureDeadline', type: 'uint64'},
      {name: 'firstSampleId', type: 'uint64'},
      {name: 'lastSampleId', type: 'uint64'},
      {name: 'rateRaw', type: 'uint128'},
      {name: 'sampleRoot', type: 'bytes32'},
      {name: 'validUntil', type: 'uint64'},
    ]},
    primaryType: 'Round',
    message: {
      deploymentId,
      policyHash,
      observationTime: schedule.observationTime,
      failureDeadline: schedule.failureDeadline,
      ...report,
    },
  })));
}

async function proposeSample(
  f: Awaited<ReturnType<typeof fixture>>,
  sampleId: bigint,
  observedAt: bigint,
  rates: readonly bigint[],
  medianRateRaw = [...rates].sort((a, b) => a < b ? -1 : 1)[1],
) {
  const sourceObservations = observations(observedAt, rates);
  const report = {
    configVersion: 1n,
    sampleId,
    observedAt,
    validUntil: observedAt + 30n,
    medianRateRaw,
    observationsHash: keccak256(encodeAbiParameters(observationParameters, [sourceObservations])),
    evidenceRoot: keccak256(`0x${sampleId.toString(16).padStart(64, '0')}`),
  };
  const signatures = await signSample(f, report);
  await f.oracle.write.proposeSample([report, sourceObservations, signatures]);
  return {report, sourceObservations, signatures};
}

describe('RateOracleV2', () => {
  it('requires independent ordered sources, the onchain median, and a sorted 3-of-5 quorum', async () => {
    const f = await fixture();
    const now = BigInt(await networkHelpers.time.latest());
    const proposed = await proposeSample(
      f,
      1n,
      now,
      [1_499_000_000n, 1_500_000_000n, 1_501_000_000n],
    );
    const sample = await f.oracle.read.sample([1n, 1n]) as {status: number};
    assert.equal(sample.status, 1, 'valid sample should be proposed');

    await networkHelpers.time.increase(3);
    await f.oracle.write.finalizeSample([1n, 1n]);
    assert.equal(await f.oracle.read.latestAcceptedSampleId([1n]), 1n);

    const nextTime = now + 120n;
    await networkHelpers.time.increaseTo(Number(nextTime));
    const invalidMedian = {...proposed.report, sampleId: 2n, observedAt: nextTime, validUntil: nextTime + 30n};
    const nextObservations = observations(nextTime, [1_499_000_000n, 1_500_000_000n, 1_501_000_000n]);
    invalidMedian.observationsHash = keccak256(encodeAbiParameters(observationParameters, [nextObservations]));
    invalidMedian.medianRateRaw = 1_501_000_000n;
    await assert.rejects(f.oracle.write.proposeSample([
      invalidMedian,
      nextObservations,
      await signSample(f, invalidMedian),
    ]));

    const validReport = {...invalidMedian, medianRateRaw: 1_500_000_000n};
    const oneSignature = await signSample(f, validReport, 1);
    await assert.rejects(f.oracle.write.proposeSample([validReport, nextObservations, oneSignature]));
    const duplicated = await signSample(f, validReport, 2);
    await assert.rejects(f.oracle.write.proposeSample([
      validReport,
      nextObservations,
      [duplicated[0], duplicated[0], duplicated[1]],
    ]));
  });

  it('quarantines a deviation until the configured resolver supplies a bounded rationale', async () => {
    const f = await fixture();
    const now = BigInt(await networkHelpers.time.latest());
    const proposed = await proposeSample(
      f,
      1n,
      now,
      [1_599_000_000n, 1_600_000_000n, 1_601_000_000n],
    );
    let sample = await f.oracle.read.sample([1n, 1n]) as {status: number};
    assert.equal(sample.status, 2, 'move beyond 5% must be quarantined');
    await assert.rejects(f.oracle.write.finalizeSample([1n, 1n]));
    await assert.rejects(f.oracle.write.resolveSample([
      1n,
      1n,
      true,
      `0x${'44'.repeat(32)}`,
      proposed.report.validUntil,
    ]));
    await f.oracle.write.resolveSample([
      1n,
      1n,
      true,
      `0x${'44'.repeat(32)}`,
      proposed.report.validUntil,
    ], {account: resolver.account});
    sample = await f.oracle.read.sample([1n, 1n]) as {status: number};
    assert.equal(sample.status, 1);
    await networkHelpers.time.increase(3);
    await f.oracle.write.finalizeSample([1n, 1n]);
  });

  it('finalizes a fully covered deterministic 60-minute TWAP and exposes IRateOracle compatibility', async () => {
    const f = await fixture();
    const start = BigInt(await networkHelpers.time.latest());
    const end = start + 3_600n;
    await f.oracle.write.scheduleRound([1n, 1n, end, end + 180n]);

    for (let index = 0; index <= 30; index += 1) {
      const observedAt = start + BigInt(index * 120);
      if (BigInt(await networkHelpers.time.latest()) < observedAt) {
        await networkHelpers.time.increaseTo(Number(observedAt));
      }
      const center = 1_500_000_000n + BigInt(index * 1_000_000);
      await proposeSample(f, BigInt(index + 1), observedAt, [center - 1_000_000n, center, center + 1_000_000n]);
      await networkHelpers.time.increase(3);
      await f.oracle.write.finalizeSample([1n, BigInt(index + 1)]);
    }

    if (BigInt(await networkHelpers.time.latest()) < end) await networkHelpers.time.increaseTo(Number(end));
    const samples = await Promise.all(Array.from({length: 31}, (_, index) => (
      f.oracle.read.sample([1n, BigInt(index + 1)])
    ))) as Array<{status: number; report: {observedAt: bigint}}>;
    for (let index = 0; index < samples.length; index += 1) {
      assert.equal(samples[index].status, 5, `sample ${index + 1} must be finalized`);
      assert.equal(samples[index].report.observedAt, start + BigInt(index * 120));
    }
    const [rateRaw, sampleRoot] = await f.oracle.read.previewTwap([1n, 1n, 1n, 31n]) as [bigint, Hex];
    // 30 equal 120-second intervals use samples 1..30. The endpoint sample
    // proves canonical history sealing but has zero time weight.
    assert.equal(rateRaw, 1_514_500_000n);
    const round = {
      configVersion: 1n,
      roundId: 1n,
      candidateId: `0x${'77'.repeat(32)}` as Hex,
      firstSampleId: 1n,
      lastSampleId: 31n,
      rateRaw,
      sampleRoot,
      validUntil: end + 120n,
    };
    await f.oracle.write.proposeRound([round, await signRound(f, round)]);
    await networkHelpers.time.increase(3);
    await f.oracle.write.finalizeRound([round.candidateId]);

    const finalized = await f.oracle.read.latestFinalizedRound([1n]) as {roundId: bigint; rateRaw: bigint};
    assert.equal(finalized.roundId, 1n);
    assert.equal(finalized.rateRaw, rateRaw);
    assert.equal(await f.oracle.read.canSettle([1n, 1n]), true);
    assert.equal(await f.oracle.read.isTradingOpen([1n]), false, 'a successor round must be scheduled before opening risk');
    const secondRoundAt = end + 960n;
    await f.oracle.write.scheduleRound([1n, 2n, secondRoundAt, secondRoundAt + 180n]);
    await f.oracle.write.scheduleRound([1n, 3n, secondRoundAt + 960n, secondRoundAt + 1_140n]);
    assert.equal(await f.oracle.read.isTradingOpen([1n]), true);

    // Exercise the unchanged protocol contracts against the V2 compatibility
    // interface, not merely the oracle in isolation.
    const token = await viem.deployContract('MockUSDC', [admin.account.address]);
    const authority = await viem.deployContract('HedgeMakerAccessManager', [admin.account.address]);
    const vault = await viem.deployContract('CollateralVault', [authority.address, token.address]);
    const marketConfig = await viem.deployContract('MarketConfig', [authority.address]);
    const positionManager = await viem.deployContract('PositionManager', [authority.address, marketConfig.address, f.oracle.address, vault.address]);
    const orderBook = await viem.deployContract('OrderBook', [authority.address, marketConfig.address, f.oracle.address, positionManager.address]);
    await vault.write.bindController([positionManager.address]);
    await positionManager.write.bindOrderBook([orderBook.address]);
    const oraclePolicyHash = await f.oracle.read.policyHashes([1n]) as Hex;
    await marketConfig.write.createVersion([{
      settlementToken: token.address,
      tokenDecimals: 6,
      lotNotionalRaw: 50_000_000n,
      tickSizeRaw: 5_000_000n,
      minRateRaw: 500_000_000n,
      maxRateRaw: 5_000_000_000n,
      minStrikeRaw: 500_000_000n,
      maxStrikeRaw: 5_000_000_000n,
      strikeBandBps: 1_000,
      initialMarginBps: 1_000,
      maintenanceMarginBps: 500,
      referenceTakerFeeBps: 5,
      effectiveTakerFeeBps: 0,
      circuitBreakerBps: 500,
      maxNotionalRaw: 1_000_000_000n,
      maxLotsPerOrder: 20,
      maxOrdersPerSeries: 32,
      maxOrdersPerWallet: 8,
      maxOrdersPerMarket: 64,
      maxMatchBatch: 4,
      maxScanBatch: 32,
      maxSyncBatch: 16,
      maxOrderLifetime: 3_600,
      maxPegLifetimeRounds: 4,
      marginGracePeriodSeconds: 60,
      maxOffsetBps: 500,
      oraclePolicyHash,
      methodologyHash: METHODOLOGY_HASH,
      feePolicyHash: `0x${'91'.repeat(32)}`,
      sponsorshipPolicyHash: `0x${'92'.repeat(32)}`,
      vault: vault.address,
      orderBook: orderBook.address,
      positionManager: positionManager.address,
      rateOracle: f.oracle.address,
    }]);
    await marketConfig.write.activateVersion([1n]);
    const seriesId = `0x${'93'.repeat(32)}` as const;
    await marketConfig.write.addSeries([1n, seriesId, {
      marketId: `0x${'94'.repeat(32)}`,
      fixingAt: secondRoundAt,
      expiryRoundId: 2n,
      oracleFailureDeadline: secondRoundAt + 180n,
      strikeBandBps: 1_000,
      calendarHash: `0x${'95'.repeat(32)}`,
      oraclePolicyHash,
    }]);
    const buyer = wallets[8];
    const seller = wallets[9];
    for (const participant of [buyer, seller]) {
      await token.write.mint([participant.account.address, 10_000_000n], {account: admin.account});
      await token.write.approve([vault.address, 10_000_000n], {account: participant.account});
    }
    const strikeRaw = 1_515_000_000n;
    const place = (side: 0 | 1, intent: Hex) => ({
      intentId: intent,
      seriesId,
      side,
      priceType: 0,
      timeInForce: 0,
      lots: 1,
      minimumImmediateFillLots: 0,
      validUntil: secondRoundAt - 1n,
      submitBy: end + 100n,
      boundRoundId: 1n,
      lastExecutableRoundId: 0n,
      limitStrikeRaw: strikeRaw,
      maxTokenPullRaw: 10_000_000n,
      offsetBps: 0,
    });
    await orderBook.write.placeOrder([place(0, `0x${'96'.repeat(32)}`)], {account: buyer.account});
    await orderBook.write.placeOrder([place(1, `0x${'97'.repeat(32)}`)], {account: seller.account});
    const opened = await positionManager.read.getPosition([1n]) as [{status: number}, {active: boolean}];
    assert.equal(opened[0].status, 1);
    assert.equal(opened[1].active, true);

    for (let step = 1; step <= 8; step += 1) {
      const observedAt = end + BigInt(step * 120);
      await networkHelpers.time.increaseTo(Number(observedAt));
      const center = 1_530_000_000n;
      const proposed = await proposeSample(f, BigInt(31 + step), observedAt, [center - 1_000_000n, center, center + 1_000_000n]);
      if (step === 1) {
        await f.oracle.write.disputeSample([1n, 32n, `0x${'99'.repeat(32)}`], {account: resolver.account});
        assert.equal(await f.oracle.read.isTradingOpen([1n]), false);
        await assert.rejects(orderBook.write.placeOrder([
          place(0, `0x${'9a'.repeat(32)}`),
        ], {account: buyer.account}));
        await f.oracle.write.resolveSample([
          1n,
          32n,
          true,
          `0x${'9b'.repeat(32)}`,
          proposed.report.validUntil,
        ], {account: resolver.account});
      }
      await networkHelpers.time.increase(3);
      await f.oracle.write.finalizeSample([1n, BigInt(31 + step)]);
      if (step === 1) assert.equal(await f.oracle.read.isTradingOpen([1n]), true);
    }
    const [secondRate, secondRoot] = await f.oracle.read.previewTwap([1n, 2n, 9n, 39n]) as [bigint, Hex];
    const secondReport = {
      configVersion: 1n,
      roundId: 2n,
      candidateId: `0x${'98'.repeat(32)}` as Hex,
      firstSampleId: 9n,
      lastSampleId: 39n,
      rateRaw: secondRate,
      sampleRoot: secondRoot,
      validUntil: secondRoundAt + 120n,
    };
    await f.oracle.write.proposeRound([secondReport, await signRound(f, secondReport)]);
    await networkHelpers.time.increase(3);
    await f.oracle.write.finalizeRound([secondReport.candidateId]);

    // New exposure halts on a quarantined successor sample, while settlement
    // against the already finalized maturity round remains available.
    const quarantinedAt = secondRoundAt + 120n;
    await networkHelpers.time.increaseTo(Number(quarantinedAt));
    await proposeSample(f, 40n, quarantinedAt, [1_699_000_000n, 1_700_000_000n, 1_701_000_000n]);
    assert.equal(await f.oracle.read.isTradingOpen([1n]), false);
    await positionManager.write.settleRounds([1n, 16]);
    const closed = await positionManager.read.getPosition([1n]) as [{status: number}, {active: boolean}];
    assert.equal(closed[0].status, 3);
    assert.equal(closed[1].active, false);
    const buyerClaim = await vault.read.claimable([buyer.account.address]) as bigint;
    const sellerClaim = await vault.read.claimable([seller.account.address]) as bigint;
    assert.equal(buyerClaim + sellerClaim, await vault.read.totalClaims());
    await vault.write.withdrawClaimable([buyerClaim], {account: buyer.account});
    await vault.write.withdrawClaimable([sellerClaim], {account: seller.account});
    assert.equal(await vault.read.totalClaims(), 0n);
  });
});
