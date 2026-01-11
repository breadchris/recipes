import Typesense from 'typesense';

// Typesense client for search operations (uses search-only API key)
export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || '',
      port: parseInt(process.env.TYPESENSE_PORT || '443'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    },
  ],
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY || '',
  connectionTimeoutSeconds: 2,
});

// Typesense admin client for indexing operations (uses admin API key)
export const typesenseAdminClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || '',
      port: parseInt(process.env.TYPESENSE_PORT || '443'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || '',
  connectionTimeoutSeconds: 10,
});

export const COLLECTION_NAME = 'recipes';
export const SCRAPED_COLLECTION_NAME = 'scraped-recipes';
