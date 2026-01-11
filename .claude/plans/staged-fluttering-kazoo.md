# Migrate Recipe Generation from Python to TypeScript

## Objective
Deprecate `youtube/generate_recipes.py` and create a TypeScript batch processing script that uses the existing admin viewer's AI prompt and infrastructure.

## Why Migrate?
The TypeScript version has significant advantages:
1. **Better prompt**: Supports multiple recipes per video, atomic instruction steps, measurements extraction
2. **Timestamps from transcript**: Uses `[MM:SS]` markers for accurate step timing
3. **Versioning support**: Built-in recipe version management
4. **Consistent format**: Same format used by admin viewer for display and editing

## Implementation Plan

### Step 1: Create TypeScript Batch Script
Create `scripts/generate-recipes.ts` that:
- Accepts `--channel` filter (by channel name)
- Accepts `--limit` for testing
- Accepts `--skip-existing` to skip videos with existing recipes
- Uses existing `lib/admin/data/file-io.ts` for reading videos/transcripts
- Uses existing `lib/admin/openai/client.ts` for AI extraction
- Uses existing `lib/admin/data/recipe-versions.ts` for saving recipes

### Step 2: Add Timestamp Formatting to Transcript
Modify transcript loading to include `[MM:SS]` timestamps that the prompt expects:
- Use `loadTranscriptSegments()` to get segments with timing
- Format transcript with timestamps prefixed to each segment

### Step 3: Deprecate Python Script
- Add deprecation notice to `youtube/generate_recipes.py`
- Update `youtube/README.md` or `RECIPES.md` to reference new script

## Key Files

### Existing TypeScript Infrastructure (no changes needed):
- `lib/admin/openai/default-prompt.ts` - The improved prompt
- `lib/admin/openai/client.ts` - `extractRecipeWithAI()` function
- `lib/admin/data/file-io.ts` - `getAllVideoIds()`, `loadVideoMetadata()`, `loadTranscriptSegments()`
- `lib/admin/data/recipe-versions.ts` - `saveNewVersion()` for saving recipes

### New File to Create:
- `scripts/generate-recipes.ts` - Batch processing script

### File to Deprecate:
- `youtube/generate_recipes.py` - Add deprecation notice

## Script Implementation

```typescript
// scripts/generate-recipes.ts
import {
  getAllVideoIds,
  loadVideoMetadata,
  loadTranscriptSegments,
  getChannelSlugs,
  loadChannelMetadata,
} from '@/lib/admin/data/file-io';
import { extractRecipeWithAI } from '@/lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '@/lib/admin/openai/default-prompt';
import { saveNewVersion, getVersionsDir } from '@/lib/admin/data/recipe-versions';
import { existsSync } from 'fs';

// CLI args parsing
// --channel <name>: Filter by channel
// --limit <n>: Process only first n videos
// --skip-existing: Skip videos with existing recipes

// Main logic:
// 1. Get all video IDs from youtube-cache
// 2. Filter by channel if specified
// 3. For each video:
//    a. Load metadata
//    b. Load transcript segments and format with timestamps
//    c. Call extractRecipeWithAI()
//    d. Save using saveNewVersion()
```

## Transcript Formatting

The TypeScript prompt expects timestamps in `[MM:SS]` format. Format segments like:
```
[0:00] Welcome to today's video where we're making pasta.
[0:15] First, let's talk about the ingredients.
[1:30] Now let's start cooking by boiling water.
```

Helper function:
```typescript
function formatTranscriptWithTimestamps(segments: Segment[]): string {
  return segments.map(seg => {
    const mins = Math.floor(seg.startTime / 60);
    const secs = Math.floor(seg.startTime % 60);
    return `[${mins}:${secs.toString().padStart(2, '0')}] ${seg.text}`;
  }).join('\n');
}
```

## Running the Script

```bash
# Generate recipes for all Ethan videos
npx tsx scripts/generate-recipes.ts --channel "Ethan Chlebowski" --skip-existing

# Test with limit
npx tsx scripts/generate-recipes.ts --channel "Ethan" --limit 5
```
