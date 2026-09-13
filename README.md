# KitCrate

**Peer-to-peer equipment rental, secured by a non-custodial Soroban escrow.**

![Network: Testnet](https://img.shields.io/badge/network-testnet-3d5afe)
[![CI](https://github.com/KitCrate/kitcrate-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/KitCrate/kitcrate-frontend/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

## What this is

This repository is the web application and integration layer for KitCrate, a peer-to-peer marketplace for renting physical equipment: tools, cameras, construction gear, and event equipment. It's an npm workspaces monorepo with two packages: `apps/web`, the Next.js app renters and owners actually use, and `packages/sdk`, the typed client that talks to the `RentalEscrow` Soroban contract and the [kitcrate-backend](https://github.com/KitCrate/kitcrate-backend) indexer API on its behalf. Components never call the chain or the backend directly — they go through the SDK.

## Links

- **Live app:** [kitcrate-frontend-web.vercel.app](https://kitcrate-frontend-web.vercel.app)
- **Docs:** [kitcrate.github.io/kitcrate-backend](https://kitcrate.github.io/kitcrate-backend/)
- **Backend repo:** [github.com/KitCrate/kitcrate-backend](https://github.com/KitCrate/kitcrate-backend)

## Maintainer

GitHub: [@Hollujay](https://github.com/Hollujay)
Telegram: [@Hollujay21](https://t.me/Hollujay21)

## Architecture

Two packages, connected only through the SDK:

- **`packages/sdk`** (`@kitcrate/sdk`): wallet connection (Freighter), XDR encoding, a typed `RentalEscrowClient` for building and submitting contract calls, and a typed `IndexerClient` for the backend's REST API.
- **`apps/web`** (`@kitcrate/web`): the Next.js App Router app. Contract writes (create, fund, start, claim, release, cancel, plus the two permissionless liveness-recovery calls — see the backend's Protocol Mechanics doc) go through the connected wallet via the SDK; reads go through the backend indexer API rather than direct contract calls. Listing writes (create/edit/delete, no on-chain equivalent) go through the same wallet, signing a SEP-53 challenge the indexer verifies before accepting them (`IndexerClient.createListing`/`updateListing`/`deleteListing` now take a signer alongside the data).

For the full SDK API (every `RentalEscrowClient` and `IndexerClient` method, a worked build-sign-submit example) see the [Developer Guide](https://kitcrate.github.io/kitcrate-backend/developer-guide.html) on the docs site, rather than duplicating it here.

## Quick start

Prerequisites: Node.js >= 20, npm >= 9 (for workspaces), the [Freighter](https://www.freighter.app/) browser extension for anything that signs a transaction.

```sh
npm install                                  # installs every workspace
cp apps/web/.env.example apps/web/.env.local # then fill in the values
npm run dev
```

The app runs at `http://localhost:3001` (pinned off 3000 so it doesn't collide with the kitcrate-backend indexer's default port).

Real variables from `apps/web/.env.example`: `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_TOKEN_CONTRACT_ID`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_NETWORK_PASSPHRASE`, `NEXT_PUBLIC_INDEXER_API_URL`.

**Type-check:**

```sh
npm run typecheck
```

Tested against this repo: passes cleanly across both workspaces.

**Run the SDK tests:**

```sh
npm test --workspace=@kitcrate/sdk
```

**Production build:**

```sh
npm run build
```

No environment variables are required for the build to succeed; the app
degrades gracefully to its unconfigured state (contract writes disabled,
listing/agreement reads empty) rather than failing the build.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md): this project isn't currently accepting outside contributions.

## Known limitations

- **Node version.** Root `package.json` states `"node": ">=20"`, but `@stellar/stellar-sdk@16.2.0` (a direct SDK dependency) requires Node >=22 and warns on install otherwise. `npm install` still succeeds on Node 20, but Node 22+ is the version this repo actually needs.
- **Multisig accounts need enough signature weight.** A Soroban invocation from an account requires total signer weight meeting that account's medium threshold. A single Freighter-connected key on a multisig account can fall short of it, in which case the network rejects an otherwise correctly built and signed transaction with `txBadAuth`. The SDK detects this ahead of signing (`getAccountSignatureRequirement`) and the UI surfaces a clear message instead, on every write flow that builds a transaction from the connected wallet's own address.
- **Vercel hosting.** Unlike the backend's Render free tier, Vercel's free (Hobby) tier doesn't sleep the app between requests, so there's no equivalent cold-start delay to document here.
- **`apps/web` has no automated tests.** SDK logic (`packages/sdk`) has real unit test coverage; the Next.js app itself has none — no component tests, no end-to-end tests. Typecheck, lint, and a full production build all run in CI, which catches a real class of breakage, but not a behavioral regression in a component. Not yet addressed.

## License

[MIT](./LICENSE).
