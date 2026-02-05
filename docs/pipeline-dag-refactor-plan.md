# Pipeline Refactor: DAG-Based Architecture

> **Status**: Proposed
> **Created**: 2026-01-18

## Overview

Refactor the pipeline into a **Directed Acyclic Graph (DAG)** where:
- Each step is a **node** with declared inputs/outputs
- Steps are **individually invocable**
- Outputs are **streamable** (process items as they're ready)
- Dependencies are **automatically resolved**

---

## Current Pipeline as DAG

```
                    ┌─────────────┐
                    │ youtube-cache│ (source data)
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ generate │   │  clean   │   │ (future) │
     │ recipes  │   │transcript│   │  step    │
     └────┬─────┘   └────┬─────┘   └──────────┘
          │              │
          └──────┬───────┘
                 ▼
          ┌──────────┐
          │ extract  │
          └────┬─────┘
               ▼
          ┌──────────┐
          │ upsert   │ → Supabase
          └────┬─────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐
│ build  ││ build  ││ build  │
│  tags  ││ingredi.││playlist│
└───┬────┘└───┬────┘└───┬────┘
    │         │         │
    ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐
│ index  ││ index  ││ index  │
│recipes ││ingredi.││playlist│
└────────┘└────────┘└────────┘
```

---

## Proposed Architecture

### Core Concepts

```typescript
// Each pipeline step is a Node
interface PipelineNode<TInput, TOutput> {
  id: string;
  name: string;

  // Declare dependencies
  dependsOn: string[];

  // Process a single item (streamable)
  process(input: TInput): AsyncGenerator<TOutput>;

  // Or process in batch
  processBatch?(inputs: TInput[]): AsyncGenerator<TOutput>;
}

// DAG orchestrator
interface PipelineDAG {
  // Register nodes
  register(node: PipelineNode): void;

  // Run single node (with auto-dependency resolution)
  run(nodeId: string, options?: RunOptions): AsyncGenerator<any>;

  // Run full pipeline
  runAll(options?: RunOptions): AsyncGenerator<PipelineEvent>;

  // Visualize the DAG
  visualize(): string;
}
```

### Streaming Model

```typescript
// Events emitted during pipeline execution
type PipelineEvent =
  | { type: 'node:start'; nodeId: string; itemCount?: number }
  | { type: 'node:item'; nodeId: string; item: any }
  | { type: 'node:progress'; nodeId: string; current: number; total: number }
  | { type: 'node:complete'; nodeId: string; stats: NodeStats }
  | { type: 'node:error'; nodeId: string; error: Error; item?: any }
  | { type: 'pipeline:complete'; stats: PipelineStats };
```

---

## Implementation Plan

### Phase 1: Core DAG Framework (3 files)

#### 1. `pipeline/dag/types.ts` - Type definitions

```typescript
export interface NodeDefinition<TIn = unknown, TOut = unknown> {
  id: string;
  name: string;
  description: string;
  dependsOn: string[];

  // Input/output declarations for validation
  inputs: { type: string; source: string }[];
  outputs: { type: string; destination: string }[];
}

export interface NodeContext {
  config: PipelineConfig;
  logger: Logger;
  signal: AbortSignal;  // For cancellation
}

export interface PipelineNode<TIn = unknown, TOut = unknown>
  extends NodeDefinition<TIn, TOut> {

  // Stream processing (preferred)
  process(ctx: NodeContext): AsyncGenerator<TOut>;

  // Optional: estimate work for progress reporting
  estimateWork?(ctx: NodeContext): Promise<number>;
}
```

#### 2. `pipeline/dag/runner.ts` - DAG execution engine

```typescript
export class DAGRunner {
  private nodes: Map<string, PipelineNode>;
  private completed: Set<string>;

  register(node: PipelineNode): void;

  // Run a single node (resolves deps first)
  async *run(nodeId: string, opts?: RunOptions): AsyncGenerator<PipelineEvent>;

  // Run from a specific node to end
  async *runFrom(nodeId: string): AsyncGenerator<PipelineEvent>;

  // Run full pipeline
  async *runAll(): AsyncGenerator<PipelineEvent>;

  // Check if node can run (deps satisfied)
  canRun(nodeId: string): boolean;

  // Get execution order (topological sort)
  getExecutionOrder(): string[];

  // Visualize DAG as ASCII or mermaid
  visualize(format: 'ascii' | 'mermaid'): string;
}
```

#### 3. `pipeline/dag/cli.ts` - Unified CLI

```typescript
// Single entry point for all pipeline operations
// npm run pipeline <command> [options]

Commands:
  run <node>       Run a specific node (auto-resolves dependencies)
  run-all          Run the full pipeline
  list             List all nodes and their status
  status           Show what needs to run
  visualize        Print the DAG structure

Options:
  --from=<node>    Start from a specific node
  --only=<node>    Run only this node (skip deps)
  --dry-run        Show what would run without executing
  --parallel       Run independent nodes in parallel
  --stream         Stream output as JSON lines
```

---

### Phase 2: Define Pipeline Nodes (8 files)

Each existing script becomes a node:

#### 4. `pipeline/nodes/generate-recipes.ts`

```typescript
export const generateRecipesNode: PipelineNode<Video, GeneratedRecipe> = {
  id: 'generate-recipes',
  name: 'Generate Recipes',
  description: 'Extract recipes from video transcripts using AI',
  dependsOn: [],  // No dependencies (reads from cache)

  inputs: [{ type: 'video-cache', source: 'youtube-cache/*.json.gz' }],
  outputs: [{ type: 'recipe-json', destination: 'youtube-cache/recipes/' }],

  async *process(ctx) {
    const videos = await getVideoFiles(ctx.config);

    for (const video of videos) {
      ctx.logger.debug(`Processing ${video.id}`);

      const recipe = await extractRecipe(video, ctx);
      await saveRecipe(recipe, ctx.config);

      yield { videoId: video.id, recipe };  // Stream each result
    }
  },

  async estimateWork(ctx) {
    return (await getVideoFiles(ctx.config)).length;
  }
};
```

#### 5. `pipeline/nodes/clean-transcripts.ts`

```typescript
export const cleanTranscriptsNode: PipelineNode = {
  id: 'clean-transcripts',
  name: 'Clean Transcripts',
  dependsOn: [],  // Independent of generate-recipes
  // ...
};
```

#### 6. `pipeline/nodes/extract.ts`

```typescript
export const extractNode: PipelineNode = {
  id: 'extract',
  name: 'Extract & Package',
  dependsOn: ['generate-recipes'],  // Needs recipes first
  // ...
};
```

#### 7. `pipeline/nodes/upsert.ts`

```typescript
export const upsertNode: PipelineNode = {
  id: 'upsert',
  name: 'Upsert to Supabase',
  dependsOn: ['extract'],
  // ...
};
```

#### 8-11. Index building and Typesense nodes

```typescript
// pipeline/nodes/build-tags.ts
export const buildTagsNode: PipelineNode = {
  id: 'build-tags',
  dependsOn: ['upsert'],
};

// pipeline/nodes/index-recipes.ts
export const indexRecipesNode: PipelineNode = {
  id: 'index-recipes',
  dependsOn: ['upsert', 'build-tags'],
};

// etc.
```

---

### Phase 3: Registry & Wiring (2 files)

#### 12. `pipeline/nodes/index.ts` - Node registry

```typescript
import { generateRecipesNode } from './generate-recipes';
import { cleanTranscriptsNode } from './clean-transcripts';
import { extractNode } from './extract';
import { upsertNode } from './upsert';
import { buildTagsNode } from './build-tags';
import { indexRecipesNode } from './index-recipes';
// ...

export const nodes = [
  generateRecipesNode,
  cleanTranscriptsNode,
  extractNode,
  upsertNode,
  buildTagsNode,
  buildIngredientsNode,
  buildPlaylistsNode,
  indexRecipesNode,
  indexIngredientsNode,
  indexPlaylistsNode,
];

export const pipeline = new DAGRunner();
nodes.forEach(n => pipeline.register(n));
```

#### 13. `pipeline/index.ts` - Main entry point

```typescript
#!/usr/bin/env tsx
import { pipeline } from './nodes';
import { createCLI } from './dag/cli';

const cli = createCLI(pipeline);
cli.run(process.argv.slice(2));
```

---

## Usage Examples

### Run a single node (auto-resolves deps)

```bash
# This will run: generate-recipes → extract → upsert
npm run pipeline run upsert

# Output (streamed):
{"type":"node:start","nodeId":"generate-recipes","itemCount":150}
{"type":"node:item","nodeId":"generate-recipes","item":{"videoId":"abc123"}}
{"type":"node:progress","nodeId":"generate-recipes","current":1,"total":150}
...
{"type":"node:complete","nodeId":"generate-recipes","stats":{...}}
{"type":"node:start","nodeId":"extract"}
...
```

### Run only one node (skip deps)

```bash
# Just run indexing, assume deps are satisfied
npm run pipeline run index-recipes --only
```

### Run with streaming to file

```bash
npm run pipeline run-all --stream > pipeline-output.jsonl
```

### Visualize the DAG

```bash
npm run pipeline visualize

# Output:
┌─────────────────┐     ┌─────────────────┐
│ generate-recipes│     │clean-transcripts│
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              ┌──────────┐
              │ extract  │
              └────┬─────┘
                   ▼
              ┌──────────┐
              │  upsert  │
              └────┬─────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌───────────┐  ┌──────────┐
│build-tag│  │build-ingr.│  │build-play│
└────┬────┘  └─────┬─────┘  └────┬─────┘
     ▼             ▼             ▼
┌─────────┐  ┌───────────┐  ┌──────────┐
│idx-recip│  │idx-ingred.│  │idx-playl.│
└─────────┘  └───────────┘  └──────────┘
```

### Check what needs to run

```bash
npm run pipeline status

# Output:
Node                  Status      Last Run
────────────────────────────────────────────
generate-recipes      ✓ complete  2024-01-15 10:30
clean-transcripts     ✓ complete  2024-01-15 10:35
extract               ✓ complete  2024-01-15 10:40
upsert                ○ pending   never
build-tags            ○ blocked   waiting on: upsert
index-recipes         ○ blocked   waiting on: upsert, build-tags
```

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `pipeline/dag/types.ts` | Core type definitions |
| `pipeline/dag/runner.ts` | DAG execution engine |
| `pipeline/dag/cli.ts` | Unified CLI |
| `pipeline/nodes/generate-recipes.ts` | Recipe generation node |
| `pipeline/nodes/clean-transcripts.ts` | Transcript cleaning node |
| `pipeline/nodes/extract.ts` | Data extraction node |
| `pipeline/nodes/upsert.ts` | Supabase upsert node |
| `pipeline/nodes/build-tags.ts` | Tag index building node |
| `pipeline/nodes/build-ingredients.ts` | Ingredient index node |
| `pipeline/nodes/build-playlists.ts` | Playlist index node |
| `pipeline/nodes/index-recipes.ts` | Typesense recipe indexing |
| `pipeline/nodes/index-ingredients.ts` | Typesense ingredient indexing |
| `pipeline/nodes/index-playlists.ts` | Typesense playlist indexing |
| `pipeline/nodes/index.ts` | Node registry |
| `pipeline/index.ts` | Main entry point |

### Files to Remove (after migration)

| File | Replaced By |
|------|-------------|
| `pipeline/generate.ts` | `nodes/generate-recipes.ts` |
| `pipeline/clean-transcript.ts` | `nodes/clean-transcripts.ts` |
| `pipeline/extract.ts` | `nodes/extract.ts` |
| `pipeline/upsert.ts` | `nodes/upsert.ts` |
| `scripts/index-to-typesense.ts` | `nodes/index-recipes.ts` |
| `scripts/index-ingredients-to-typesense.ts` | `nodes/index-ingredients.ts` |
| `scripts/index-playlists-to-typesense.ts` | `nodes/index-playlists.ts` |

---

## Streaming Architecture

### Why Streaming?

1. **Memory efficiency** - Process items one at a time, not all in memory
2. **Real-time feedback** - See progress as it happens
3. **Composability** - Pipe output to other tools
4. **Resumability** - Can checkpoint and resume mid-stream

### Stream Protocol

```typescript
// All nodes emit JSONL (JSON Lines)
// Each line is a self-contained event

// Progress events
{"type":"progress","nodeId":"generate-recipes","current":50,"total":150}

// Item events (the actual data)
{"type":"item","nodeId":"generate-recipes","data":{"videoId":"abc","recipes":[...]}}

// Error events (non-fatal)
{"type":"error","nodeId":"generate-recipes","videoId":"xyz","error":"API timeout"}

// Completion
{"type":"complete","nodeId":"generate-recipes","stats":{"processed":148,"errors":2}}
```

### Consuming Streams

```bash
# Watch progress in real-time
npm run pipeline run-all --stream | jq -c 'select(.type=="progress")'

# Extract just the data
npm run pipeline run generate-recipes --stream | jq -c 'select(.type=="item") | .data'

# Count errors
npm run pipeline run-all --stream | jq -c 'select(.type=="error")' | wc -l
```

---

## Verification Plan

1. **Unit test** each node in isolation
2. **Integration test** DAG dependency resolution
3. **Run single node**: `npm run pipeline run generate-recipes --limit=5`
4. **Run with deps**: `npm run pipeline run upsert` (should trigger extract first)
5. **Visualize**: `npm run pipeline visualize`
6. **Stream output**: Verify JSONL format is valid
7. **Parallel execution**: Run independent nodes concurrently
