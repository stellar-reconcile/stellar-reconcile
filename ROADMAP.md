# Roadmap and contribution backlog

## v0.1 — implemented
Exact-decimal reconciliation; conservative route matching; CSV import/export; CLI; bounded Horizon ingestion; local dashboard; synthetic demo; tests and CI configuration.

## v0.2 — evidence and reliability
1. **Testnet demonstration:** publish a reproducible script and transaction references for exact, partial and unmatched payments. Must use test-only accounts.
2. **Address validation:** validate Stellar StrKey checksums and establish tested muxed-account routing policy.
3. **Reporting windows:** add explicit start/end dates, persist import provenance, and prevent partial-history reports from being presented as complete.
4. **Resumable ingestion:** persist cursors, retry rate limits with bounded backoff, and test repeated-page behavior.
5. **Statement imports:** define an adapter contract and add one real provider format with anonymized fixtures.
6. **Manual review:** allow a user to resolve ambiguous matches with an explicit audit trail; never silently guess.
7. **Browser verification:** verify CSV/JSON uploads, error states, exports and mobile layout in an actual browser.
8. **Pilot feedback:** recruit at least two potential users and record which workflow is useful.

## Wave application preparation
Publish repository, testnet evidence, contribution guide and genuinely useful issues. Explain current limitations and existing alternatives. Submit through maintainer onboarding only after a substantive working demonstration. Acceptance is at organizer discretion.
