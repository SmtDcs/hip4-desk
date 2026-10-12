# Contributing

## Safety

- Never commit private keys or mainnet secrets.
- Mainnet order submission is blocked (`assertSafeExecution`).
- Keep `.env` gitignored; use `.env.example`.
- Test in dry-run or Hyperliquid testnet only.

## Before a PR

```bash
npm install
npm test
npm run build
npm run demo
```

## Guidelines

- Strict TypeScript / ESM; prefer `node:assert` for tests.
- Keep dependencies light; no heavy frontend frameworks.
- Do not add Outcome.xyz BUSL-licensed code. Stay MIT-compatible.

By contributing you agree contributions are MIT-licensed ([LICENSE](./LICENSE)).
