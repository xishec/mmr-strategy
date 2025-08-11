# Dynamic Data Loading Setup

This document explains how to set up ### Troubleshooting

### Data Not Loading
1. Check browser console for error messages
2. Verify your GitHub repository URLs are correct and accessible
3. Ensure your repository is public or the URLs are accessible
4. Check if GitHub is experiencing issues

### Rate Limiting
GitHub has rate limits for raw file access:
- Unauthenticated: 60 requests per hour per IP
- The app caches data for 5 minutes to minimize requests
- Consider implementing authentication for higher limits if neededg for the MMR Strategy App, allowing you to update market data without redeploying the application.

## Overview

The app now supports loading JSON data dynamically from remote URLs (like GitHub raw files) instead of bundling the data with the application. This allows you to:

- Update market data every 5 minutes via GitHub Actions
- Refresh data in the app without redeployment
- Fallback to local files if remote loading fails

## Configuration

### 1. Configuration

The configuration is defined in TypeScript constants for type safety and simplicity:

**File: `src/core/data-config.ts`**
```typescript
export const DATA_CONFIG = {
  // GitHub repository raw file URLs for dynamic data loading
  QQQ_DATA_URL: 'https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/QQQ.json',
  TQQQ_DATA_URL: 'https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/TQQQ.json',
  
  // Cache duration for market data (5 minutes)
  CACHE_DURATION_MS: 5 * 60 * 1000,
  
  // Use local files in development due to CORS restrictions
  USE_LOCAL_IN_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;
```

**Benefits of this approach:**
- ✅ **Type Safety**: TypeScript ensures correct usage
- ✅ **No Environment Setup**: Works immediately after clone
- ✅ **Version Controlled**: Configuration changes are tracked in git
- ✅ **IDE Support**: Autocomplete and refactoring support

### 2. GitHub Actions Setup

The GitHub Actions workflow (`.github/workflows/update-data.yml`) is configured to:
- Run every 5 minutes: `cron: "*/5 * * * *"`
- Download fresh market data
- Commit and push changes to the repository

### 3. Data Loading Features

- **Caching**: Data is cached for 5 minutes to avoid excessive API calls
- **Error Handling**: Clear error messages if remote loading fails
- **Manual Refresh**: Click the refresh button in the app header to get latest data
- **Background Loading**: Non-blocking data updates

## Usage

### For Development
- **Local Data**: Uses bundled JSON files due to CORS restrictions on localhost
- **No Setup Required**: Clone and run immediately with `npm start`
- **Refresh Button**: Works but reloads the same local data

### For Production
- **Remote Data**: Automatically fetches fresh data from GitHub URLs
- **Real-time Updates**: Gets the latest data updated by GitHub Actions
- **Manual Refresh**: Fetches fresh data from GitHub on demand

### Manual Data Refresh
- Click the refresh icon (🔄) next to "MMR Strategy App" in the header
- The icon will spin while loading fresh data
- No page reload required

## Troubleshooting

### Data Not Loading
1. Check browser console for error messages
2. Verify your GitHub repository URLs are correct and accessible
3. Ensure your repository is public or the URLs are accessible
4. Check if GitHub is experiencing issues

### Fallback Behavior
If remote loading fails and `REACT_APP_USE_LOCAL_FALLBACK=true`:
- App will use the local JSON files bundled with the app
- A warning message will appear in the browser console
- Consider this a temporary solution while fixing remote access

### Rate Limiting
GitHub has rate limits for raw file access:
- Unauthenticated: 60 requests per hour per IP
- The app caches data for 5 minutes to minimize requests
- Consider implementing authentication for higher limits if needed

## File Structure

```
src/
├── core/
│   ├── data-config.ts      # Configuration constants
│   ├── data-service.ts     # Remote data loading service
│   └── ...
├── data/
│   ├── QQQ.json           # Local data (not used in production)
│   ├── TQQQ.json          # Local data (not used in production)
│   └── ...
└── ...
```

## Benefits

1. **Real-time Data**: Market data updates every 5 minutes automatically
2. **No Redeployment**: Data updates without application redeployment
3. **Better Performance**: Cached data reduces unnecessary network requests
4. **Simplified Architecture**: Direct remote loading without fallback complexity
5. **User Control**: Manual refresh button for immediate updates
