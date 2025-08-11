/**
 * Configuration constants for dynamic data loading
 * These URLs point to the latest data files in the GitHub repository
 */

export const DATA_CONFIG = {
  // GitHub repository raw file URLs for dynamic data loading
  QQQ_DATA_URL: 'https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/QQQ.json',
  TQQQ_DATA_URL: 'https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/TQQQ.json',
  
  // Cache duration for market data (5 minutes)
  CACHE_DURATION_MS: 5 * 60 * 1000,
  
  // Use local files in development due to CORS restrictions
  USE_LOCAL_IN_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;
