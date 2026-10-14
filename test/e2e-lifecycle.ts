import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {network} from 'hardhat';
import type {Hex} from 'viem';

const {viem, networkHelpers} = await network.create();
const wallets = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();
const [admin, oracleSigner, resolver, buyer, sellerA, sellerB, sellerC, sellerD] = wallets;

const METHODOLOGY_HASH = `0x${'81'.repeat(32)}` as const;
const ORACLE_POLICY_HASH = `0x${'82'.repeat(32)}` as const;
const MARKET_ID = `0x${'83'.repeat(32)}` as const;
const SERIES_ID = `0x${'84'.repeat(32)}` as const;
const RATE_RAW = 1_500_000_000n;
const LOT_RAW = 50_000_000n;

async function signObservation(
  oracle: Awaited<ReturnType<typeof viem.deployContract>>,
  observation: {
    configVersion: bigint;
    roundId: bigint;
    candidateId: Hex;
    observationTime: bigint;
    publicationTime: bigint;
    validUntil: bigint;
    failureDeadline: bigint;
    rateRaw: bigint;
    sourceHash: Hex;
    methodologyHash: Hex;
  },
) {
  return oracleSigner.signTypedData({
    domain: {
      name: 'HedgeMaker Rate Oracle',
      version: '1',
      chainId: await publicClient.getChainId(),
      verifyingContract: oracle.address,
    },
    types: {Observation: [
      {name: 'deploymentId', type: 'bytes32'},
      {name: 'configVersion', type: 'uint64'},
      {name: 'roundId', type: 'uint64'},
      {name: 'candidateId', type: 'bytes32'},
      {name: 'observationTime', type: 'uint64'},
      {name: 'publicationTime', type: 'uint64'},
      {name: 'validUntil', type: 'uint64'},
      {name: 'failureDeadline', type: 'uint64'},
      {name: 'rateRaw', type: 'uint128'},
      {name: 'sourceHash', type: 'bytes32'},
      {name: 'methodologyHash', type: 'bytes32'},
    ]},
    primaryType: 'Observation',
    message: {
      deploymentId: await oracle.read.deploymentId() as Hex,
      ...observation,
    },
  });
}

async function deployProtocol(options: {expiryRoundId?: number; marginGrace?: number} = {}) {
  const expiryRoundId = options.expiryRoundId ?? 2;
  const marginGrace = options.marginGrace ?? 60;
  const authority = await viem.deployContract('HedgeMakerAccessManager', [admin.account.address]);
  const token = await viem.deployContract('MockUSDC', [admin.account.address]);
  const oracle = await viem.deployContract('RateOracle', [authority.address, `0x${'85'.repeat(32)}`]);
  const vault = await viem.deployContract('CollateralVault', [authority.address, token.address]);
  const marketConfig = await viem.deployContract('MarketConfig', [authority.address]);
  const positionManager = await viem.deployContract('PositionManager', [
    authority.address,
    marketConfig.address,
    oracle.address,
    vault.address,
  ]);
  const orderBook = await viem.deployContract('OrderBook', [
    authority.address,
    marketConfig.address,
    oracle.address,
    positionManager.address,
  ]);
  await vault.write.bindController([positionManager.address]);
  await positionManager.write.bindOrderBook([orderBook.address]);

  const start = BigInt(await networkHelpers.time.latest());
  const fixingAt = start + (expiryRoundId === 2 ? 600n : 500n);
  const roundTimes = expiryRoundId === 2 ? [start, fixingAt] : [start, start + 200n, fixingAt];
  await oracle.write.configureFeed([1n, {
    signer: oracleSigner.account.address,
    resolver: resolver.account.address,
    methodologyHash: METHODOLOGY_HASH,
    challengePeriod: 2n,
    maxPublicationDelay: 60n,
    maxFailureDelay: 300n,
    staleAfter: 900n,
    circuitBreakerBps: 500,
    minRateRaw: 500_000_000n,
    maxRateRaw: 5_000_000_000n,
    configured: false,
  }]);
  for (let index = 0; index < roundTimes.length; index += 1) {
    await oracle.write.scheduleRound([
      1n,
      BigInt(index + 1),
      roundTimes[index],
      roundTimes[index] + 180n,
    ]);
  }

  const config = {
    settlementToken: token.address,
    tokenDecimals: 6,
    lotNotionalRaw: LOT_RAW,
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
    marginGracePeriodSeconds: marginGrace,
    maxOffsetBps: 500,
    oraclePolicyHash: ORACLE_POLICY_HASH,
    methodologyHash: METHODOLOGY_HASH,
    feePolicyHash: `0x${'86'.repeat(32)}` as const,
    sponsorshipPolicyHash: `0x${'87'.repeat(32)}` as const,
    vault: vault.address,
    orderBook: orderBook.address,
    positionManager: positionManager.address,
    rateOracle: oracle.address,
  };
  await marketConfig.write.createVersion([config]);
  await marketConfig.write.activateVersion([1n]);
  await marketConfig.write.addSeries([1n, SERIES_ID, {
    marketId: MARKET_ID,
    fixingAt,
    expiryRoundId,
    oracleFailureDeadline: fixingAt + 180n,
    strikeBandBps: 1_000,
    calendarHash: `0x${'88'.repeat(32)}`,
    oraclePolicyHash: ORACLE_POLICY_HASH,
  }]);

  const publish = async (roundId: number, rateRaw: bigint) => {
    const observationTime = roundTimes[roundId - 1];
    if (BigInt(await networkHelpers.time.latest()) < observationTime) {
      await networkHelpers.time.increaseTo(Number(observationTime));
    }
    const now = BigInt(await networkHelpers.time.latest());
    const observation = {
      configVersion: 1n,
      roundId: BigInt(roundId),
      candidateId: `0x${(0x90 + roundId).toString(16).padStart(2, '0').repeat(32)}` as Hex,
      observationTime,
      publicationTime: now,
      validUntil: now + 60n,
      failureDeadline: observationTime + 180n,
      rateRaw,
      sourceHash: `0x${(0xa0 + roundId).toString(16).padStart(2, '0').repeat(32)}` as Hex,
      methodologyHash: METHODOLOGY_HASH,
    };
    await oracle.write.proposeObservation([observation, await signObservation(oracle, observation)]);
    await networkHelpers.time.increase(3);
    await oracle.write.finalizeObservation([observation.candidateId]);
  };
  await publish(1, RATE_RAW);

  const fund = async (client: (typeof wallets)[number], amount = 100_000_000n) => {
    await token.write.mint([client.account.address, amount], {account: admin.account});
    await token.write.approve([vault.address, amount], {account: client.account});
  };

  const place = async (
    client: (typeof wallets)[number],
    side: 0 | 1,
    lots: number,
    intentByte: number,
    strikeRaw = RATE_RAW,
  ) => {
    const current = BigInt(await networkHelpers.time.latest());
    return orderBook.write.placeOrder([{
      intentId: `0x${intentByte.toString(16).padStart(2, '0').repeat(32)}` as Hex,
      seriesId: SERIES_ID,
      side,
      priceType: 0,
      timeInForce: 0,
      lots,
      minimumImmediateFillLots: 0,
      validUntil: fixingAt - 1n,
      submitBy: current + 60n,
      boundRoundId: 1n,
      lastExecutableRoundId: 0n,
      limitStrikeRaw: strikeRaw,
      maxTokenPullRaw: 100_000_000n,
      offsetBps: 0,
    }], {account: client.account});
  };

  return {
    token,
    oracle,
    vault,
    marketConfig,
    positionManager,
    orderBook,
    fixingAt,
    publish,
    fund,
    place,
  };
}

describe('complete funded order lifecycle', () => {
  it('fills one $500 order with $200 + $100 + $50 + $150 and settles every child position', async () => {
    const f = await deployProtocol();
    const counterparties = [sellerA, sellerB, sellerC, sellerD];
    await f.fund(buyer);
    for (const seller of counterparties) await f.fund(seller);

    await f.place(buyer, 0, 10, 0xb1);
    const sellerLots = [4, 2, 1, 3];
    for (let index = 0; index < counterparties.length; index += 1) {
      await f.place(counterparties[index], 1, sellerLots[index], 0xc1 + index);
    }

    const buyerOrder = await f.orderBook.read.getOrder([1n]) as {lotsFilled: number; status: number};
    assert.equal(buyerOrder.lotsFilled, 10);
    assert.equal(buyerOrder.status, 2, 'the $500 parent order is fully filled');
    assert.deepEqual(await f.orderBook.read.activeOrderIds([SERIES_ID]), []);
    assert.equal(await f.vault.read.totalOrderCollateral(), 0n);
    assert.equal(await f.vault.read.totalPositionCollateral(), 100_000_000n);

    for (let index = 0; index < sellerLots.length; index += 1) {
      const [position, ledger] = await f.positionManager.read.getPosition([BigInt(index + 1)]) as [
        {buyer: Hex; seller: Hex; notionalRaw: bigint; strikeRaw: bigint; status: number},
        {buyerCollateral: bigint; sellerCollateral: bigint; active: boolean},
      ];
      assert.equal(position.buyer.toLowerCase(), buyer.account.address.toLowerCase());
      assert.equal(position.seller.toLowerCase(), counterparties[index].account.address.toLowerCase());
      assert.equal(position.notionalRaw, LOT_RAW * BigInt(sellerLots[index]));
      assert.equal(position.strikeRaw, RATE_RAW);
      assert.equal(position.status, 1);
      assert.equal(ledger.buyerCollateral, 5_000_000n * BigInt(sellerLots[index]));
      assert.equal(ledger.sellerCollateral, 5_000_000n * BigInt(sellerLots[index]));
      assert.equal(ledger.active, true);
    }

    await f.publish(2, RATE_RAW);
    for (let positionId = 1n; positionId <= 4n; positionId += 1n) {
      await f.positionManager.write.settleRounds([positionId, 16]);
    }
    assert.equal(await f.vault.read.totalPositionCollateral(), 0n);
    assert.equal(await f.vault.read.liabilities(), 100_000_000n);

    const participants = [buyer, ...counterparties];
    let totalClaims = 0n;
    for (const participant of participants) {
      const claim = await f.vault.read.claimable([participant.account.address]) as bigint;
      totalClaims += claim;
      if (claim > 0n) {
        await f.vault.write.withdrawClaimable([claim], {account: participant.account});
      }
      assert.equal(await f.vault.read.claimable([participant.account.address]), 0n);
    }
    assert.equal(totalClaims, 100_000_000n);
    assert.equal(await f.vault.read.liabilities(), 0n);
    assert.equal(await f.token.read.balanceOf([f.vault.address]), 0n);
  });

  it('keeps non-crossing ticks open and returns only an unfilled remainder on cancellation', async () => {
    const f = await deployProtocol();
    await f.fund(buyer);
    await f.fund(sellerA);
    await f.fund(sellerB);

    await f.place(buyer, 0, 10, 0xd1);
    await f.place(sellerA, 1, 4, 0xd2);
    await f.orderBook.write.cancelOrder([1n], {account: buyer.account});
    const buyerOrder = await f.orderBook.read.getOrder([1n]) as {lotsFilled: number; status: number};
    assert.equal(buyerOrder.lotsFilled, 4);
    assert.equal(buyerOrder.status, 3);
    assert.equal(await f.vault.read.claimable([buyer.account.address]), 30_000_000n);
    const orderLedger = await f.vault.read.orderLedger([1n]) as {collateral: bigint; feeEscrow: bigint};
    assert.equal(orderLedger.collateral, 0n);
    assert.equal(orderLedger.feeEscrow, 0n);

    await f.place(buyer, 0, 1, 0xd3, RATE_RAW - 5_000_000n);
    await f.place(sellerB, 1, 1, 0xd4, RATE_RAW + 5_000_000n);
    const activeIds = await f.orderBook.read.activeOrderIds([SERIES_ID]) as bigint[];
    assert.deepEqual(activeIds, [3n, 4n]);
    const bid = await f.orderBook.read.getOrder([3n]) as {lotsFilled: number; status: number};
    const ask = await f.orderBook.read.getOrder([4n]) as {lotsFilled: number; status: number};
    assert.equal(bid.lotsFilled, 0);
    assert.equal(ask.lotsFilled, 0);
    assert.equal(bid.status, 1);
    assert.equal(ask.status, 1);
  });

  it('creates a reachable maintenance call and accepts the exact cure amount before its deadline', async () => {
    const f = await deployProtocol({expiryRoundId: 3, marginGrace: 60});
    await f.fund(buyer);
    await f.fund(sellerA);
    await f.place(buyer, 0, 10, 0xe1);
    await f.place(sellerA, 1, 10, 0xe2);

    await f.publish(2, 1_425_000_000n);
    await f.positionManager.write.syncPosition([1n, 16]);
    let [position, ledger] = await f.positionManager.read.getPosition([1n]) as [
      {buyerCallDeadline: bigint; status: number},
      {buyerCollateral: bigint; sellerCollateral: bigint},
    ];
    assert.equal(position.status, 1);
    assert.ok(position.buyerCallDeadline > 0n);
    assert.equal(ledger.buyerCollateral, 23_684_211n);
    assert.equal(ledger.sellerCollateral, 76_315_789n);

    const cure = 50_000_000n - ledger.buyerCollateral;
    assert.equal(cure, 26_315_789n);
    await f.positionManager.write.addMargin([1n, true, cure, 16], {account: buyer.account});
    [position, ledger] = await f.positionManager.read.getPosition([1n]) as [
      {buyerCallDeadline: bigint; status: number},
      {buyerCollateral: bigint; sellerCollateral: bigint},
    ];
    assert.equal(position.buyerCallDeadline, 0n);
    assert.equal(ledger.buyerCollateral, 50_000_000n);
  });
});
