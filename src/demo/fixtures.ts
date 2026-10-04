import {parseFixed, parseUsdc} from '@/domain';

export const DEMO_MARKET = {
  mode: 'demo' as const,
  pair: 'USD / NGN',
  referenceRateRaw: parseFixed('1650'),
  previousRateRaw: parseFixed('1642.5'),
  roundId: 42n,
  source: 'Sample USD/NGN reference rate',
  sourceStatus: 'Confirmed' as const,
  observedAt: '03 Oct 2026 · 14:00 WAT',
  challenge: 'Challenge complete',
  lotNotionalRaw: parseUsdc('100'),
  tickRaw: parseFixed('0.5'),
  strikeBandBps: 500n,
  initialMarginBps: 500n,
  maintenanceMarginBps: 250n,
  maturities: [
    {id: 'oct-10', label: '10 Oct 2026', tenor: '7 days', fixing: '10 Oct · 14:00 UTC'},
    {id: 'oct-17', label: '17 Oct 2026', tenor: '14 days', fixing: '17 Oct · 14:00 UTC'},
    {id: 'nov-02', label: '02 Nov 2026', tenor: '30 days', fixing: '02 Nov · 14:00 UTC'},
  ],
};

export const DEMO_BALANCES = {
  walletUsdcRaw: parseUsdc('482.50'),
  reservedOrderCollateralRaw: parseUsdc('50'),
  reservedFeeEscrowRaw: 0n,
  lockedPositionRaw: parseUsdc('100'),
  claimableUsdcRaw: parseUsdc('29.411764'),
  walletMon: '3.84 MON',
};

export const DEMO_BOOK = {
  buyers: [
    {strike: '1,649.0', notional: '$1,200', orders: 4},
    {strike: '1,647.5', notional: '$800', orders: 2},
    {strike: '1,644.0', notional: '$2,100', orders: 7},
  ],
  sellers: [
    {strike: '1,651.0', notional: '$900', orders: 3},
    {strike: '1,653.0', notional: '$1,500', orders: 5},
    {strike: '1,656.5', notional: '$700', orders: 2},
  ],
};

export const DEMO_POSITIONS = [
  {
    id: 'HM-2481',
    intent: 'I need dollars later',
    side: 'USD buyer',
    notional: '$1,000',
    strike: '₦1,650.00',
    currentRate: '₦1,700.00',
    maturity: '10 Oct 2026',
    equity: '79.411764 USDC',
    initial: '50.00 USDC',
    maintenance: '25.00 USDC',
    counterpartyEquity: '20.588236 USDC',
    pnl: '+29.411764 USDC',
    health: 78,
    status: 'Open',
  },
];

export const DEMO_ORDER = {
  id: 'ORD-1047',
  intent: 'I earn dollars',
  pricing: 'Reference rate − 0.10%',
  effectiveStrike: '₦1,648.00',
  notional: '$500',
  filled: '$200',
  remaining: '$300',
  expiry: 'Today · 16:20 WAT',
  status: 'Partly matched',
};

export const DEMO_ACTIVITY = [
  {kind: 'Reference rate confirmed', detail: 'Sample rate: ₦1,650.00 per USD', time: '14:06'},
  {kind: 'Position balance updated', detail: '+29.411764 USDC remains locked', time: '14:07'},
  {kind: 'Order partly matched', detail: '$200 of your $500 order matched', time: '13:42'},
  {kind: 'Funds available to withdraw', detail: '29.411764 USDC ready to withdraw', time: 'Yesterday'},
];
