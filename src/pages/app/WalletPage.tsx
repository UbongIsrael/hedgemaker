import {ArrowDownToLine, ArrowUpFromLine, CircleHelp, Coins} from 'lucide-react';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat} from '@/components/ui';
import {DEMO_BALANCES} from '@/demo/fixtures';
import {formatUsdc} from '@/domain';

export function WalletPage() {
  return (
    <div className="hm-page hm-wallet-page" aria-labelledby="wallet-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">ACCOUNT</p><h1 id="wallet-title">Wallet</h1><p className="hm-page__description">See your wallet balance, funds held in HedgeMaker, and funds available to withdraw.</p></div>
        <Badge variant="warning">Demo · sample data</Badge>
      </div>

      <section className="hm-wallet-page__summary" aria-label="Wallet balance summary">
        <Stat label="Wallet balance" value={`${formatUsdc(DEMO_BALANCES.walletUsdcRaw)} USDC`} detail="Sample wallet balance" />
        <Stat label="Available to withdraw" value={`${formatUsdc(DEMO_BALANCES.claimableUsdcRaw)} USDC`} detail="Withdraw to your wallet" />
        <Stat label="Network fee balance" value={DEMO_BALANCES.walletMon} detail="Sample MON balance for network fees" />
      </section>

      <div className="hm-wallet-page__grid">
        <Card>
          <CardHeader>
            <CardTitle>Sample USDC wallet balance</CardTitle>
            <CardDescription>These sample wallet funds are separate from funds set aside for orders and positions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-wallet-balance"><Coins size={22} aria-hidden="true" /><span>{formatUsdc(DEMO_BALANCES.walletUsdcRaw)} USDC</span><Badge variant="info">Sample balance</Badge></div>
            <p className="hm-muted">Adding funds is unavailable in this demo. No funds have been transferred or deposited.</p>
            <div className="hm-wallet-actions">
              <Button disabled aria-describedby="funding-unavailable"><ArrowDownToLine size={16} aria-hidden="true" /> Add funds</Button>
              <span id="funding-unavailable" className="hm-muted">Deposits are unavailable in this demo.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funds held in HedgeMaker</CardTitle>
            <CardDescription>These sample balances show funds held in HedgeMaker, separately from your wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Reserved for open orders</dt><dd>{formatUsdc(DEMO_BALANCES.reservedOrderCollateralRaw)} USDC</dd></div>
              <div><dt>Locked in positions</dt><dd>{formatUsdc(DEMO_BALANCES.lockedPositionRaw)} USDC</dd></div>
              <div><dt>Available to withdraw</dt><dd>{formatUsdc(DEMO_BALANCES.claimableUsdcRaw)} USDC</dd></div>
              <div><dt>Reserved for fees</dt><dd>{formatUsdc(DEMO_BALANCES.reservedFeeEscrowRaw)} USDC</dd></div>
            </dl>
            <div className="hm-wallet-withdraw">
              <Button variant="secondary" disabled aria-describedby="withdraw-unavailable"><ArrowUpFromLine size={16} aria-hidden="true" /> Withdraw funds</Button>
              <span id="withdraw-unavailable" className="hm-muted">Withdrawals are unavailable in this demo. Available funds have not been transferred to your wallet.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hm-wallet-page__network">
          <CardHeader><CardTitle>Network and wallet</CardTitle><CardDescription>Wallet and network details for this demo.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Network</dt><dd>Monad test network</dd></div>
              <div><dt>Wallet address</dt><dd>Not shown in this demo</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> These are sample balances, not live balances from your wallet or the network.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
