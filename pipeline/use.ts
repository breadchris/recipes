#!/usr/bin/env npx tsx

import fs from 'fs';
import { config, getRunDir, getCurrentRunPath } from './config';

function main() {
  const args = process.argv.slice(2);

  // Parse --run argument
  let runId: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run' && args[i + 1]) {
      runId = args[i + 1];
      break;
    }
    if (args[i].startsWith('--run=')) {
      runId = args[i].slice(6);
      break;
    }
  }

  if (!runId) {
    console.error('Usage: npm run pipeline:use -- --run=<run-id>');
    console.error('Example: npm run pipeline:use -- --run=2024-01-15T10-30-00');
    process.exit(1);
  }

  const runDir = getRunDir(runId);

  if (!fs.existsSync(runDir)) {
    console.error(`Error: Run not found: ${runId}`);
    console.error(`Expected directory: ${runDir}`);
    console.error('\nRun `npm run pipeline:list` to see available runs.');
    process.exit(1);
  }

  // Update current.txt
  fs.mkdirSync(config.pipelineDir, { recursive: true });
  fs.writeFileSync(getCurrentRunPath(), runId);

  console.log(`Current run set to: ${runId}`);
}

main();
