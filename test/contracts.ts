import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

const { viem, networkHelpers } = await network.create();
const wallets = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();
const [admin, signer, resolver, buyer, seller] = wallets;
const adminAddress = admin.account.address;

async function authority() {
  return viem.deployContract("HedgeMakerAccessManager", [adminAddress]);
}

async function oracleFixture() {
  const manager = await authority();
  const oracle = await viem.deployContract("RateOracle", [manager.address, `0x${"11".repeat(32)}`]);
  const token = await viem.deployContract("MockUSDC", [adminAddress]);
  const now = BigInt(await networkHelpers.time.latest());
  const methodologyHash = `0x${"22".repeat(32)}` as const;
  const policy = {
    signer: signer.account.address,
    resolver: resolver.account.address,
    methodologyHash,
    challengePeriod: 20,
    maxPublicationDelay: 60,
    maxFailureDelay: 300,
    staleAfter: 600,
    circuitBreakerBps: 2_000,
    minRateRaw: 1_000_000n,
    maxRateRaw: 2_000_000n,
    configured: false,
  };
  await oracle.write.configureFeed([1, policy]);
  const observationTime = BigInt(await networkHelpers.time.latest());
  const failureDeadline = observationTime + 200n;
  await oracle.write.scheduleRound([1, 1, observationTime, failureDeadline]);
  await oracle.write.scheduleRound([1, 2, observationTime + 100n, failureDeadline + 100n]);
  return { manager, oracle, token, now, policy, methodologyHash, observationTime, failureDeadline };
}

async function signedObservation(oracle: Awaited<ReturnType<typeof oracleFixture>>, roundId = 1n, candidate = 0x33) {
  const now = BigInt(await networkHelpers.time.latest());
  const observation = {
    configVersion: 1n,
    roundId,
    candidateId: `0x${candidate.toString(16).padStart(2, "0").repeat(32)}` as `0x${string}`,
    observationTime: oracle.observationTime,
    publicationTime: oracle.observationTime,
    validUntil: now + 1_000n,
    failureDeadline: oracle.failureDeadline,
    rateRaw: 1_500_000n,
    sourceHash: `0x${"44".repeat(32)}` as const,
    methodologyHash: oracle.methodologyHash,
  };
  const signature = await signer.signTypedData({
    domain: {
      name: "HedgeMaker Rate Oracle",
      version: "1",
      chainId: await publicClient.getChainId(),
      verifyingContract: oracle.oracle.address,
    },
    types: {
      Observation: [
        { name: "deploymentId", type: "bytes32" },
        { name: "configVersion", type: "uint64" },
        { name: "roundId", type: "uint64" },
        { name: "candidateId", type: "bytes32" },
        { name: "observationTime", type: "uint64" },
        { name: "publicationTime", type: "uint64" },
        { name: "validUntil", type: "uint64" },
        { name: "failureDeadline", type: "uint64" },
        { name: "rateRaw", type: "uint128" },
        { name: "sourceHash", type: "bytes32" },
        { name: "methodologyHash", type: "bytes32" },
      ],
    },
    primaryType: "Observation",
    message: {
      deploymentId: await oracle.oracle.read.deploymentId() as `0x${string}`,
      ...observation,
    },
  });
  return { observation, signature };
}

describe("MockUSDC", () => {
  it("enforces the lifetime faucet cap and the global supply cap", async () => {
    const token = await viem.deployContract("MockUSDC", [adminAddress]);
    assert.equal(await token.read.decimals(), 6);
    await token.write.claimFaucet([10_000_000_000n]);
    await assert.rejects(token.write.claimFaucet([1n]));
    await token.write.mint([buyer.account.address, 99_990_000_000_000n]);
    await assert.rejects(token.write.mint([buyer.account.address, 1n]));
    assert.equal(await token.read.totalSupply(), 100_000_000_000_000n);
  });
});

describe("ForwardMath", () => {
  it("ceil-reserves the exact rational adverse fixed-order value", async () => {
    const harness = await viem.deployContract("ForwardMathHarness");
    assert.equal(await harness.read.buyerValue([1_000_000, 3, 4]), -333_333n);
    assert.equal(await harness.read.fixedReservePerLot([100, 1_000_000, 3, 4, true]), 333_434n);
  });

  it("rounds pegged limits in the owner's protective direction", async () => {
    const harness = await viem.deployContract("ForwardMathHarness");
    assert.equal(await harness.read.peggedLimit([1_503, 100, 10, true]), 1_510n);
    assert.equal(await harness.read.peggedLimit([1_503, 100, 10, false]), 1_520n);
  });
});

describe("RateOracle", () => {
  it("accepts signed observations, disputes and accepts evidence, then finalizes", async () => {
    const f = await oracleFixture();
    const { observation, signature } = await signedObservation(f);
    await f.oracle.write.proposeObservation([observation, signature]);
    const evidence = `0x${"55".repeat(32)}` as const;
    await f.oracle.write.disputeObservation([observation.candidateId, evidence], { account: resolver.account });
    await f.oracle.write.resolveDispute(
      [observation.candidateId, true, `0x${"66".repeat(32)}`],
      { account: resolver.account },
    );
    await networkHelpers.time.increase(21);
    await f.oracle.write.finalizeObservation([observation.candidateId]);
    const round = await f.oracle.read.finalizedRound([1, 1]) as { roundId: bigint; rateRaw: bigint };
    assert.equal(round.roundId, 1n);
    assert.equal(round.rateRaw, 1_500_000n);
    assert.equal(await f.oracle.read.isTradingOpen([1]), true);
  });

  it("rejects an observation whose EIP-712 signature is changed", async () => {
    const f = await oracleFixture();
    const { observation, signature } = await signedObservation(f);
    await assert.rejects(f.oracle.write.proposeObservation([
      { ...observation, rateRaw: observation.rateRaw + 1n }, signature,
    ]));
  });

  it("lets the public submit evidence without letting it halt the feed", async () => {
    const f = await oracleFixture();
    const { observation, signature } = await signedObservation(f);
    await f.oracle.write.proposeObservation([observation, signature]);
    await f.oracle.write.submitEvidence([observation.candidateId, `0x${"77".repeat(32)}`], {
      account: buyer.account,
    });
    await assert.rejects(
      f.oracle.write.disputeObservation([observation.candidateId, `0x${"78".repeat(32)}`], {
        account: buyer.account,
      }),
    );
    await networkHelpers.time.increase(21);
    await f.oracle.write.finalizeObservation([observation.candidateId]);
  });
});

describe("funded fixed order match and settlement", () => {
  it("escrows both orders, opens a position, settles a fixing, and pays claims", async () => {
    const manager = await authority();
    const token = await viem.deployContract("MockUSDC", [adminAddress]);
    const oracle = await viem.deployContract("RateOracle", [manager.address, `0x${"77".repeat(32)}`]);
    const vault = await viem.deployContract("CollateralVault", [manager.address, token.address]);
    const configContract = await viem.deployContract("MarketConfig", [manager.address]);
    const pm = await viem.deployContract("PositionManager", [manager.address, configContract.address, oracle.address, vault.address]);
    const book = await viem.deployContract("OrderBook", [manager.address, configContract.address, oracle.address, pm.address]);
    await vault.write.bindController([pm.address]);
    await pm.write.bindOrderBook([book.address]);

    const policyHash = `0x${"88".repeat(32)}` as const;
    const config = {
      settlementToken: token.address, tokenDecimals: 6, lotNotionalRaw: 100_000_000n,
      tickSizeRaw: 1n, minRateRaw: 1_000_000n, maxRateRaw: 2_000_000n,
      minStrikeRaw: 1_000_000n, maxStrikeRaw: 2_000_000n, strikeBandBps: 1_000,
      initialMarginBps: 1_000, maintenanceMarginBps: 500, referenceTakerFeeBps: 100,
      effectiveTakerFeeBps: 0, circuitBreakerBps: 2_000,
      maxNotionalRaw: 1_000_000_000n, maxLotsPerOrder: 10,
      maxOrdersPerSeries: 20, maxOrdersPerWallet: 10, maxOrdersPerMarket: 40,
      maxMatchBatch: 10, maxScanBatch: 20, maxSyncBatch: 10,
      maxOrderLifetime: 3_600, maxPegLifetimeRounds: 10, marginGracePeriodSeconds: 30,
      maxOffsetBps: 500, oraclePolicyHash: policyHash, feePolicyHash: `0x${"99".repeat(32)}`,
      sponsorshipPolicyHash: `0x${"aa".repeat(32)}`, vault: vault.address, orderBook: book.address,
      positionManager: pm.address, rateOracle: oracle.address,
    };
    const now = BigInt(await networkHelpers.time.latest());
    const fixingAt = now + 600n;
    const seriesId = `0x${"bb".repeat(32)}` as const;
    const methodologyHash = `0x${"ee".repeat(32)}` as const;
    const configured = { ...config, methodologyHash };
    await configContract.write.createVersion([configured]);
    await oracle.write.configureFeed([1, {
      signer: signer.account.address, resolver: resolver.account.address, methodologyHash,
      challengePeriod: 10, maxPublicationDelay: 60, maxFailureDelay: 300, staleAfter: 900,
      circuitBreakerBps: 2_000,
      minRateRaw: 1_000_000n, maxRateRaw: 2_000_000n, configured: false,
    }]);
    const first = await networkHelpers.time.latest();
    await oracle.write.scheduleRound([1, 1, first, first + 200]);
    await oracle.write.scheduleRound([1, 2, fixingAt, fixingAt + 300n]);
    await configContract.write.activateVersion([1]);
    await configContract.write.addSeries([1, seriesId, {
      marketId: `0x${"cc".repeat(32)}`, fixingAt, expiryRoundId: 2,
      oracleFailureDeadline: fixingAt + 300n, strikeBandBps: 1_000,
      calendarHash: `0x${"dd".repeat(32)}`, oraclePolicyHash: policyHash,
    }]);
    const obs1 = {
      configVersion: 1n, roundId: 1n, candidateId: `0x${"12".repeat(32)}` as const,
      observationTime: BigInt(first), publicationTime: BigInt(first), validUntil: BigInt(first + 1_000),
      failureDeadline: BigInt(first + 200), rateRaw: 1_500_000n, sourceHash: `0x${"13".repeat(32)}` as const,
      methodologyHash,
    };
    const signObs = async (obs: typeof obs1) => signer.signTypedData({
      domain: { name: "HedgeMaker Rate Oracle", version: "1", chainId: await publicClient.getChainId(), verifyingContract: oracle.address },
      types: { Observation: [
        { name: "deploymentId", type: "bytes32" }, { name: "configVersion", type: "uint64" },
        { name: "roundId", type: "uint64" }, { name: "candidateId", type: "bytes32" },
        { name: "observationTime", type: "uint64" }, { name: "publicationTime", type: "uint64" },
        { name: "validUntil", type: "uint64" }, { name: "failureDeadline", type: "uint64" },
        { name: "rateRaw", type: "uint128" }, { name: "sourceHash", type: "bytes32" },
        { name: "methodologyHash", type: "bytes32" },
      ] }, primaryType: "Observation", message: {
        deploymentId: await oracle.read.deploymentId() as `0x${string}`,
        ...obs,
      },
    });
    await oracle.write.proposeObservation([obs1, await signObs(obs1)]);
    await networkHelpers.time.increase(11);
    await oracle.write.finalizeObservation([obs1.candidateId]);

    const amount = 20_000_000n;
    for (const wallet of [buyer, seller]) {
      await token.write.mint([wallet.account.address, amount], { account: admin.account });
      await token.write.approve([vault.address, amount], { account: wallet.account });
    }
    const validUntil = fixingAt - 1n;
    const submitBy = BigInt(await networkHelpers.time.latest()) + 60n;
    const place = (side: number) => ({
      intentId: side === 0 ? `0x${"a1".repeat(32)}` : `0x${"a2".repeat(32)}`,
      seriesId, side, priceType: 0, timeInForce: 0, lots: 1, minimumImmediateFillLots: 0,
      validUntil, submitBy, boundRoundId: 1, lastExecutableRoundId: 0, limitStrikeRaw: 1_500_000,
      maxTokenPullRaw: 20_000_000, offsetBps: 0,
    });
    await book.write.placeOrder([place(0)], { account: buyer.account });
    await book.write.placeOrder([place(1)], { account: seller.account });
    const position = await pm.read.getPosition([1]) as [
      { status: number; strikeRaw: bigint },
      { active: boolean },
    ];
    assert.equal(position[0].status, 1);
    assert.equal(position[0].strikeRaw, 1_500_000n);
    assert.equal(await vault.read.totalPositionCollateral(), 20_000_000n);
    assert.equal(await vault.read.totalOrderCollateral(), 0n);

    await networkHelpers.time.increaseTo(Number(fixingAt));
    const nextTime = await networkHelpers.time.latest();
    const obs2 = {
      ...obs1, roundId: 2n, candidateId: `0x${"14".repeat(32)}` as const,
      observationTime: BigInt(nextTime), publicationTime: BigInt(nextTime),
      validUntil: BigInt(nextTime + 250), failureDeadline: fixingAt + 300n, rateRaw: 1_650_000n,
      sourceHash: `0x${"15".repeat(32)}` as const,
    };
    await oracle.write.proposeObservation([obs2, await signObs(obs2)]);
    await networkHelpers.time.increase(11);
    await oracle.write.finalizeObservation([obs2.candidateId]);
    await pm.write.settleRounds([1, 1]);
    const after = await pm.read.getPosition([1]) as [
      { status: number; strikeRaw: bigint },
      { active: boolean },
    ];
    assert.equal(after[0].status, 3);
    assert.equal(after[1].active, false);
    assert.equal(await vault.read.totalPositionCollateral(), 0n);
    const buyerClaim = await vault.read.claimable([buyer.account.address]) as bigint;
    const sellerClaim = await vault.read.claimable([seller.account.address]) as bigint;
    assert.equal(buyerClaim + sellerClaim, 20_000_000n);
    await vault.write.withdrawClaimable([buyerClaim], { account: buyer.account });
    assert.equal(await vault.read.claimable([buyer.account.address]), 0n);
    assert.equal(await token.read.balanceOf([buyer.account.address]), amount - 10_000_000n + buyerClaim);
  });
});
