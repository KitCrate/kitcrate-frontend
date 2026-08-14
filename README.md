# KitCrate

A peer-to-peer marketplace for renting physical equipment: tools, cameras, construction
gear, and event equipment. Renters and owners agree on a rental period and a security
deposit, held in a non-custodial Soroban smart contract. This repository is the web
application. It covers listings, the booking flow, agreement tracking, and claim handling.

## Architecture

KitCrate is an npm workspaces monorepo with two packages.

- **`packages/sdk`** (`@kitcrate/sdk`) is the typed integration layer. It owns wallet
  connection, XDR encoding, the RentalEscrow contract client, and the indexer API client.
  Components never talk to the chain or the backend directly. They call the SDK.
- **`apps/web`** (`@kitcrate/web`) is the Next.js App Router application. Pages and
  components consume the SDK and render the interface.

### How data flows

Reads and writes take deliberately different paths.

- **Writes** (create, fund, start, claim, release, cancel) go through the connected
  wallet. The SDK builds the transaction, Freighter signs it, and the SDK submits it to
  Soroban RPC and polls for confirmation. Every write is gated behind an explicit
  confirmation step in the interface. No transaction is submitted without one.
- **Reads** go through the backend indexer API rather than direct contract calls. The
  indexer already maintains queryable agreement and listing state, so the app fetches from
  the REST endpoints (`GET /agreements`, `GET /agreements/:id`,
  `GET /agreements/:id/events`, and the listings routes) instead of reading contract
  storage. Direct RPC reads are a fallback only for state the indexer does not yet expose.

### SDK modules

| Module | Responsibility |
|---|---|
| `wallet.ts` | Freighter connection, account access, and transaction signing, built on `@stellar/freighter-api`. |
| `xdr.ts` | Argument encoding and decoding helpers. The single path for building contract-call arguments. |
| `contract.ts` | The typed RentalEscrow client: create, fund, start, raise claim, release, cancel, and transaction submission. |
| `indexerClient.ts` | The typed client for the backend REST API, covering agreements and listings. |

## Project structure

```
kitcrate-frontend/
├── packages/
│   └── sdk/                       # @kitcrate/sdk, the integration layer
│       └── src/
│           ├── wallet.ts          # Freighter wallet integration
│           ├── xdr.ts             # argument encoding/decoding helpers
│           ├── contract.ts        # typed RentalEscrow client
│           ├── indexerClient.ts   # typed backend REST client
│           └── index.ts           # package entry point
├── apps/
│   └── web/                       # @kitcrate/web, the Next.js app
│       ├── app/                   # App Router pages and layout
│       ├── components/            # CheckoutTag and everything built on it
│       └── styles/tokens.css      # design tokens as CSS custom properties
├── package.json                   # workspace root
└── README.md
```

## Requirements

- Node.js 20 or newer.
- npm 9 or newer, for workspaces support.
- The Freighter browser extension, for any action that signs a transaction.

## Setup

```bash
# 1. Install all workspace dependencies from the repo root.
npm install

# 2. Create a local environment file for the web app and fill in the values.
cp apps/web/.env.example apps/web/.env.local

# 3. Start the development server.
npm run dev
```

The app runs at `http://localhost:3001` (the web dev server is pinned to port 3001 so it
doesn't collide with the kitcrate-backend indexer, which serves its REST API on port 3000).

## Environment variables

All are read by the web app and must be prefixed with `NEXT_PUBLIC_`, since the client
uses them. Set them in `apps/web/.env.local`.

| Variable | Description | When it is set |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed RentalEscrow contract address. | After the contract is deployed. |
| `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | SEP-41 token contract address, for example a USDC SAC. | After the contract is deployed. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint. | At setup. Depends on the network. |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network passphrase. | At setup. Depends on the network. |
| `NEXT_PUBLIC_INDEXER_API_URL` | Base URL for the kitcrate-backend indexer API. | After the backend is deployed. |

Without the contract and network values, contract writes are disabled and the interface
tells the user the contract is not configured. Without the indexer URL, listing and
agreement reads return empty.

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app in development mode. |
| `npm run build` | Build the web app for production. |
| `npm run lint` | Lint the web workspace with ESLint. |
| `npm run typecheck` | Type-check every workspace with `tsc`. |

## Design

The interface is built around one signature component, the **checkout tag**: a card styled
like a physical toolshed work-order chit, with a punched-hole detail and a
serial-number-style ID in a monospace face. Every listing card, agreement, and status
indicator is a variation of that one tag rather than a separate design system per section.
The agreement lifecycle (Created, Funded, Active, Disputed, Resolved, Completed,
Cancelled) reads like a tag being stamped at each stage, not a generic progress bar. Design
tokens live in `apps/web/styles/tokens.css` and drive the Tailwind theme. Forms, tables,
and settings stay quiet and disciplined so the tag carries the visual weight.

## Tech stack

Next.js (App Router) and TypeScript throughout, with strict type-checking. Tailwind for
styling, themed from the design tokens rather than the default palette. Freighter for
wallet connection, through `@stellar/freighter-api`. Stellar Soroban for the on-chain
escrow.
