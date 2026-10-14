import {decodeFunctionData, type Hex} from 'viem';
import {describe, expect, it, vi} from 'vitest';
import {parseFixed, parseUsdc} from '@/domain';

vi.mock('../config', () => ({
  protocolReadConfig: {
    chainId: 10143,
    deploymentId: 'monad-testnet-v1',
    orderBookAddress: '0xdAF7ABc4594868676f4106e788BA88074Cb8CA21',
    positionManagerAddress: '0x3F8ae4Ec8C1A98b79286065338ABe16D81aB2a1d',
    settlementTokenAddress: '0x1104E65eDDC14Db1661667Ee3C3E9BA8717D6395',
    vaultAddress: '0xC42674265F553889B845641cee0F0E2E65Af5d0b',
  },
}));

import {mockUsdcAbi, orderBookReadAbi} from '../abis';
import {
  buildClaimTestUsdc,
  buildPlaceOrder,
  buildSettlementTokenApproval,
  TransactionBuildError,
  type PlaceOrderBuildContext,
  type PlaceOrderDraft,
} from '../transactionBuilders';

const seriesId = `0x${'12'.repeat(32)}` as Hex;
const intentId = `0x${'34'.repeat(32)}` as Hex;

const context: PlaceOrderBuildContext = {
  blockNumber: 100n,
  blockTimestamp: 1_000n,
  configVersion: 1n,
  roundId: 7n,
  referenceRateRaw: parseFixed('1650'),
  tradingOpen: true,
  matchingPaused: false,
  series: {
    seriesId,
    marketId: `0x${'56'.repeat(32)}`,
    configVersion: 1n,
    fixingAt: 10_000n,
    expiryRoundId: 20n,
    oracleFailureDeadline: 11_000n,
    strikeBandBps: 500,
  },
  config: {
    lotNotionalRaw: parseUsdc('50'),
    tickSizeRaw: parseFixed('5'),
    minStrikeRaw: parseFixed('1000'),
    maxStrikeRaw: parseFixed('2500'),
    initialMarginBps: 500,
    maintenanceMarginBps: 250,
    effectiveTakerFeeBps: 5,
    maxLotsPerOrder: 100,
    maxMatchBatch: 20,
    maxScanBatch: 100,
    maxSyncBatch: 20,
    maxOrderLifetime: 3_600,
    maxPegLifetimeRounds: 10,
    marginGracePeriodSeconds: 900,
    maxOffsetBps: 300,
  },
};

const fixedDraft: PlaceOrderDraft = {
  intentId,
  seriesId,
  side: 'USD_BUYER',
  priceType: 'fixed',
  timeInForce: 'rest',
  lots: 2,
  minimumImmediateFillLots: 0,
  validUntil: 2_000n,
  submitBy: 1_060n,
  limitStrikeRaw: parseFixed('1675'),
  offsetBps: 0,
};

describe('market-maker unsigned transaction builders', () => {
  it('builds an exact fixed-order reserve and scoped calldata', () => {
    const built = buildPlaceOrder(fixedDraft, context);
    const expectedAdverse = (parseUsdc('50') * parseFixed('25') + parseFixed('1650') - 1n)
      / parseFixed('1650');

    expect(built.preview.adverseEntryReservePerLotRaw).toBe(expectedAdverse);
    expect(built.preview.feeEscrowRaw).toBe(50_000n);
    expect(built.preview.maxTokenPullRaw).toBe(
      (parseUsdc('2.5') + expectedAdverse) * 2n + 50_000n,
    );
    expect(built.transaction.to).toBe('0xdAF7ABc4594868676f4106e788BA88074Cb8CA21');
    expect(built.transaction.chainId).toBe(10143);

    const decoded = decodeFunctionData({abi: orderBookReadAbi, data: built.transaction.data});
    expect(decoded.functionName).toBe('placeOrder');
    expect(built.transaction.decodedIntent.maxTokenPullRaw).toBe(
      built.preview.maxTokenPullRaw.toString(),
    );
  });

  it('marks a pegged order outside its owner limit as currently non-executable', () => {
    const built = buildPlaceOrder({
      ...fixedDraft,
      side: 'USD_SELLER',
      priceType: 'pegged',
      limitStrikeRaw: parseFixed('1700'),
      offsetBps: 0,
      lastExecutableRoundId: 10n,
    }, context);

    expect(built.preview.effectiveStrikeRaw).toBe(parseFixed('1650'));
    expect(built.preview.currentlyExecutable).toBe(false);
    expect(built.transaction.decodedIntent.boundRoundId).toBe('0');
  });

  it('refuses to prepare new risk while matching is paused', () => {
    expect(() => buildPlaceOrder(fixedDraft, {...context, matchingPaused: true}))
      .toThrow(TransactionBuildError);
  });

  it('approves the vault, never the order book', () => {
    const approval = buildSettlementTokenApproval(1_000_000n);
    expect(approval.to).toBe('0x1104E65eDDC14Db1661667Ee3C3E9BA8717D6395');
    expect(approval.decodedIntent.spender).toBe('0xC42674265F553889B845641cee0F0E2E65Af5d0b');
  });

  it('builds a faucet claim only against the configured test token', () => {
    const claim = buildClaimTestUsdc(parseUsdc('1000'));
    expect(claim.to).toBe('0x1104E65eDDC14Db1661667Ee3C3E9BA8717D6395');
    const decoded = decodeFunctionData({abi: mockUsdcAbi, data: claim.data});
    expect(decoded.functionName).toBe('claimFaucet');
    expect(claim.decodedIntent.amountRaw).toBe(parseUsdc('1000').toString());
  });
});
