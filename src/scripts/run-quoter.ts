/**
 * Run Quoter CLI Entry Point
 * Executes the HIP-4 Desk Quoting Loop.
 * Supports --dry-run, --single-tick, and venue/outcome filters.
 */

import { loadConfig } from '../config.js';
import { QuotingLoopRunner } from '../engine/runner.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--live');
  const isSingleTick = args.includes('--single-tick') || args.includes('--once');

  let env: 'testnet' | 'mainnet' = 'testnet';
  const envArg = args.find((a) => a.startsWith('--env='));
  if (envArg) {
    const val = envArg.split('=')[1].toLowerCase();
    if (val === 'mainnet') env = 'mainnet';
  }

  let targetVenue: string | undefined = undefined;
  const venueArg = args.find((a) => a.startsWith('--venue='));
  if (venueArg) {
    targetVenue = venueArg.split('=')[1];
  }

  let targetOutcomeId: number | undefined = undefined;
  const outcomeArg = args.find((a) => a.startsWith('--outcome='));
  if (outcomeArg) {
    targetOutcomeId = parseInt(outcomeArg.split('=')[1], 10);
  }

  let limit: number | undefined = undefined;
  const limitArg = args.find((a) => a.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10);
  }

  return { isDryRun, isSingleTick, env, targetVenue, targetOutcomeId, limit };
}

async function main() {
  const { isDryRun, isSingleTick, env, targetVenue, targetOutcomeId, limit } = parseArgs();

  // If running against mainnet, FORCE dry-run mode
  const effectiveDryRun = env === 'mainnet' ? true : isDryRun;

  const config = loadConfig({
    network: env,
    targetVenue,
    targetOutcomeId,
  });

  if (env === 'mainnet') {
    console.log(`\n🛡️ [SECURITY NOTICE] Mainnet selected: STRICT READ-ONLY / DRY-RUN MODE ENFORCED.`);
  }

  const runner = new QuotingLoopRunner(config);

  // Handle graceful shutdown via Ctrl+C
  process.on('SIGINT', () => {
    console.log(`\n[HIP-4 Desk] Interrupted. Stopping quoter...`);
    runner.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    runner.stop();
    process.exit(0);
  });

  await runner.start({
    dryRun: effectiveDryRun,
    singleIteration: isSingleTick,
    limit,
  });
}

main().catch((err) => {
  console.error(`Fatal error in quoter runner:`, err);
  process.exit(1);
});
