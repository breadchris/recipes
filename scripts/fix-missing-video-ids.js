#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const recipesDir = path.join(__dirname, '../data/youtube-cache/recipes');

// Find all recipe files
function findRecipeFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Check for versions subdirectory
      const versionsDir = path.join(fullPath, 'versions');
      if (fs.existsSync(versionsDir)) {
        const versionFiles = fs.readdirSync(versionsDir);
        for (const vf of versionFiles) {
          if (vf.endsWith('.json')) {
            files.push(path.join(versionsDir, vf));
          }
        }
      }
    } else if (entry.name.endsWith('_recipe.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

const recipeFiles = findRecipeFiles(recipesDir);

let fixed = 0;
let alreadyOk = 0;
let errors = 0;

for (const file of recipeFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const recipe = JSON.parse(content);

    // Extract video ID from filename
    let videoId;
    if (file.includes('/versions/')) {
      // Pattern: recipes/{videoId}/versions/v1.json
      const match = file.match(/recipes\/([^/]+)\/versions\//);
      videoId = match ? match[1] : null;
    } else {
      // Pattern: recipes/{videoId}_recipe.json
      const match = path.basename(file).match(/^(.+)_recipe\.json$/);
      videoId = match ? match[1] : null;
    }

    if (!videoId) {
      console.error(`Could not extract video ID from: ${file}`);
      errors++;
      continue;
    }

    const expectedUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Handle version files that have recipe nested inside
    const recipeData = recipe.recipe || recipe;

    // Check if already has correct values
    if (recipeData.video_id === videoId && recipeData.video_url === expectedUrl) {
      alreadyOk++;
      continue;
    }

    // Fix the fields
    recipeData.video_id = videoId;
    recipeData.video_url = expectedUrl;

    fs.writeFileSync(file, JSON.stringify(recipe, null, 2));
    console.log(`Fixed: ${path.basename(file)} -> ${videoId}`);
    fixed++;
  } catch (err) {
    console.error(`Error processing ${file}: ${err.message}`);
    errors++;
  }
}

console.log(`\nSummary:`);
console.log(`  Fixed: ${fixed}`);
console.log(`  Already OK: ${alreadyOk}`);
console.log(`  Errors: ${errors}`);
console.log(`  Total: ${recipeFiles.length}`);
