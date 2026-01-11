import path from 'path';
import type { PipelineConfig } from './types';

const projectRoot = path.resolve(__dirname, '..');

export const config: PipelineConfig = {
  cacheDir: path.join(projectRoot, 'other-data/cache'),
  recipesDir: path.join(projectRoot, 'other-data/cache/recipes'),
  pipelineDir: path.join(projectRoot, 'data/pipeline'),
  runsDir: path.join(projectRoot, 'data/pipeline/runs'),
  youtubeCacheDir: path.join(projectRoot, 'data/youtube-cache'),
};

export function getRunDir(runId: string): string {
  return path.join(config.runsDir, runId);
}

export function getRecipesDir(runId: string): string {
  return path.join(getRunDir(runId), 'recipes');
}

export function getManifestPath(runId: string): string {
  return path.join(getRunDir(runId), 'manifest.json');
}

export function getCurrentRunPath(): string {
  return path.join(config.pipelineDir, 'current.txt');
}

export function generateRunId(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
