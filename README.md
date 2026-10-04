# HedgeMaker

HedgeMaker is a testnet-first frontend prototype for collateral-limited USD/NGN forward protection on Monad. This repository keeps the product specification, the frontend flow and schemas, and the first implementation slice together so that the interface can evolve against one source of truth.

## What is implemented

- Public landing, education, risk, and market-discovery screens
- An interactive USD-buyer / USD-seller order preview with fixed-point `bigint` calculations
- Pegged and fixed-limit order concepts, listed maturities, reserves, and payoff scenarios
- A local, clearly labelled demo sign-in path and an authenticated account area
- Four-balance wallet model: wallet, order reserves, locked position collateral, and claimable USDC
- Dashboard, wallet, positions, and position-detail screens using simulated fixtures
- Privy authentication and embedded-wallet integration, enabled only when verified environment values are present
- Protocol writes intentionally disabled until verified contract deployments and addresses exist

The authoritative product documents are in [`docs/`](./docs). The current build follows the v3 build spec and the v0.3 frontend flow.

## Run locally

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Without environment configuration the app starts in local preview mode. No real wallet is created, no transaction is submitted, and every market/account value is explicitly simulated.

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

That command runs the spec arithmetic harness, domain tests, ESLint, TypeScript, and the production Vite build. The domain layer uses six-decimal integer units and avoids JavaScript floating-point arithmetic for contractual values.

## Project structure

```text
docs/                       product specification, flow, schemas, and audits
scripts/                    executable spec-math verification
src/app/                    routes, shell, authentication boundary
src/components/ui/          accessible UI primitives
src/demo/                   visibly simulated fixtures
src/domain/                 exact arithmetic, margin, fees, units, and types
src/integrations/privy/     environment-gated Privy integration
src/pages/                  public and authenticated product screens
src/styles/                 design tokens and responsive application styles
```

## Safety boundary

The current slice is for UX validation. It does not synthesize fills, fake transaction success, or expose enabled deposit/order/claim actions. Contract writes should be added only after chain IDs, RPC/explorer URLs, token metadata, protocol addresses, ABIs, and deployment provenance are verified and versioned.
