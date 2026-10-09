# Contributing to HIP-4 Desk

Thank you for your interest in contributing to **HIP-4 Desk**! We welcome community contributions, bug reports, and suggestions.

---

## 🛡️ Critical Safety Guidelines: No Mainnet Keys

1. **NEVER commit private keys, mainnet secrets, or sensitive credentials.**
2. Real order submission is **strictly forbidden and blocked on mainnet** via `assertSafeExecution`.
3. Keep `.env` git-ignored. The repository provides `.env.example` with empty private key fields for safe reference.
4. All local testing and interactive demos must run in dry-run or against **Hyperliquid Testnet**.

---

## 🧪 Development & Testing

Before submitting a Pull Request, ensure all tests pass and the build succeeds:

```bash
# 1. Install dependencies
npm install

# 2. Run all unit test suites (8 suites)
npm test

# 3. Compile TypeScript
npm run build

# 4. Verify end-to-end demo flow
npm run demo
```

---

## 🔀 Pull Request Process

1. **Fork the repository** and create your branch from `main` or `master`.
2. **Follow existing coding conventions:**
   - Strict TypeScript types (`noImplicitAny`, ESM modules).
   - Use Node.js built-in `node:assert` for unit tests (no heavy external test frameworks).
   - Keep dependencies minimal. Avoid introducing heavy packages or front-end frameworks.
3. **Preserve Open-Source Integrity:**
   - **Do NOT introduce Outcome.xyz BUSL-1.1 licensed code or SDKs.**
   - All code must remain compatible with the MIT license.
4. **Submit a descriptive PR:**
   - Explain the purpose of your change and link related issues.
   - Confirm that `npm test`, `npm run build`, and `npm run demo` pass.

---

## 📜 License

By contributing to HIP-4 Desk, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
