import { config } from 'dotenv';
config({ path: '.env.local' });
import { createRecipePage, isInstacartConfigured } from '../lib/clients/instacartClient';

async function main() {
  console.log('Testing Instacart API...\n');

  // Check if configured
  if (!isInstacartConfigured()) {
    console.error('Error: INSTACART_API environment variable is not set');
    console.log('Make sure .env.local contains INSTACART_API=<your-api-key>');
    process.exit(1);
  }

  console.log('API key found:', process.env.INSTACART_API?.slice(0, 10) + '...');

  // Test request with minimal recipe
  const testRecipe = {
    title: 'Test Recipe',
    ingredients: [
      { name: 'milk' },
      { name: 'eggs' },
      { name: 'butter' },
    ],
  };

  console.log('\nSending test request with recipe:', JSON.stringify(testRecipe, null, 2));

  try {
    const result = await createRecipePage(testRecipe);
    console.log('\nSuccess!');
    console.log('Recipe page URL:', result.products_link_url);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('401')) {
      console.log('\nThe API key appears to be invalid or expired.');
      console.log('Please check your Instacart Developer Platform dashboard:');
      console.log('https://developer.instacart.com/');
    }

    process.exit(1);
  }
}

main();
