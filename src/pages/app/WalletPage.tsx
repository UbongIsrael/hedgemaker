import {ArrowDownToLine, ArrowUpFromLine, CircleHelp, Coins, ExternalLink} from 'lucide-react';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Stat} from '@/components/ui';
import {DEMO_BALANCES} from '@/demo/fixtures';
import {formatUsdc} from '@/domain';

export function WalletPage() {
  return (
    <div className="hm-page hm-wallet-page" aria-labelledby="wallet-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">ACCOUNT</p><h1 id="wallet-title">Wallet</h1><p className="hm-page__description">Review wallet tokens, Vault reservations, and claimable funds.</p></div>
        <Badge variant="warning">Local demo · testnet preview</Badge>
      </div>

      <section className="hm-wallet-page__summary" aria-label="Wallet balance summary">
        <Stat label="Wallet balance" value={`${formatUsdc(DEMO_BALANCES.walletUsdcRaw)} USDC`} detail="Local demo value · wallet token balance" />
        <Stat label="Claimable in Vault" value={`${formatUsdc(DEMO_BALANCES.claimableUsdcRaw)} USDC`} detail="A separate withdrawal is required" />
        <Stat label="Network gas token" value={DEMO_BALANCES.walletMon} detail="Example balance · MON" />
      </section>

      <div className="hm-wallet-page__grid">
        <Card>
          <CardHeader>
            <CardTitle>USDC in connected wallet</CardTitle>
            <CardDescription>Tokens held by the wallet. Not the same as collateral already deposited in the Vault.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-wallet-balance"><Coins size={22} aria-hidden="true" /><span>{formatUsdc(DEMO_BALANCES.walletUsdcRaw)} USDC</span><Badge variant="info">Demo fixture</Badge></div>
            <p className="hm-muted">Funding is not available in this preview. No token transfer or deposit has been initiated.</p>
            <div className="hm-wallet-actions">
              <Button disabled aria-describedby="funding-unavailable"><ArrowDownToLine size={16} aria-hidden="true" /> Add funds</Button>
              <span id="funding-unavailable" className="hm-muted">Connect a configured Monad testnet funding flow to enable deposits.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vault breakdown</CardTitle>
            <CardDescription>Separate accounting buckets from local sample data. Locked collateral and claims are not wallet funds.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Reserved for open orders</dt><dd>{formatUsdc(DEMO_BALANCES.reservedOrderCollateralRaw)} USDC</dd></div>
              <div><dt>Position collateral locked</dt><dd>{formatUsdc(DEMO_BALANCES.lockedPositionRaw)} USDC</dd></div>
              <div><dt>Claimable from Vault</dt><dd>{formatUsdc(DEMO_BALANCES.claimableUsdcRaw)} USDC</dd></div>
              <div><dt>Fee escrow</dt><dd>{formatUsdc(DEMO_BALANCES.reservedFeeEscrowRaw)} USDC</dd></div>
            </dl>
            <div className="hm-wallet-withdraw">
              <Button variant="secondary" disabled aria-describedby="withdraw-unavailable"><ArrowUpFromLine size={16} aria-hidden="true" /> Withdraw claim</Button>
              <span id="withdraw-unavailable" className="hm-muted">Withdrawal is disabled in preview. Claimable funds have not been transferred to the wallet.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hm-wallet-page__network">
          <CardHeader><CardTitle>Network and wallet</CardTitle><CardDescription>Preview identity and connection details.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Network</dt><dd>Monad testnet preview</dd></div>
              <div><dt>USDC contract</dt><dd>Not configured</dd></div>
              <div><dt>Wallet address</dt><dd>Hidden in local demo</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> Demo balances are fixture data and are not read from Privy or chain.</p>
            <a className="hm-text-link" href="https://docs.monad.xyz/" target="_blank" rel="noreferrer">Monad network docs <ExternalLink size={14} aria-hidden="true" /></a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
