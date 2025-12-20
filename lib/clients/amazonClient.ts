import amazonPaapi from 'amazon-paapi';
import type { Ingredient } from '../types';

const commonParameters = {
  AccessKey: process.env.AMAZON_PAAPI_ACCESS_KEY || '',
  SecretKey: process.env.AMAZON_PAAPI_SECRET_KEY || '',
  PartnerTag: process.env.AMAZON_ASSOCIATE_TAG || '',
  PartnerType: 'Associates' as const,
  Marketplace: 'www.amazon.com',
};

export interface ProductSearchResult {
  asin: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

export interface IngredientSearchResult {
  ingredient: Ingredient;
  product: ProductSearchResult | null;
  error?: string;
}

/**
 * Search for a single product on Amazon
 */
export async function searchProduct(query: string): Promise<ProductSearchResult | null> {
  try {
    const requestParameters = {
      Keywords: query,
      SearchIndex: 'Grocery',
      ItemCount: 1,
      Resources: [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Images.Primary.Medium',
      ],
    };

    const response = await amazonPaapi.SearchItems(commonParameters, requestParameters);

    if (response.SearchResult?.Items?.[0]) {
      const item = response.SearchResult.Items[0];
      return {
        asin: item.ASIN,
        title: item.ItemInfo?.Title?.DisplayValue || query,
        price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount,
        imageUrl: item.Images?.Primary?.Medium?.URL,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    return null;
  }
}

/**
 * Search for multiple ingredients on Amazon
 */
export async function searchIngredients(
  ingredients: Ingredient[]
): Promise<IngredientSearchResult[]> {
  const results: IngredientSearchResult[] = [];

  // Process ingredients sequentially to avoid rate limiting
  for (const ingredient of ingredients) {
    const searchQuery = ingredient.item;

    try {
      const product = await searchProduct(searchQuery);
      results.push({
        ingredient,
        product,
      });
    } catch (error) {
      results.push({
        ingredient,
        product: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Small delay to avoid rate limiting (1 TPS limit for PAAPI)
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  return results;
}

/**
 * Generate Amazon Add-to-Cart URL from ASINs
 */
export function generateAddToCartUrl(asins: string[]): string {
  const associateTag = process.env.AMAZON_ASSOCIATE_TAG || '';
  const baseUrl = 'https://www.amazon.com/gp/aws/cart/add.html';

  const params = new URLSearchParams();
  params.append('AssociateTag', associateTag);

  asins.forEach((asin, index) => {
    const num = index + 1;
    params.append(`ASIN.${num}`, asin);
    params.append(`Quantity.${num}`, '1');
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Check if Amazon PAAPI is configured
 */
export function isAmazonConfigured(): boolean {
  return !!(
    process.env.AMAZON_PAAPI_ACCESS_KEY &&
    process.env.AMAZON_PAAPI_SECRET_KEY &&
    process.env.AMAZON_ASSOCIATE_TAG
  );
}
