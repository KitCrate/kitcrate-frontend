# Security Policy

## Supported versions

This project is under active development on Stellar Testnet only, with
no versioned releases yet (see the repository's release status). The
only supported line is the current `main` branch.

## Current audit status

This project has had one internal security review, focused primarily
on the [kitcrate-backend](https://github.com/KitCrate/kitcrate-backend)
contract and indexer this app depends on. Public write-ups of the
hardening and rollout work that followed it live in that repo's `docs/`
folder (`final-readiness-audit.md`, `phase3-step1-contract-promotion-
audit.md`, `phase3-step2-production-indexer-rollout.md`). There has
been no independent third-party audit. Do not treat this project as
production-hardened for funds beyond Stellar Testnet.

A known, publicly disclosed gap: the backend contract and indexer this
app talks to by default currently predate the backend repo's `main`
branch. See [kitcrate-backend's Testnet status section](https://github.com/KitCrate/kitcrate-backend#testnet-status)
for the current, accurate state of that gap.

## Reporting a vulnerability

Please report security issues privately rather than opening a public
GitHub issue — this applies to issues in this app, the `@kitcrate/sdk`
package, or its wallet-integration flows:

- Telegram: [@Hollujay21](https://t.me/Hollujay21)
- GitHub: [@Hollujay](https://github.com/Hollujay) (direct message, not
  a public issue or PR)

Include: which package (`apps/web` or `packages/sdk`), the specific
route/component/function affected, a description of the issue and its
impact, and reproduction steps if you have them.

## What not to include in public issues

Please don't post any of the following in a public GitHub issue or PR:

- Details of an unpatched vulnerability before the maintainer has had a
  chance to address it
- Private keys, seed phrases, or wallet credentials — even Testnet ones
  tied to accounts you use elsewhere
- Exploit payloads targeting the live deployed app, contract, or
  indexer

Non-security bug reports (crashes, incorrect behavior, documentation
errors) are welcome as normal public issues.
