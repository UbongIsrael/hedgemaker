# HedgeMaker

HedgeMaker is a testnet-first frontend prototype for collateral-limited USD/NGN forward protection on Monad. This repository keeps the product specification, the frontend flow and schemas, and the first implementation slice together so that the interface can evolve against one source of truth.

## What is implemented

- Public landing, education, risk, and market-discovery screens
- Market-maker recruitment page, nine-section guide, and application email handoff
- Market-maker integration console with unsigned builders and isolated inventory reconciliation
- Configured live Monad order-book snapshots and exact order preparation
- An interactive USD-buyer / USD-seller order preview with fixed-point `bigint` calculations
- Pegged and fixed-limit order concepts, listed maturities, reserves, and payoff scenarios
- Privy sign-in with the connected embedded or linked wallet as the account identity
- Four-balance wallet model: wallet, order reserves, locked position collateral, and claimable USDC
- Dashboard, wallet, positions, and position-detail screens using canonical contract reads
- Privy authentication and embedded-wallet integration, enabled only when verified environment values are present
- Wallet-signed mUSDC faucet, approval, order, cancellation, margin, settlement, and withdrawal actions

The authoritative product documents are in [`docs/`](./docs). The current build follows the v3 build spec and the v0.3 frontend flow. The implemented contract suite and deployment sequence are documented in [`docs/contracts.md`](./docs/contracts.md), with the design rationale in [`docs/contract-architecture-research.md`](./docs/contract-architecture-research.md).

The quorum oracle and full live rehearsal sequence are documented in [`docs/testnet-v2-runbook.md`](./docs/testnet-v2-runbook.md), with live deployment receipts in [`docs/testnet-v2-deployment-log.md`](./docs/testnet-v2-deployment-log.md). V2 uses a fresh protocol deployment because the vault/controller and protocol/oracle links are intentionally immutable.

Market-maker copy and the release update checklist are in [`docs/market-maker-onboarding-copy.md`](./docs/market-maker-onboarding-copy.md). Shared availability wording lives in `src/content/marketMakers.ts`; update it alongside verified feature releases. Applications open an email to the verified contact address. `VITE_MARKET_MAKER_CONTACT_EMAIL` can override that address, or set `VITE_MARKET_MAKER_APPLICATION_URL` to a real HTTPS application service. The frontend does not store submissions or claim an email has been sent.

The Phase A market-maker integration boundary is documented in [`docs/market-maker-integration-pack.md`](./docs/market-maker-integration-pack.md). `/market-makers/integration` provides canonical testnet snapshots, exact unsigned order preparation, and address-scoped inventory reconciliation. It does not sign, submit, transfer positions, or promise backstop capacity.

## Run locally

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Without environment configuration the public education pages remain available, but account routes and protocol actions require a real Privy wallet and a complete verified chain configuration. The application does not substitute fixture balances for missing chain data.

## Enable Privy sign-in

Copy `.env.example` to `.env.local` and supply the verified values from the Privy dashboard and the selected Monad testnet deployment:

```bash
VITE_PRIVY_APP_ID=
VITE_PRIVY_CLIENT_ID=
VITE_MONAD_CHAIN_ID=
VITE_MONAD_CHAIN_NAME=Monad Testnet
VITE_MONAD_RPC_URL=
VITE_MONAD_EXPLORER_URL=
```

Privy is activated only when the app ID and complete chain configuration are present. Never place private keys in a Vite environment file; `VITE_*` values are shipped to the browser.

## Verification

```bash
npm run check
```

That command runs the spec arithmetic harness, frontend/domain tests, contract type-checking and integration tests, ESLint, TypeScript, and the production Vite build. The domain and contract layers use six-decimal integer units and avoid JavaScript floating-point arithmetic for contractual values.

## Project structure

```text
docs/                       product specification, flow, schemas, and audits
contracts/                  Solidity protocol, interfaces, math, and test harness
ignition/                   deterministic Hardhat deployment module
scripts/                    executable spec-math verification
test/                       contract integration tests
src/app/                    routes, shell, authentication boundary
src/components/ui/          accessible UI primitives
src/domain/                 exact arithmetic, margin, fees, units, and types
src/integrations/privy/     environment-gated Privy integration
src/pages/                  public and authenticated product screens
src/styles/                 design tokens and responsive application styles
```

## Safety boundary

The application does not synthesize fills or fake transaction success. Every account balance and protocol state is read from the configured deployment, and each write requires the connected wallet's signature. The deployed contracts and mUSDC are testnet-only; their balances have no monetary value. A wallet also needs testnet MON to pay transaction fees.
