import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';
import pLimit from 'p-limit';
import { config } from './config';
import { LambdaExtractor } from './lambda';

interface ChannelVideo {
  id: string;
  upload_date: string;
  title: string;
}

interface ChannelData {
  entries: Array<{
    id?: string;
    upload_date?: string;
    title?: string;
  }>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    channel: '',
    days: 180,
    all: false,
    limit: 0,
    parallel: 1,
    async: false,
    skipCache: false,
    syncOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--channel' && args[i + 1]) {
      options.channel = args[++i];
    } else if (arg === '--days' && args[i + 1]) {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--parallel' && args[i + 1]) {
      options.parallel = parseInt(args[++i], 10);
    } else if (arg === '--async') {
      options.async = true;
    } else if (arg === '--skip-cache') {
      options.skipCache = true;
    } else if (arg === '--sync-only') {
      options.syncOnly = true;
    } else if (!arg.startsWith('--') && !options.channel) {
      // Allow channel as positional argument
      options.channel = arg;
    }
  }

  return options;
}

function getChannelVideos(channelHandle: string, daysBack: number, allVideos: boolean): ChannelVideo[] {
  const cacheFile = path.join(config.youtubeCacheDir, `channel_${channelHandle}.json.gz`);

  if (!fs.existsSync(cacheFile)) {
    console.error(`Error: Channel cache not found at ${cacheFile}`);
    console.error(`Run: python youtube/fetch_youtube_metadata.py transcript --channel-url https://www.youtube.com/@${channelHandle}`);
    return [];
  }

  // Load cached channel data
  const compressed = fs.readFileSync(cacheFile);
  const channelData: ChannelData = JSON.parse(zlib.gunzipSync(compressed).toString('utf-8'));

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '');

  // Extract video entries
  const entries = channelData.entries || [];

  // Filter by date and extract video info
  const videos: ChannelVideo[] = [];
  for (const entry of entries) {
    if (!entry || !entry.id) continue;

    const uploadDate = entry.upload_date || '';

    // Filter by date (skip if --all flag is set)
    if (allVideos || uploadDate >= cutoffStr) {
      videos.push({
        id: entry.id,
        upload_date: uploadDate,
        title: entry.title || 'Unknown',
      });
    }
  }

  // Sort by upload date (newest first)
  videos.sort((a, b) => b.upload_date.localeCompare(a.upload_date));

  if (allVideos) {
    console.error(`Found ${videos.length} total videos`);
  } else {
    console.error(`Found ${videos.length} videos from last ${daysBack} days (since ${cutoffStr})`);
  }

  return videos;
}

async function main() {
  const options = parseArgs();

  if (!options.channel) {
    console.error('Usage: npm run pipeline:transcript -- --channel <handle> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --channel <handle>   Channel handle (e.g., JKenjiLopezAlt)');
    console.error('  --days <number>      Days to look back (default: 180)');
    console.error('  --all                Process all videos regardless of date');
    console.error('  --limit <number>     Limit number of videos (for testing)');
    console.error('  --parallel <number>  Concurrent Lambda invocations (default: 1)');
    console.error('  --async              Use async invocation (fire-and-forget)');
    console.error('  --skip-cache         Force re-extraction');
    console.error('  --sync-only          Only sync from S3, don\'t invoke Lambda');
    process.exit(1);
  }

  // Get videos from channel
  let videos = getChannelVideos(options.channel, options.days, options.all);

  if (videos.length === 0) {
    console.error('No videos found matching criteria');
    return;
  }

  // Apply limit if specified
  if (options.limit > 0) {
    videos = videos.slice(0, options.limit);
    console.error(`Limited to ${videos.length} videos`);
  }

  const extractor = new LambdaExtractor();
  const videoIds = videos.map(v => v.id);
  let successCount = 0;
  let errorCount = 0;

  if (options.syncOnly) {
    // Only sync from S3
    console.error(`\nSyncing ${videoIds.length} videos from S3 to local cache...`);
    const synced = await extractor.syncFromS3(videoIds);
    console.error(`Synced ${synced} videos to ${config.youtubeCacheDir}`);
    return;
  }

  if (options.async) {
    // Async invocation (fire and forget)
    console.error(`\nInvoking Lambda asynchronously for ${videoIds.length} videos...`);

    const limit = pLimit(options.parallel);
    await Promise.all(
      videoIds.map(videoId =>
        limit(async () => {
          try {
            await extractor.extractVideoAsync(videoId);
            console.error(`  → ${videoId} (async)`);
          } catch (e) {
            console.error(`  ✗ ${videoId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            errorCount++;
          }
        })
      )
    );

    console.error(`\nAsync invocations sent. Run with --sync-only later to download results.`);
    return;
  }

  // Synchronous invocation with parallel workers
  console.error(`\nInvoking Lambda for ${videoIds.length} videos with ${options.parallel} parallel workers...`);

  const limit = pLimit(options.parallel);
  await Promise.all(
    videoIds.map(videoId =>
      limit(async () => {
        try {
          const result = await extractor.extractVideo(videoId, options.skipCache);
          if (result.success) {
            successCount++;
            console.error(`  ✓ ${videoId}`);
          } else {
            errorCount++;
            console.error(`  ✗ ${videoId}: ${result.message || 'Unknown error'}`);
          }
        } catch (e) {
          errorCount++;
          console.error(`  ✗ ${videoId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      })
    )
  );

  // Sync from S3 to local
  console.error(`\nSyncing from S3 to local cache...`);
  const synced = await extractor.syncFromS3(videoIds);
  console.error(`Synced ${synced} videos to ${config.youtubeCacheDir}`);

  // Print summary
  console.error(`\n${'='.repeat(60)}`);
  console.error(`SUMMARY (Lambda)`);
  console.error(`${'='.repeat(60)}`);
  console.error(`Total videos: ${videos.length}`);
  console.error(`Success: ${successCount}`);
  console.error(`Errors: ${errorCount}`);
  console.error(`Synced to local: ${synced}`);
}

main().catch(console.error);
