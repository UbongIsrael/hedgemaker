import {ArrowDownToLine, ArrowUpFromLine, CircleHelp, Coins, RefreshCw, TriangleAlert} from 'lucide-react';
import {formatEther} from 'viem';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat} from '@/components/ui';
import {formatUsdc, parseUsdc} from '@/domain';
import {protocolReadConfig} from '@/integrations/contracts/config';
import {buildClaimTestUsdc, buildWithdrawClaimable} from '@/integrations/contracts/transactionBuilders';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import {useProtocolTransaction} from '@/integrations/contracts/useProtocolTransaction';
import {useAuth} from '@/integrations/privy/AuthProvider';

const DEFAULT_FAUCET_CLAIM_RAW = parseUsdc('1000');

function compactAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function transactionLabel(status: ReturnType<typeof useProtocolTransaction>['status']) {
  if (status === 'awaiting_signature') return 'Confirm in wallet…';
  if (status === 'confirming') return 'Confirming on Monad…';
  return undefined;
}

export function WalletPage() {
  const auth = useAuth();
  const portfolio = useMarketMakerPortfolio(auth.walletReady ? auth.walletAddress : undefined);
  const transaction = useProtocolTransaction();
  const data = portfolio.data;
  const transactionPending = transaction.status === 'awaiting_signature' || transaction.status === 'confirming';
  const faucetRemainingRaw = data ? data.faucetCapRaw - data.faucetMintedRaw : 0n;
  const faucetClaimRaw = faucetRemainingRaw < DEFAULT_FAUCET_CLAIM_RAW
    ? faucetRemainingRaw
    : DEFAULT_FAUCET_CLAIM_RAW;
  const value = (amount?: bigint) => amount === undefined ? '—' : `${formatUsdc(amount)} mUSDC`;

  const claimTestFunds = async () => {
    if (faucetClaimRaw <= 0n) return;
    try {
      await transaction.submit(buildClaimTestUsdc(faucetClaimRaw));
      portfolio.refresh();
    } catch {
      // The transaction hook exposes a user-safe error and keeps the current snapshot visible.
    }
  };

  const withdrawClaimable = async () => {
    if (!data || data.claimableRaw <= 0n) return;
    try {
      await transaction.submit(buildWithdrawClaimable(data.claimableRaw));
      portfolio.refresh();
    } catch {
      // The transaction hook exposes a user-safe error and keeps the current snapshot visible.
    }
  };

  return (
    <div className="hm-page hm-wallet-page" aria-labelledby="wallet-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">LIVE ACCOUNT</p><h1 id="wallet-title">Wallet</h1><p className="hm-page__description">Canonical balances for your connected wallet and the deployed HedgeMaker vault.</p></div>
        <Badge variant={portfolio.error ? 'danger' : 'success'}>{portfolio.error ? 'Read unavailable' : 'Monad testnet · live'}</Badge>
      </div>

      {!auth.walletReady && (
        <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Connecting your Privy wallet</strong><p>Waiting for the wallet address before reading chain state.</p></div></div>
      )}
      {portfolio.loading && (
        <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reading Monad</strong><p>Building one wallet, vault, order, and position snapshot.</p></div></div>
      )}
      {portfolio.error && (
        <div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Wallet snapshot unavailable</strong><p>{portfolio.error}</p></div></div>
      )}

      <section className="hm-wallet-page__summary" aria-label="Wallet balance summary" aria-busy={portfolio.loading}>
        <Stat label="Wallet balance" value={value(data?.walletBalanceRaw)} detail="Live Mock USDC balance" />
        <Stat label="Available to withdraw" value={value(data?.claimableRaw)} detail="Canonical vault claim" />
        <Stat label="Network fee balance" value={data ? `${formatEther(data.nativeBalanceRaw)} MON` : '—'} detail="Live native-token balance" />
      </section>

      <div className="hm-wallet-page__grid">
        <Card>
          <CardHeader>
            <CardTitle>Mock USDC wallet balance</CardTitle>
            <CardDescription>Valueless testnet collateral held by your connected wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-wallet-balance"><Coins size={22} aria-hidden="true" /><span>{value(data?.walletBalanceRaw)}</span><Badge variant="success">Onchain</Badge></div>
            <p className="hm-muted">The faucet mints real testnet tokens to the connected wallet. It does not mint real USDC.</p>
            {data?.nativeBalanceRaw === 0n && (
              <p className="hm-field__error" role="alert">This wallet has 0 MON. Fund it with testnet MON before claiming mUSDC or submitting any transaction.</p>
            )}
            <div className="hm-wallet-actions">
              <Button onClick={claimTestFunds} disabled={!data || faucetClaimRaw <= 0n || transactionPending}>
                <ArrowDownToLine size={16} aria-hidden="true" />
                {transactionLabel(transaction.status) ?? (faucetClaimRaw > 0n ? `Claim ${formatUsdc(faucetClaimRaw)} mUSDC` : 'Faucet limit reached')}
              </Button>
              {data && <span className="hm-muted">Lifetime faucet remaining: {formatUsdc(faucetRemainingRaw)} mUSDC.</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funds held in HedgeMaker</CardTitle>
            <CardDescription>Live, non-pooled balances reconciled from your order and position ledgers.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Reserved for open orders</dt><dd>{value(data?.reservedOrderCollateralRaw)}</dd></div>
              <div><dt>Locked in positions</dt><dd>{value(data?.lockedPositionsRaw)}</dd></div>
              <div><dt>Available to withdraw</dt><dd>{value(data?.claimableRaw)}</dd></div>
              <div><dt>Reserved for fees</dt><dd>{value(data?.reservedFeeEscrowRaw)}</dd></div>
              <div><dt>Vault allowance</dt><dd>{value(data?.vaultAllowanceRaw)}</dd></div>
            </dl>
            <div className="hm-wallet-withdraw">
              <Button variant="secondary" onClick={withdrawClaimable} disabled={!data || data.claimableRaw <= 0n || transactionPending}>
                <ArrowUpFromLine size={16} aria-hidden="true" /> Withdraw claimable
              </Button>
              <span className="hm-muted">A confirmed withdrawal moves the full displayed claimable balance to this wallet.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hm-wallet-page__network">
          <CardHeader><CardTitle>Network and wallet</CardTitle><CardDescription>Identity and snapshot provenance used for these reads.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Network</dt><dd>{protocolReadConfig.chain?.name ?? 'Monad Testnet'} · chain {protocolReadConfig.chainId ?? '—'}</dd></div>
              <div><dt>Wallet address</dt><dd title={auth.walletAddress}>{auth.walletAddress ? compactAddress(auth.walletAddress) : 'Connecting…'}</dd></div>
              <div><dt>Full funding address</dt><dd className="hm-wallet-address" title={auth.walletAddress}>{auth.walletAddress ?? 'Connecting…'}</dd></div>
              <div><dt>Snapshot block</dt><dd>{data?.blockNumber.toString() ?? '—'}</dd></div>
              <div><dt>Deployment</dt><dd>{data?.deploymentId ?? protocolReadConfig.deploymentId}</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> Values are read from Monad at one canonical block and refresh every 30 seconds.</p>
          </CardContent>
        </Card>
      </div>

      {transaction.error && <p className="hm-field__error" role="alert">{transaction.error}</p>}
      {transaction.status === 'confirmed' && transaction.hash && (
        <p className="hm-demo-note" role="status">Transaction confirmed: {transaction.hash.slice(0, 12)}…</p>
      )}
    </div>
  );
}
