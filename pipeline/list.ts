#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { config, getManifestPath, getCurrentRunPath } from './config';
import type { RunManifest } from './types';

function main() {
  if (!fs.existsSync(config.runsDir)) {
    console.log('No runs found. Run `npm run pipeline:extract` to create one.');
    return;
  }

  const runs = fs.readdirSync(config.runsDir)
    .filter(f => fs.statSync(path.join(config.runsDir, f)).isDirectory())
    .sort()
    .reverse();

  if (runs.length === 0) {
    console.log('No runs found. Run `npm run pipeline:extract` to create one.');
    return;
  }

  // Get current run
  let currentRun: string | null = null;
  const currentRunPath = getCurrentRunPath();
  if (fs.existsSync(currentRunPath)) {
    currentRun = fs.readFileSync(currentRunPath, 'utf-8').trim();
  }

  console.log('Available runs:\n');
  console.log('  RUN ID                  VIDEOS  RECIPES  TRANSCRIPTS  UPSERTED  CURRENT');
  console.log('  ' + '-'.repeat(78));

  for (const runId of runs) {
    const manifestPath = getManifestPath(runId);

    try {
      if (!fs.existsSync(manifestPath)) {
        console.log(`  ${runId}  (no manifest)`);
        continue;
      }

      const manifest: RunManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const isCurrent = runId === currentRun;
      const upsertStatus = manifest.upserted_to_supabase ? 'Yes' : 'No';

      console.log(
        `  ${runId.padEnd(22)}  ${String(manifest.videos_processed).padStart(6)}  ` +
        `${String(manifest.videos_with_recipes).padStart(7)}  ` +
        `${String(manifest.videos_with_transcripts).padStart(11)}  ` +
        `${upsertStatus.padStart(8)}  ` +
        `${isCurrent ? '  *' : ''}`
      );
    } catch (error) {
      console.log(`  ${runId}  (error reading manifest)`);
    }
  }

  console.log();
  if (currentRun) {
    console.log(`Current run: ${currentRun}`);
  }
}

main();
