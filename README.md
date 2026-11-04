# Stellar Reconcile
A read-only reconciliation engine, CLI and local dashboard for classic Stellar payments.
Version 0.1.0 — local prototype, not yet submitted to Drips Wave.

## Quick start
Requires Node.js 22 or later. No dependencies or install step.
Run these commands from this repository:
```sh
node src/cli.js demo
node --test
node server.js
```
Open http://127.0.0.1:4173 and choose **Load synthetic demo**.

## Real data
```sh
node src/cli.js fetch G_ADDRESS testnet payments.json
node src/cli.js reconcile examples/expected.csv payments.json report.csv
```
Replace G_ADDRESS with the account you want to inspect. Public network reads require the explicit "public" argument in place of "testnet". Fetching sends the public account address to the selected Horizon service. No secret keys, wallet signing or transfers are required.

## Expected CSV
Columns: id,destination,asset,amount,memoType,memo.
Amounts must be positive decimal strings with at most seven fractional digits.
Asset is XLM or CODE:ISSUER, never the code alone. Memo types: none, text, id, hash, return. Hash memos use base64.
Each expected ID must be unique. Use distinct destination/asset/memo-type/memo combinations to identify separate invoices.

## Received JSON
Supply an array of normalized objects:
```json
[{"id":"operation-id","destination":"G_ADDRESS","asset":"XLM","amount":"10.0000000","memoType":"text","memo":"INV-1","successful":true}]
```
The fetch command produces an envelope containing payments, network, account, complete and nextCursor. A truncated envelope is rejected by the CLI and dashboard. Manually supplied arrays are treated as the complete dataset for the scope you selected; they are not proof of chain history.

## Matching rules
- Exact destination, asset including issuer, memo type and memo.
- Integer arithmetic with seven decimal places; no floating-point money.
- Distinct operation IDs are summed, including operations in one transaction.
- Repeated delivery of an identical operation is ignored; conflicting IDs fail.
- Expected records sharing a route are ambiguous and not credited automatically.
- Failed and unmatched payments appear as exceptions.
- States: unpaid, partial, paid, overpaid, ambiguous.
- CSV formula prefixes are escaped when exporting reports.

## Scope and limitations
Classic payment and path-payment operations only. Soroban/SAC transfers, claimable balances and account-creation funding are excluded. A native-XLM testnet demonstration is recorded below. Browser verification remains pending; automated tests also cover mocked Horizon behavior. Network pagination defaults to at most 2,000 operations and a request timeout of 15 seconds. Use exported cursors only with an explicitly defined reporting scope; do not treat a partial-history reconciliation as full-account accounting.
Address format is checked for live fetches; StrKey checksums are not yet validated. Muxed destinations are preserved as M-addresses to prevent accidental matching to a bare G-address, but full muxed routing policy is future work.
No persistence, date-window UI, authentication or deployed public service. Files are processed in-browser; page reload clears them. Adapter timeouts and rate-limit errors stop ingestion rather than silently producing success.

## Structure
- src/core.js: portable matching and CSV functions
- src/horizon.js: classic-payment ingestion
- src/cli.js: local commands
- web/: local dashboard
- test/: money, matching, parser and mocked Horizon tests

## Next milestones
See ROADMAP.md. Read CONTRIBUTING.md before opening a pull request.
License: MIT.

## Reproduce a live testnet demonstration

**Status: verified.** Public evidence is recorded in the generated section below.

These tools run locally; they do not deploy smart contracts and have no contract IDs.
A testnet run creates a fresh sender and three recipients, funds the sender through
Friendbot, submits native XLM payments, reads them back from Horizon, confirms each
transaction, and checks exact, partial, and unpaid outcomes.

Requirements: Node.js 22+ and Stellar CLI 27+.
Run:

```sh
node scripts/testnet-run.js
```

Only after all checks succeed, the runner writes public transaction hashes, account
addresses, ledger numbers, results, and timestamps to docs/testnet/latest.json and
adds a verified section to this README. Test-only private keys are temporary and
never included in evidence. Testnet history is periodically reset.

The live run covers native XLM. Additional issued-asset and failure scenarios remain
offline fixtures until separately demonstrated. Payment Lab's live run exercises
its reference adapter, not an external application's payment handler.

Testnet HTTPS requests try native Node fetch, then system curl over IPv4 on transport failure. Curl must be installed for fallback; certificate verification remains enabled. Failures report the hostname and underlying transport error codes.

<!-- TESTNET-VERIFICATION:START -->
## Verified Stellar Testnet run

Verified at: 2026-11-04T20:10:57.932Z

Live testnet integration demonstration of Stellar Reconcile. This project deploys no smart contract and has no contract ID. It runs locally against Testnet, rather than as a hosted service.

- Horizon: https://horizon-testnet.stellar.org
- Network passphrase: Test SDF Network ; September 2015
- Public sender: GAIRF4VT22FWINJT7VSVAUN6G7SSL4UYA7OBMPAECUNGXKHLDGX5WXZ7
- Exact-payment recipient: GCQRWS7N7JABHON463YK3MTMXIJ6Z6JA5HAFPU2DQF3JVHU5GG3BN5GW
- Partial-payment recipient: GDBFETEBSLOS6K4QEG4TWQY35RT6FVTWSKVUP45EUAPLO23FRB4OWGVC
- Unpaid recipient: GBJWMLKSLXC43ZJB6RTGCK53V7DXMIO2VTHW66JC5AD5TJGJSPDSFEGU

Confirmed testnet payment transactions:
- [077d47fb6951e41c644e1c3bb83d63371df0be25ca8957d6c4d27b3b2f44174c](https://stellar.expert/explorer/testnet/tx/077d47fb6951e41c644e1c3bb83d63371df0be25ca8957d6c4d27b3b2f44174c) — ledger 5559875
- [52fddb1ce64aa880bd6b87478fbdfc255157ad17104acfa72dc792ec9a2ca2c2](https://stellar.expert/explorer/testnet/tx/52fddb1ce64aa880bd6b87478fbdfc255157ad17104acfa72dc792ec9a2ca2c2) — ledger 5559877

Observed results: testnet-exact: paid; testnet-partial: partial; testnet-unpaid: unpaid.

Evidence: [latest.json](docs/testnet/latest.json). Rerun with node scripts/testnet-run.js (Node.js 22+ and Stellar CLI 27+). Fresh test-only identities are temporary and excluded from evidence. Funding uses free Friendbot XLM.

This verifies native XLM exact/partial/unpaid handling. It does not establish live issued-asset, path-payment, muxed-address, Soroban-transfer, failure or concurrency coverage. Offline tests cover additional cases. Testnet resets can remove accounts and history.
<!-- TESTNET-VERIFICATION:END -->
