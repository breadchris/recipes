import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['amazon-paapi', 'openai'],

  // Exclude large data files from serverless function bundles
  outputFileTracingExcludes: {
    '*': [
      './data/pipeline/**',
      './data/youtube-cache/**',
      './data/scrape/**',
      './data/fooddata/**',
      './data/recipes-data.json.gz',
      './data/scraped-recipes-lookup.json.gz',
      './data/scraped-recipes-lookup.json',
      './data/search-index.json',
      './data/food-type-index.json',
    ],
  },

  // Exclude admin routes in production to reduce serverless function count
  async rewrites() {
    if (process.env.VERCEL) {
      return {
        beforeFiles: [
          { source: '/api/admin/:path*', destination: '/404' },
        ],
        afterFiles: [],
        fallback: [],
      };
    }
    return { beforeFiles: [], afterFiles: [], fallback: [] };
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi_webp/**',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static01.nyt.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.epicurious.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
