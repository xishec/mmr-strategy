# Dynamic Data Loading Setup

This document explains how to set up dynamic data loading for the MMR Strategy App, allowing you to update market data without redeploying the application.

## Overview

The app now supports loading JSON data dynamically from remote URLs (like GitHub raw files) instead of bundling the data with the application. This allows you to:

- Update market data every 5 minutes via GitHub Actions
- Refresh data in the app without redeployment
- Fallback to local files if remote loading fails

## Configuration

### 1. Configuration

The repository includes one configuration file:

- **`config.env`** ✅ *Committed to git* - Contains public GitHub URLs for all environments

The configuration variables:
```bash
# GitHub repository raw file URLs for dynamic data loading
REACT_APP_QQQ_DATA_URL=https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/QQQ.json
REACT_APP_TQQQ_DATA_URL=https://raw.githubusercontent.com/xishec/mmr-strategy/main/src/data/TQQQ.json

# Fallback to local files if remote fetch fails
REACT_APP_USE_LOCAL_FALLBACK=true
```

**Note**: These URLs are public GitHub raw file URLs, so they're safe to commit to git.

### 2. GitHub Actions Setup

The GitHub Actions workflow (`.github/workflows/update-data.yml`) is configured to:
- Run every 5 minutes: `cron: "*/5 * * * *"`
- Download fresh market data
- Commit and push changes to the repository

### 3. Data Loading Features

- **Caching**: Data is cached for 5 minutes to avoid excessive API calls
- **Error Handling**: Graceful fallback to local files if remote loading fails
- **Manual Refresh**: Click the refresh button in the app header to get latest data
- **Background Loading**: Non-blocking data updates

## Usage

### For Development
1. Set up your `.env` file with your GitHub repository URLs
2. Run the app normally with `npm start`
3. The app will attempt to load from remote URLs first, then fallback to local files

### For Production
1. Set up your `.env.production` file with your GitHub repository URLs
2. Deploy your app to your hosting platform
3. The app will automatically load fresh data from GitHub every time users refresh

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
│   ├── data-service.ts     # Main data loading service
│   ├── functions.ts        # Updated loadData and refreshData functions
│   └── ...
├── data/
│   ├── QQQ.json           # Local fallback data
│   ├── TQQQ.json          # Local fallback data
│   └── ...
└── ...
```

## Benefits

1. **Real-time Data**: Market data updates every 5 minutes automatically
2. **No Redeployment**: Data updates without application redeployment
3. **Better Performance**: Cached data reduces unnecessary network requests
4. **Reliability**: Local fallback ensures app always works
5. **User Control**: Manual refresh button for immediate updates
