# Dynamic Data Loading

The application now supports dynamic data loading from GitHub repository raw files, allowing you to update market data without redeploying the app.

## Configuration

The data loading is configured via environment variables:

- `REACT_APP_QQQ_DATA_URL`: URL to fetch QQQ market data
- `REACT_APP_TQQQ_DATA_URL`: URL to fetch TQQQ market data  
- `REACT_APP_USE_LOCAL_FALLBACK`: Whether to fallback to local files if remote fetch fails

## How it works

1. **Primary**: Fetches data from GitHub raw file URLs
2. **Fallback**: Uses local JSON files if remote fetch fails
3. **Caching**: Data is cached for 5 minutes to reduce API calls
4. **Refresh**: Manual refresh button available in the UI

## Data Update Workflow

1. GitHub Actions runs every 5 minutes (`update-data.yml`)
2. Downloads latest market data using Python scripts
3. Commits updated JSON files to repository
4. App automatically fetches new data on next cache expiry or manual refresh

## Benefits

- **No redeployment needed**: Data updates automatically
- **Always fresh**: 5-minute update frequency
- **Reliable**: Local fallback ensures app always works
- **Fast**: 5-minute caching reduces unnecessary requests
- **User control**: Manual refresh button for immediate updates

## Development vs Production

- **Development**: Uses GitHub URLs with local fallback
- **Production**: Uses GitHub URLs with local fallback
- **Offline**: Falls back to bundled local files

This setup allows for real-time market data updates while maintaining reliability and performance.
