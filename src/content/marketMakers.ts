/**
 * Release-dependent MM wording lives here. Review against the verified deployment
 * whenever capabilities ship; configuring an RPC or sign-in does not enable them.
 * See docs/market-maker-onboarding-copy.md, “Release copy maintenance”.
 */
export const marketMakerRelease = {
  reviewedMain: '152b3e1',
  environment: 'Monad testnet · valueless test tokens',
  status: 'Now inviting integration interest. Canonical reads, unsigned builders, and inventory reconciliation are available for the valueless-token testnet deployment.',
  trading: 'Today’s environment uses test tokens. Real-money trading is not available in the current frontend.',
  marketData: 'The market page and integration console read canonical Monad snapshots when configured. The console also prepares reviewable unsigned calldata and reconciles isolated inventory; it never signs or submits. Visible depth is not a guaranteed fill.',
  recruitment: 'We’re inviting market makers, FX desks, and specialist liquidity providers to discuss integration and testnet participation.',
  home: {
    body: 'Quote the other side of future dollar purchases and sales. We’re inviting market makers and FX desks to explore testnet integration and help shape planned position takeovers and replacement capacity.',
    note: 'Testnet today. Takeovers and replacement services are planned.',
  },
  placements: {
    market: 'Provide USD/NGN liquidity. Explore market making and the planned position-takeover flow.',
    learn: 'Market makers can help bridge differences in timing, size, and direction. Explore quoting and the planned takeover model.',
    empty: 'Interested in supplying liquidity? Explore market making.',
    risks: 'Planning to quote or take over exposure? Review market-maker capital, basis, and settlement risks.',
  },
  opportunities: [
    {
      id: 'quoting', number: '01', label: 'Contract evaluation', title: 'Quote new hedges',
      body: 'Set funded buyer or seller quotes for the sizes and maturities that fit your book. Trading results depend on your pricing, costs, and collateral outcomes.',
    },
    {
      id: 'takeovers', number: '02', label: 'Planned', title: 'Price position takeovers',
      body: 'Planned: quote the terms on which you would take over a participant’s remaining leg while preserving the original hedge terms.',
    },
    {
      id: 'capacity', number: '03', label: 'Planned · funding required', title: 'Discuss replacement capacity',
      body: 'Planned: help carry remaining exposure after default under a separately funded program with agreed compensation and limits.',
    },
  ],
  takeovers: {
    label: 'Planned capability',
    paragraphs: [
      'HedgeMaker’s transfer proposal would let a participant request an exit and a willing replacement price the remaining leg. For market makers, that creates another opportunity: quote the terms on which you would absorb existing exposure.',
      'A takeover would preserve the original notional, agreed rate, maturity, and settled history. It would carry the remaining obligations forward while keeping the other participant’s economics intact. Compensation would depend on the accepted transfer terms and the risk you take on.',
      'We’re looking for desks that want to help shape this flow, including the information they need to price a leg, the collateral they require, and the integration tools they would use.',
    ],
  },
  backstop: {
    label: 'Planned capability · subject to funding and agreed limits',
    paragraphs: [
      'Counterparty default can leave both unpaid amounts and future exposure to address. HedgeMaker’s continuity proposal separates those needs: a reserve for eligible shortfalls, and funded replacement or backstop capacity for the remaining leg.',
      'Firms able to commit capacity can discuss a future role in that program. Standby obligations, activation pricing, compensation, and coverage limits would need to be agreed before participation. A funded commitment is required to support continuity; ordinary matching alone cannot guarantee it.',
    ],
  },
  earnings: 'Quoted rates can contribute to trading P&L. Planned takeovers and committed capacity could add separately agreed compensation. No profit, rebate, or yield is guaranteed.',
  riskStatus: 'The current deployment is on Monad testnet using tokens with no real-world value. Transfers, replacement auctions, and funded backstop services are planned features. Participation today is about evaluating the instrument and helping build the integration, not earning real-money returns.',
  faq: [
    ['Can I earn real money today?', 'No. The documented deployment uses valueless test tokens, and the current frontend disables protocol writes. Future real-value trading and program compensation require their own verified deployment and published terms.'],
    ['Can I absorb someone’s existing position?', 'That is the planned full-leg transfer role. Current contracts do not support it. The proposal preserves original economics and settled state when a replacement accepts.'],
    ['Do I take over unpaid debt automatically?', 'No such takeover exists today. The planned process separates eligible past shortfall coverage from future exposure and requires explicit acceptance of replacement terms. The final policy must state any additional obligations.'],
    ['Do settlement or liquidation calls pay rewards?', 'Current testnet rewards are zero. Treasury trading fees are not automatically distributed to market makers or keepers.'],
  ],
};

export const marketMakerCopy = {
  heading: 'Make a market for the next dollar–naira hedge.',
  lead: 'Bring your pricing expertise to HedgeMaker. Help users find the other side of their USD/NGN exposure, and help shape the market’s next stage.',
  introduction: 'HedgeMaker is building a collateral-backed USD/NGN forward market on Monad. It is designed for people and businesses planning future dollar purchases or sales. Market makers can help bridge differences in when those users arrive, how much they need, and which side they take.',
  apply: 'Apply to be a market maker',
  guide: 'Explore the market-maker guide',
  homeHeading: 'Are you a market maker? Help shape USD/NGN liquidity.',
  homeLink: 'Explore market making',
  integration: 'Share your quoting scope, inventory limits, collateral requirements, and preferred integration workflow. Help us shape the market data and tools you would need to participate.',
  application: 'Tell us about your desk and the role you want to explore. This application registers interest; it does not open a trading account or commit capital.',
};
