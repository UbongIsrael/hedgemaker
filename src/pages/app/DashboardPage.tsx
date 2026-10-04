import {ArrowDownToLine, ArrowUpRight, CircleHelp, Clock3, WalletCards} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar, Stat} from '@/components/ui';
import {DEMO_ACTIVITY, DEMO_BALANCES, DEMO_BOOK, DEMO_MARKET, DEMO_ORDER, DEMO_POSITIONS} from '@/demo/fixtures';
import {formatFixed, formatUsdc} from '@/domain';

export function DashboardPage() {
  const position = DEMO_POSITIONS[0]!;
  const previousChange = formatFixed(DEMO_MARKET.referenceRateRaw - DEMO_MARKET.previousRateRaw, 2, 6);

  return (
    <div className="hm-page hm-dashboard" aria-labelledby="dashboard-title">
      <div className="hm-page__heading">
        <div>
          <p className="hm-eyebrow">ACCOUNT OVERVIEW</p>
          <h1 id="dashboard-title">Dashboard</h1>
          <p className="hm-page__description">Your USD / NGN positions, collateral, and market activity.</p>
        </div>
        <Badge variant="warning">Local demo · testnet preview</Badge>
      </div>

      <section className="hm-dashboard__stats" aria-label="Account summary">
        <Stat label="Wallet USDC" value={`${formatUsdc(DEMO_BALANCES.walletUsdcRaw)} USDC`} detail="In connected wallet" />
        <Stat label="Locked in positions" value={`${formatUsdc(DEMO_BALANCES.lockedPositionRaw)} USDC`} detail="Not available to withdraw" />
        <Stat label="Claimable" value={`${formatUsdc(DEMO_BALANCES.claimableUsdcRaw)} USDC`} detail="Withdraw from the Vault" trend="up" />
        <Stat label="Open positions" value={String(DEMO_POSITIONS.length)} detail="USD / NGN · isolated margin" />
      </section>

      <section className="hm-dashboard__main-grid" aria-label="Market and account details">
        <Card className="hm-market-card">
          <CardHeader>
            <div className="hm-card__title-row">
              <div><p className="hm-eyebrow">REFERENCE MARKET</p><CardTitle>USD / NGN</CardTitle></div>
              <Badge variant="info">Simulated fixing</Badge>
            </div>
            <CardDescription>Displayed rate is demo data and is not an executable quote.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-market-card__rate">
              <span className="hm-market-card__number">₦{formatFixed(DEMO_MARKET.referenceRateRaw, 2, 6)}</span>
              <span className="hm-market-card__change">+₦{previousChange} from prior round</span>
            </div>
            <dl className="hm-definition-list">
              <div><dt>Round</dt><dd>#{DEMO_MARKET.roundId.toString()}</dd></div>
              <div><dt>Source status</dt><dd>{DEMO_MARKET.sourceStatus} · simulated</dd></div>
              <div><dt>Observed</dt><dd>{DEMO_MARKET.observedAt}</dd></div>
            </dl>
            <div className="hm-market-card__book">
              <h3>Sample order book</h3>
              <p className="hm-muted">Local fixture · counterparties are not live</p>
              <div className="hm-book-grid">
                <div>
                  <h4>USD buyers</h4>
                  <ul className="hm-book-list">{DEMO_BOOK.buyers.slice(0, 2).map((level) => <li key={level.strike}><span>₦{level.strike}</span><span>{level.notional}</span></li>)}</ul>
                </div>
                <div>
                  <h4>USD sellers</h4>
                  <ul className="hm-book-list">{DEMO_BOOK.sellers.slice(0, 2).map((level) => <li key={level.strike}><span>₦{level.strike}</span><span>{level.notional}</span></li>)}</ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">COLLATERAL</p>
            <CardTitle>Position health</CardTitle>
            <CardDescription>Margin belongs to each isolated position.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-position-summary">
              <div><span className="hm-position-summary__id">{position.id}</span><Badge variant="success">{position.status}</Badge></div>
              <p>{position.side} · {position.notional} notional</p>
              <MarginBar used={78} total={100} label="Margin health" tone="warning" formatAmount={(value) => `${value}%`} />
              <p className="hm-muted">Demo health indicator. Contract health and cure amounts require live position data.</p>
              <Link className="hm-text-link" to={`/app/positions/${position.id}`}>View position <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">OPEN ORDER</p>
            <CardTitle>{DEMO_ORDER.id}</CardTitle>
            <CardDescription>{DEMO_ORDER.intent} · {DEMO_ORDER.pricing}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-order-summary">
              <Badge variant="warning">{DEMO_ORDER.status} · demo</Badge>
              <dl className="hm-definition-list">
                <div><dt>Filled</dt><dd>{DEMO_ORDER.filled} of {DEMO_ORDER.notional}</dd></div>
                <div><dt>Remaining</dt><dd>{DEMO_ORDER.remaining}</dd></div>
                <div><dt>Indicative strike</dt><dd>{DEMO_ORDER.effectiveStrike}</dd></div>
                <div><dt>Demo expiry</dt><dd>{DEMO_ORDER.expiry}</dd></div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">RECENT ACTIVITY</p>
            <CardTitle>Account activity</CardTitle>
            <CardDescription>Example events from the local preview fixture.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="hm-activity-list">{DEMO_ACTIVITY.slice(0, 4).map((activity, index) => (
              <li key={`${activity.kind}-${activity.time}`}>
                <span className="hm-activity-list__icon" aria-hidden="true">{index === 3 ? <ArrowDownToLine size={16} /> : <Clock3 size={16} />}</span>
                <div><p>{activity.kind}</p><span>{activity.detail}</span></div>
                <time>{activity.time}</time>
              </li>
            ))}</ol>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> No activity shown here is a confirmed chain event.</p>
          </CardContent>
        </Card>
      </section>

      <aside className="hm-dashboard__wallet-link">
        <WalletCards size={20} aria-hidden="true" />
        <p>Wallet funding and Vault collateral are separate balances.</p>
        <Link className="hm-button hm-button--secondary hm-button--sm" to="/app/wallet">View wallet</Link>
      </aside>
    </div>
  );
}
