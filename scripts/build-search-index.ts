import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import MiniSearch from 'minisearch';

interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;
  view_count: number;
  upload_date: string;
  thumbnails: any[];
  channel: string;
  channel_id: string;
  channelSlug: string;
  recipes?: any[];
}

interface VideoWithChannel extends Video {
  channelName: string;
  channelFollowers: number;
  hasRecipe: boolean;
}

interface Channel {
  name: string;
  slug: string;
  id: string;
  followers: number;
}

interface RecipesData {
  videos: Video[];
  channels: Channel[];
}

interface PriorityConfig {
  channels: Record<string, number>;
}

/**
 * Build search index for recipes data
 * Applies field boosting: title (3x) > description (1x) > channelName (0.5x)
 * Applies channel priority multipliers from priority-channels.json
 */
async function buildSearchIndex() {
  console.log('🔍 Building search index...');

  // Load recipes data
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  const recipesData: RecipesData = JSON.parse(decompressedData.toString());

  console.log(`📊 Loaded ${recipesData.videos.length} videos and ${recipesData.channels.length} channels`);

  // Load priority channels config
  const priorityConfigPath = path.join(__dirname, '../data/priority-channels.json');
  let priorityConfig: PriorityConfig = { channels: {} };

  if (fs.existsSync(priorityConfigPath)) {
    priorityConfig = JSON.parse(fs.readFileSync(priorityConfigPath, 'utf-8'));
    console.log(`⭐ Loaded priority config for ${Object.keys(priorityConfig.channels).length} channels`);
  }

  // Create channel lookup map
  const channelMap = new Map<string, Channel>();
  recipesData.channels.forEach((channel) => {
    channelMap.set(channel.id, channel);
  });

  // Combine videos with channel data
  const videosWithChannels: VideoWithChannel[] = recipesData.videos.map((video) => {
    const channel = channelMap.get(video.channel_id);
    return {
      ...video,
      channelName: channel?.name || '',
      channelFollowers: channel?.followers || 0,
      hasRecipe: !!(video.recipes && video.recipes.length > 0),
    };
  });

  // Create MiniSearch index
  const miniSearch = new MiniSearch<VideoWithChannel>({
    fields: ['title', 'description', 'channelName'],
    storeFields: [
      'id',
      'title',
      'description',
      'duration',
      'view_count',
      'upload_date',
      'thumbnails',
      'channel',
      'channel_id',
      'channelSlug',
      'channelName',
      'channelFollowers',
      'hasRecipe',
    ],
    searchOptions: {
      boost: {
        title: 3,        // Title matches get 3x weight
        description: 1,  // Description matches get 1x weight
        channelName: 0.5 // Channel matches get 0.5x weight
      },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  // Add all videos to index
  console.log('📇 Indexing videos...');
  miniSearch.addAll(videosWithChannels);

  // Serialize the index to JSON
  const serializedIndex = miniSearch.toJSON();

  // Add channel priority metadata to serialized index
  const indexWithMetadata = {
    index: serializedIndex,
    priorityChannels: priorityConfig.channels,
    buildTime: new Date().toISOString(),
    videoCount: videosWithChannels.length,
  };

  // Write to file
  const outputPath = path.join(__dirname, '../data/search-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(indexWithMetadata, null, 2));

  const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`✅ Search index built successfully!`);
  console.log(`📦 Output: ${outputPath} (${fileSize} MB)`);
  console.log(`🎯 Indexed ${videosWithChannels.length} videos with field boosting:`);
  console.log(`   - Title: 3x`);
  console.log(`   - Description: 1x`);
  console.log(`   - Channel Name: 0.5x`);

  if (Object.keys(priorityConfig.channels).length > 0) {
    console.log(`⭐ Priority channels configured:`);
    Object.entries(priorityConfig.channels).forEach(([slug, boost]) => {
      console.log(`   - ${slug}: ${boost}x`);
    });
  }
}

// Run the build
buildSearchIndex().catch((error) => {
  console.error('❌ Error building search index:', error);
  process.exit(1);
});
