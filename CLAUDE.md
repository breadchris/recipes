# Development

**Never run `npm run dev`** - the dev server is managed externally.

---

# Data Architecture

This app uses **Supabase** for primary data storage and **Typesense** for search. No local JSON files are used at runtime.

## Supabase (Primary Data Store)

All video/recipe content is stored in Supabase:
- **Table**: `content` with `group_id` for the recipes group
- **Access**: Server-side only via service role key
- **Data**: Videos, recipes, transcripts, channel metadata

Key functions in `lib/supabaseDataLoader.ts`:
- `getAllVideos()` - Fetch all videos
- `getVideoById(id)` - Single video lookup
- `getChannelBySlug(slug)` - Channel with videos
- `getAllChannels()` - All channels

## Typesense (Search & Filtering)

All search operations use Typesense collections:

| Collection | Purpose |
|------------|---------|
| `recipes` | Video search, ingredient matching, tag filtering |
| `playlists` | Playlist search and browsing |
| `ingredients` | Ingredient autocomplete and categories |
| `tag-stats` | Tag statistics for browsing |
| `scraped-recipes` | External recipe search (admin) |
| `nutrition` | Nutrition data search (admin) |

Key functions in `lib/searchIndex.ts`:
- `searchVideos()` - Full-text video search
- `browseVideos()` - Filtered video browsing
- `searchByIngredients()` - Pantry mode matching
- `searchPlaylists()` - Playlist search

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Typesense
TYPESENSE_HOST=
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_SEARCH_API_KEY=
TYPESENSE_ADMIN_API_KEY=
```

## Indexing Scripts

Run these to populate Typesense collections:

```bash
npm run index:typesense      # Index recipes collection
npm run index:playlists      # Index playlists collection
npm run index:ingredients    # Index ingredients collection
npm run index:tags           # Index tag statistics
```

---

# Deploy

```bash
vercel build --prod
vercel deploy --prebuilt --archive=tgz --prod
```
