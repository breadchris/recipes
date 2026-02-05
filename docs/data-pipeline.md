# Data Pipeline Documentation

This document describes the data pipeline for creating, processing, and publishing video/recipe content.

## Architecture Overview

The system uses a **three-stage pipeline**:

1. **Data Generation** - Recipe extraction and transcript cleaning via OpenAI
2. **Data Extraction** - Consolidation into structured format
3. **Data Publishing** - Upserting to Supabase and indexing to Typesense

```
EXTERNAL SOURCES                    LOCAL CACHE                         GENERATION
├── YouTube Videos      ──────►    /data/youtube-cache/    ──────►    AI Processing
├── VTT Transcripts                ├── {videoId}.json.gz               ├── Recipe extraction
└── Channel Metadata               └── channel_*.json.gz               └── Transcript cleaning
                                                                              │
                                                                              ▼
APPLICATION                         INDEXING                           EXTRACTION
├── Search (Typesense)  ◄──────    Typesense Collections  ◄──────    /data/pipeline/runs/
├── Recipe Display                  ├── recipes                        └── {runId}/recipes/
└── Transcript Views                ├── ingredients                          │
        ▲                           └── tags                                 │
        │                                  ▲                                 ▼
        └──────────────────────────────────┴────────────────────     PUBLISHING
                                                                      Supabase Tables
                                                                      ├── channels
                                                                      ├── videos
                                                                      └── recipes
```

---

## Stage 1: Data Generation

### Recipe Generation

**Script**: `pipeline/generate.ts`

Extracts recipe information from video transcripts using OpenAI.

**Source Data**:
- Location: `/data/youtube-cache/`
- Format: Gzipped JSON files (`{videoId}.json.gz`)
- Includes: Video metadata, transcript segments, VTT files

**Command**:
```bash
npm run pipeline:generate [options]
```

**Options**:
| Flag | Description |
|------|-------------|
| `--limit N` | Process only N videos |
| `--skip-existing` | Skip already-generated recipes |
| `--channel FILTER` | Filter by channel name |
| `--title PATTERN` | Filter by title (regex) |
| `--dry-run` | Preview without calling OpenAI |

**Output Structure** (`recipes/{videoId}_recipe.json`):
```json
{
  "has_recipe": true,
  "video_id": "abc123",
  "recipes": [{
    "title": "Recipe Name",
    "ingredients": [
      {"item": "flour", "quantity": "2", "unit": "cups"}
    ],
    "instructions": ["Step 1...", "Step 2..."],
    "prep_time_minutes": 15,
    "cook_time_minutes": 30,
    "total_time_minutes": 45,
    "servings": "4",
    "difficulty": "easy",
    "tags": ["dinner", "quick"],
    "equipment": ["oven", "mixing bowl"]
  }]
}
```

### Transcript Cleaning

**Script**: `pipeline/clean-transcript.ts`

Generates cleaned, readable transcript sections for UI display.

**Command**:
```bash
npm run pipeline:clean-transcript [options]
```

**Output Structure** (`recipes/{videoId}/versions/v1.json`):
```json
{
  "version_info": {
    "version": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "prompt_used": "...",
    "model": "gpt-4",
    "temperature": 0.7,
    "generation_type": "original"
  },
  "recipe": {
    "cleaned_transcript": {
      "sections": [{
        "title": "Introduction",
        "summary": "Overview of the dish",
        "timestamp": {"start": 0, "end": 60},
        "key_points": ["Point 1", "Point 2"]
      }],
      "model": "gpt-4"
    }
  }
}
```

---

## Stage 2: Data Extraction

**Script**: `pipeline/extract.ts`

Consolidates all video data, recipes, and transcripts into a single structured format per run.

**Command**:
```bash
npm run pipeline:extract
```

**Process**:
1. Scans channel files (`channel_*.json.gz`)
2. Loads each channel's video list
3. Associates recipes and transcripts
4. Combines into `ExtractedVideo` objects
5. Saves to timestamped run directory

**Output Location**: `/data/pipeline/runs/{runId}/`

**Manifest Structure** (`manifest.json`):
```json
{
  "run_id": "2024-01-15T10-30-00",
  "created_at": "2024-01-15T10:30:00Z",
  "videos_processed": 150,
  "videos_with_recipes": 120,
  "videos_with_transcripts": 145,
  "source": "/data/youtube-cache",
  "upserted_to_supabase": false,
  "upserted_at": null
}
```

### Pipeline Run Management

```bash
npm run pipeline:list              # Show all runs
npm run pipeline:use -- --run=ID   # Set as current run
```

---

## Stage 3: Data Publishing

### Supabase Upsert

**Script**: `pipeline/upsert.ts`

Inserts/updates video data into Supabase tables.

**Command**:
```bash
npm run pipeline:upsert              # Uses current run
npm run pipeline:upsert -- --run=ID  # Specify run
```

**Target Tables**:
| Table | Description |
|-------|-------------|
| `channels` | Channel metadata |
| `videos` | Video records |
| `recipes` | Recipe details (indexed by video_id + recipe_index) |
| `transcripts` | Raw VTT and segments |

### Alternative: Content Table Upsert

**Script**: `pipeline/upsert-to-content.ts`

For legacy system using single `content` table with `group_id`.

```bash
npm run pipeline:upsert-content
```

---

## Stage 4: Search Indexing

All search operations use Typesense collections.

### Recipe/Video Indexing

**Script**: `scripts/index-to-typesense.ts`

**Command**:
```bash
npm run index:typesense
```

**Collection**: `recipes`

**Indexed Fields**:
```typescript
{
  id: string,              // Video ID
  title: string,           // 3x weight in search
  description: string,
  channelName: string,     // Faceted
  channelSlug: string,
  duration: number,
  view_count: number,
  upload_date: string,
  hasRecipe: boolean,      // Faceted
  priorityBoost: number,   // 2 for priority channels
  difficulty: string,
  total_time_minutes: number,
  ingredients: string[],   // For pantry matching
  tags: string[]           // Faceted
}
```

### Ingredient Indexing

**Script**: `scripts/index-ingredients-to-typesense.ts`

**Command**:
```bash
npm run index:ingredients
```

**Collection**: `ingredients`

**Source**: `data/ingredient-index.json`

### Tag Indexing

**Scripts**:
- `scripts/build-tag-index.ts` - Build tag index
- `scripts/index-tags-to-typesense.ts` - Index to Typesense

**Commands**:
```bash
npm run build:tags    # Build tag index
npm run index:tags    # Index to Typesense
```

**Collection**: `tag-stats`

**Sources**:
- Recipe tags (meal_type, cuisine_type, dietary_tags)
- Food types (`data/food-type-index.json`)
- Recipe types (`data/recipe-type-groups.json`)
- Tag taxonomy (`data/tag-taxonomy.json`)

### Playlist Indexing

**Script**: `scripts/index-playlists-to-typesense.ts`

**Command**:
```bash
npm run index:playlists
```

**Collection**: `playlists`

---

## Complete Workflow

Execute the pipeline in this order:

### 1. Data Generation (Ad-hoc)
```bash
# Generate recipes from transcripts
npm run pipeline:generate --skip-existing

# Clean transcripts for display
npm run pipeline:clean-transcript --skip-existing
```

### 2. Build Indexes
```bash
npm run build:indexes
```

### 3. Extract and Publish
```bash
# Create new extraction run
npm run pipeline:extract

# Push to Supabase
npm run pipeline:upsert
```

### 4. Index for Search
```bash
npm run index:typesense     # Recipe search
npm run index:ingredients   # Ingredient autocomplete
npm run index:tags          # Tag filtering
npm run index:playlists     # Playlist search
```

---

## Directory Structure

```
/data/
├── youtube-cache/              # Raw video & transcript cache
│   ├── {videoId}.json.gz       # Video metadata
│   ├── {videoId}.vtt.gz        # VTT transcript
│   ├── channel_*.json.gz       # Channel data
│   └── recipes/                # Generated recipes
│       ├── {videoId}_recipe.json
│       └── {videoId}/
│           └── versions/       # Versioned transcripts
│
├── pipeline/
│   ├── runs/                   # Extraction runs
│   │   └── {runId}/
│   │       ├── manifest.json
│   │       └── recipes/
│   └── current.txt             # Current run ID
│
├── priority-channels.json      # Channel priority config
├── tag-taxonomy.json           # Tag structure
├── ingredient-index.json       # Ingredient list
└── recipe-type-groups.json     # Recipe classifications
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `pipeline/config.ts` | Pipeline directories and paths |
| `pipeline/types.ts` | Type definitions for all stages |
| `data/priority-channels.json` | Channel priority boosting |
| `data/tag-taxonomy.json` | Tag structure and legacy mappings |
| `data/ingredient-index.json` | Ingredient list and categories |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Typesense
TYPESENSE_HOST=...
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_SEARCH_API_KEY=...
TYPESENSE_ADMIN_API_KEY=...

# OpenAI (for generation)
OPENAI_API_KEY=...
```

---

## Key Characteristics

- **Incremental**: Recipes generated per-video with `--skip-existing`
- **Staged**: Extraction runs create isolated snapshots before upserting
- **Reversible**: Multiple runs can be kept; switch with `pipeline:use`
- **Validated**: Manifests track upsert status and statistics
- **Searchable**: Typesense indexing with faceting and weighting
