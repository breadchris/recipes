#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { gunzipSync, gzipSync } = require('zlib');

function loadRecipe(videoId, recipesDir) {
  if (!recipesDir) return null;

  const recipeFile = path.join(recipesDir, `${videoId}_recipe.json`);

  try {
    if (!fs.existsSync(recipeFile)) {
      return null;
    }

    const recipeData = fs.readFileSync(recipeFile, 'utf-8');
    const recipe = JSON.parse(recipeData);

    // Only include recipe if has_recipe is true
    if (!recipe.has_recipe) {
      return null;
    }

    // Return only the recipe data, excluding internal flags
    const { has_recipe, video_id, video_url, upload_date, ...recipeContent } = recipe;

    return recipeContent;
  } catch (error) {
    console.error(`  Warning: Failed to load recipe for ${videoId}: ${error.message}`);
    return null;
  }
}

function getBestThumbnail(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return null;

  const ytThumbnails = thumbnails.filter(t => t.url && t.url.includes('i.ytimg.com/vi'));
  if (ytThumbnails.length === 0) return thumbnails[0];

  // Sort by resolution (highest first)
  const sorted = ytThumbnails.sort((a, b) => {
    const aRes = (a.width || 0) * (a.height || 0);
    const bRes = (b.width || 0) * (b.height || 0);
    return bRes - aRes;
  });

  // Find a medium-sized thumbnail (ideal for grid/card display: 320-640px width)
  const mediumThumbnail = sorted.find(t => {
    const width = t.width || 0;
    return width >= 320 && width <= 640;
  });

  // If we have a medium thumbnail, return it; otherwise use the highest quality
  return mediumThumbnail || sorted[0];
}

function getThumbnailSet(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return [];

  const ytThumbnails = thumbnails.filter(t => t.url && t.url.includes('i.ytimg.com/vi'));
  if (ytThumbnails.length === 0) return thumbnails.slice(0, 1);

  // Sort by resolution
  const sorted = ytThumbnails.sort((a, b) => {
    const aRes = (a.width || 0) * (a.height || 0);
    const bRes = (b.width || 0) * (b.height || 0);
    return bRes - aRes;
  });

  // Keep up to 3 different sizes for flexibility
  const sizes = [];
  const addedResolutions = new Set();

  for (const thumb of sorted) {
    const res = (thumb.width || 0) * (thumb.height || 0);
    if (!addedResolutions.has(res) && sizes.length < 3) {
      sizes.push(thumb);
      addedResolutions.add(res);
    }
  }

  return sizes;
}

function transformChannel(channel, channelSlug, recipesDir) {
  const transformed = {
    channel: channel.channel,
    channel_id: channel.channel_id,
    channelSlug: channelSlug,
    channel_follower_count: channel.channel_follower_count || 0,
    description: channel.description || '',
    thumbnails: channel.thumbnails ? channel.thumbnails.slice(0, 2) : [],
    entries: []
  };

  if (channel.entries && Array.isArray(channel.entries)) {
    transformed.entries = channel.entries.map(video => {
      const thumbnail = getBestThumbnail(video.thumbnails);
      const thumbnailSet = getThumbnailSet(video.thumbnails);

      const videoData = {
        id: video.id,
        title: video.title,
        description: video.description || '',
        duration: video.duration || 0,
        view_count: video.view_count || 0,
        upload_date: video.upload_date || '',
        thumbnail: thumbnail ? thumbnail.url : '',
        thumbnails: thumbnailSet,
        channel: channel.channel,
        channel_id: channel.channel_id,
        channelSlug: channelSlug
      };

      // Try to load recipe data for this video
      const recipe = loadRecipe(video.id, recipesDir);
      if (recipe) {
        // Wrap in array to support multiple recipes per video
        videoData.recipes = [recipe];
      }

      return videoData;
    });
  }

  return transformed;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node transform-channel-data.js <input-dir> <output-dir> [recipes-dir]');
    console.error('Example: node transform-channel-data.js /path/to/cache /path/to/recipes/data');
    console.error('         node transform-channel-data.js /path/to/cache /path/to/recipes/data /path/to/cache/recipes');
    console.error('\nIf recipes-dir is not specified, defaults to <input-dir>/recipes/');
    process.exit(1);
  }

  const inputDir = args[0];
  const outputDir = args[1];
  const recipesDir = args[2] || path.join(inputDir, 'recipes');

  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check if recipes directory exists
  const hasRecipes = fs.existsSync(recipesDir);
  if (hasRecipes) {
    console.log(`Recipes directory: ${recipesDir}\n`);
  } else {
    console.log(`No recipes directory found at: ${recipesDir}`);
    console.log('Videos will be processed without recipe data\n');
  }

  // Process all channel files
  const files = fs.readdirSync(inputDir);
  const channelFiles = files.filter(f => f.startsWith('channel_') && f.endsWith('.json.gz'));

  console.log(`Found ${channelFiles.length} channel files\n`);

  const allChannels = [];
  const allVideos = [];
  const channelsBySlug = {};
  const videosByID = {};
  let totalOriginalSize = 0;
  let totalRecipes = 0;

  channelFiles.forEach(file => {
    const filename = path.basename(file);
    const channelSlug = filename.replace('channel_', '').replace('.json.gz', '');
    const inputPath = path.join(inputDir, file);

    console.log(`Processing: ${filename}`);

    // Read and decompress
    const compressed = fs.readFileSync(inputPath);
    const decompressed = gunzipSync(compressed);
    const channel = JSON.parse(decompressed.toString());

    totalOriginalSize += decompressed.length;

    // Transform (pass recipesDir only if it exists)
    const transformed = transformChannel(channel, channelSlug, hasRecipes ? recipesDir : null);

    // Count recipes in this channel
    const channelRecipes = transformed.entries.filter(v => v.recipes?.length).length;
    totalRecipes += channelRecipes;

    console.log(`  Videos: ${transformed.entries.length}`);
    if (channelRecipes > 0) {
      console.log(`  Recipes: ${channelRecipes}`);
    }

    // Add to aggregated data
    allChannels.push(transformed);
    channelsBySlug[channelSlug] = transformed;

    // Add videos to flat array and index
    transformed.entries.forEach(video => {
      const videoWithChannel = {
        ...video,
        channelName: transformed.channel,
        channelFollowers: transformed.channel_follower_count
      };
      allVideos.push(videoWithChannel);
      videosByID[video.id] = videoWithChannel;
    });
  });

  // Create aggregated data structure
  const aggregatedData = {
    channels: allChannels,
    videos: allVideos,
    channelsBySlug: channelsBySlug,
    videosByID: videosByID,
    metadata: {
      totalChannels: allChannels.length,
      totalVideos: allVideos.length,
      totalRecipes: totalRecipes,
      videosWithRecipes: allVideos.filter(v => v.recipes?.length).length,
      generatedAt: new Date().toISOString()
    }
  };

  // Write single aggregated file
  const outputPath = path.join(outputDir, 'recipes-data.json.gz');
  const jsonData = JSON.stringify(aggregatedData);
  const compressed = gzipSync(jsonData);

  fs.writeFileSync(outputPath, compressed);

  const newSize = jsonData.length;
  const compressedSize = compressed.length;
  const reduction = ((1 - newSize / totalOriginalSize) * 100).toFixed(1);
  const compressionRatio = ((1 - compressedSize / newSize) * 100).toFixed(1);

  console.log('\n' + '='.repeat(50));
  console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Transformed size (uncompressed): ${(newSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Final size (gzipped): ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Data reduction: ${reduction}%`);
  console.log(`Compression ratio: ${compressionRatio}%`);
  console.log(`\nOutput: ${outputPath}`);
  console.log(`Total channels: ${aggregatedData.metadata.totalChannels}`);
  console.log(`Total videos: ${aggregatedData.metadata.totalVideos}`);
  if (aggregatedData.metadata.totalRecipes > 0) {
    console.log(`Total recipes: ${aggregatedData.metadata.totalRecipes}`);
    console.log(`Videos with recipes: ${aggregatedData.metadata.videosWithRecipes}`);
  }
}

main();
