# MMR Strategy - Developer Documentation

This document provides comprehensive technical information for developers working on the MMR Strategy application.

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Charting**: D3.js for interactive financial visualizations
- **UI Framework**: Material-UI components
- **Data Processing**: Python scripts with pandas
- **APIs**: Twelve Data + Yahoo Finance for market data
- **Deployment**: GitHub Actions for automated data updates

### Build System
- **Created with**: Create React App (CRA)
- **Bundle Tool**: Webpack (via CRA)
- **TypeScript**: Strict mode enabled
- **Testing**: Jest + React Testing Library

## 🚀 Development Setup

### Prerequisites
```bash
# Required versions
Node.js >= 16.0.0
npm >= 8.0.0 or yarn >= 1.22.0
Python >= 3.8.0
```

### Local Development
```bash
# Clone and setup
git clone https://github.com/yourusername/mmr-strategy.git
cd mmr-strategy
npm install

# Start development server
npm start
# Opens http://localhost:3000
```

### Python Data Scripts Setup
```bash
cd src/data/script
pip install -r requirements.txt

# Optional: Create .env file for API keys
echo "TWELVEDATA_API_KEY=your_api_key" > .env
```

## 📦 Available Scripts

### Frontend Development
```bash
npm start          # Development server with hot reload
npm test           # Run test suite in watch mode
npm run build      # Production build to build/ folder
npm run eject      # Eject from CRA (⚠️ irreversible)
```

### Data Management
```bash
# In src/data/script/
python download_complete_data.py  # Download complete historical data
python daily_update.py            # Update with latest data
python check_data_quality.py      # Validate data integrity
```

## 🗂️ Code Organization

### Frontend Structure
```
src/
├── components/              # React UI components
│   ├── Chart.tsx           # D3.js financial chart component
│   ├── Dashboard.tsx       # Main dashboard layout
│   ├── InformationBar.tsx  # Data statistics display
│   ├── Legend.tsx          # Chart legend component
│   ├── RatioBox.tsx        # Rate comparison widget
│   ├── SimulationResultsDialog.tsx # Results modal
│   └── SimulationSetup.tsx # Strategy configuration
├── core/                   # Business logic layer
│   ├── constants.ts        # Application constants
│   ├── core-logic.ts       # MMR strategy algorithms
│   ├── data-config.ts      # Data loading configuration
│   ├── data-service.ts     # Remote data fetching service
│   ├── date-utils.ts       # Date manipulation utilities
│   ├── functions.ts        # General utility functions
│   └── models.ts           # TypeScript type definitions
├── hooks/                  # Custom React hooks
│   ├── useChartData.ts     # Chart data management
│   ├── useDateNavigation.ts # Date range controls
│   └── useSimulation.ts    # Strategy simulation logic
└── data/                   # Static data files
    ├── QQQ.json           # QQQ historical data
    ├── TQQQ.json          # TQQQ historical data
    └── script/            # Python data scripts
```

### Backend Scripts Structure
```
src/data/script/
├── download_complete_data.py  # Complete historical download
├── daily_update.py           # Incremental daily updates
├── check_data_quality.py     # Data validation and QA
├── requirements.txt          # Python dependencies
└── __pycache__/             # Compiled Python files
```

## 💾 Data Architecture

### Data Sources
1. **Twelve Data API** (Primary)
   - Higher precision and better coverage
   - Rate limit: 800 calls/day (free tier)
   - Covers most historical periods

2. **Yahoo Finance** (Fallback)
   - Unlimited free access
   - Used for older data and when Twelve Data fails
   - Lower precision but reliable

### Data Models

#### Market Data Structure
```typescript
interface MarketData {
  [date: string]: {
    open: number;           // Adjusted opening price
    close: number;          // Adjusted closing price
    overnight_rate: number; // (open - prev_close) / prev_close * 100
    day_rate: number;       // (close - open) / open * 100
    rate: number;           // (close - prev_close) / prev_close * 100
    sma200: number | null;  // 200-day Simple Moving Average
  }
}
```

#### Rate Calculation Relationships
The three rate types follow a mathematical relationship:
```
Combined Rate = Overnight Rate + Day Rate + (Overnight Rate × Day Rate / 100)
```

This compound interest formula is automatically verified for data quality.

### Data Flow

```
Python Scripts → JSON Files → GitHub → React App
     ↓              ↓           ↓         ↓
API Sources → Local Storage → Raw URLs → Browser Cache
```

## 🔧 Configuration Management

### Data Loading Configuration
**File**: `src/core/data-config.ts`
```typescript
export const DATA_CONFIG = {
  QQQ_DATA_URL: 'https://raw.githubusercontent.com/user/repo/main/src/data/QQQ.json',
  TQQQ_DATA_URL: 'https://raw.githubusercontent.com/user/repo/main/src/data/TQQQ.json',
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  USE_LOCAL_IN_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;
```

### API Configuration
**File**: `src/data/script/.env` (optional)
```bash
TWELVEDATA_API_KEY=your_api_key_here
```

## 🎨 UI Components Deep Dive

### Chart Component (`Chart.tsx`)
- **Technology**: D3.js with React integration
- **Features**: Interactive crosshairs, zoom, pan, hover labels
- **Performance**: Optimized for 6,500+ data points
- **Accessibility**: Keyboard navigation support

#### Key Implementation Details
```typescript
// Crosshair behavior
const handleMouseLeave = () => {
  // Remove hover crosshair when cursor leaves chart
  svg.selectAll('.hover-crosshair').remove();
};

// Z-index handling (DOM order matters in SVG)
// 1. Draw selected crosshair first (background)
// 2. Draw hover crosshair second (foreground)
```

### Data Service (`data-service.ts`)
- **Caching**: 5-minute memory cache to reduce API calls
- **Error Handling**: Graceful fallbacks with user notifications
- **Performance**: Non-blocking async data loading

## 🔄 Data Update Pipeline

### GitHub Actions Workflow
**File**: `.github/workflows/update-data.yml`
```yaml
schedule:
  - cron: "*/5 * * * *"  # Every 5 minutes
```

### Update Process
1. **Trigger**: Cron schedule or manual dispatch
2. **Download**: Python script fetches latest data
3. **Validate**: Quality checks ensure data integrity
4. **Commit**: Updated JSON files pushed to repository
5. **Deploy**: App automatically fetches fresh data

### Local Development Workflow
```bash
# Make data changes
python daily_update.py

# Test changes
npm start

# Verify in browser
# http://localhost:3000
```

## 🧪 Testing Strategy

### Frontend Testing
```bash
npm test                    # Run all tests
npm test -- --coverage     # Generate coverage report
npm test -- --watchAll     # Watch mode for development
```

### Data Quality Testing
```bash
cd src/data/script
python check_data_quality.py
```

#### Test Categories
- **Unit Tests**: Component logic and utilities
- **Integration Tests**: Data service and API interactions
- **Data Quality Tests**: Mathematical verification and precision checks

### Testing Best Practices
- Test rate calculation accuracy
- Verify data loading error handling
- Test chart interactivity
- Validate date range calculations

## 🚀 Deployment

### Production Build
```bash
npm run build
```

Builds optimized production bundle to `build/` folder with:
- Minified JavaScript/CSS
- Asset optimization
- Bundle splitting
- Cache-friendly filenames

### Performance Considerations
- **Bundle Size**: Monitored via webpack-bundle-analyzer
- **Data Caching**: 5-minute cache reduces API load
- **Chart Performance**: Virtualization for large datasets
- **Memory Management**: Cleanup of D3.js event listeners

## 🔍 Debugging

### Common Issues

#### Data Not Loading
```javascript
// Check browser console for errors
console.log('Data config:', DATA_CONFIG);

// Verify API responses
fetch(DATA_CONFIG.QQQ_DATA_URL)
  .then(response => response.json())
  .then(data => console.log('QQQ data loaded:', Object.keys(data).length));
```

#### Chart Rendering Issues
```javascript
// Check D3.js selections
const svg = d3.select('.chart-container svg');
console.log('SVG elements:', svg.selectAll('*').size());

// Verify data binding
console.log('Chart data points:', chartData.length);
```

#### Rate Calculation Verification
```python
# In Python scripts
overnight = (current_open - prev_close) / prev_close * 100
day_rate = (current_close - current_open) / current_open * 100
combined = (current_close - prev_close) / prev_close * 100

# Verify compound relationship
expected_combined = overnight + day_rate + (overnight * day_rate / 100)
assert abs(combined - expected_combined) < 0.000002
```

### Development Tools
- **React DevTools**: Component inspection and profiling
- **Redux DevTools**: State management debugging (if added)
- **Network Tab**: API response inspection
- **Python Debugger**: `pdb.set_trace()` for script debugging

## 📊 Performance Optimization

### Frontend Optimizations
- **React.memo**: Prevent unnecessary re-renders
- **useMemo/useCallback**: Expensive calculation caching
- **Code Splitting**: Lazy loading for large components
- **Service Worker**: Cache static assets (future enhancement)

### Data Processing Optimizations
- **Pandas Vectorization**: Efficient data calculations
- **Memory Management**: Process data in chunks for large datasets
- **API Rate Limiting**: Intelligent delays and retry logic
- **Compression**: Gzip JSON files to reduce transfer size

## 🔐 Security Considerations

### API Security
- **Rate Limiting**: Respect API limits to avoid blocking
- **API Keys**: Store securely in environment variables
- **CORS**: Configure properly for cross-origin requests

### Data Integrity
- **Validation**: Mathematical verification of all calculations
- **Backup Strategy**: Preserve existing data on API failures
- **Version Control**: Track all data changes through git

## 🔄 Recent Updates

### Enhanced Rate Calculations
Updated the Python data scripts to calculate **three separate rate types** instead of just the combined rate:

#### New Rate Fields
- **overnight_rate**: (Current Open - Previous Close) / Previous Close × 100
- **day_rate**: (Current Close - Current Open) / Current Open × 100  
- **rate**: (Current Close - Previous Close) / Previous Close × 100 (unchanged)

#### Mathematical Verification
The three rates are mathematically related by the compound interest formula:
```
Combined Rate = Overnight Rate + Day Rate + (Overnight Rate × Day Rate / 100)
```

### Improved Data Quality
- **Higher Precision**: 6+ decimal places prevent cumulative errors
- **Dual Data Sources**: Twelve Data + Yahoo Finance for reliability
- **Enhanced Validation**: Automated quality checks and mathematical verification
- **Robust Error Handling**: Intelligent fallbacks and retry logic

### Dynamic Data Loading
- **Real-time Updates**: Every 5 minutes via GitHub Actions
- **No Redeployment**: Data updates without app redeployment  
- **Caching Strategy**: 5-minute cache for optimal performance
- **Manual Refresh**: User-controlled data refresh button

### Chart Improvements
- **Crosshair Behavior**: Proper hiding when cursor leaves chart
- **Label Positioning**: Hover labels always appear above persistent ones
- **Performance**: Optimized for 6,500+ data points
- **Accessibility**: Enhanced keyboard navigation

## 🔄 Future Enhancements

### Planned Features
- **Real-time WebSocket Data**: Live market updates
- **Additional Indicators**: RSI, MACD, Bollinger Bands
- **Portfolio Tracking**: Multiple symbol monitoring
- **Strategy Backtesting**: Historical performance analysis
- **Mobile App**: React Native implementation
- **API Authentication**: User-specific data and settings

### Technical Debt
- **Bundle Size Optimization**: Further code splitting
- **Test Coverage**: Increase to 90%+
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance Monitoring**: Real User Metrics (RUM)

## 📚 Resources

### Learning Materials
- [React Documentation](https://reactjs.org/)
- [D3.js Tutorials](https://d3js.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [pandas Documentation](https://pandas.pydata.org/docs/)

### API Documentation
- [Twelve Data API](https://twelvedata.com/docs)
- [Yahoo Finance API](https://pypi.org/project/yfinance/)

### Development Best Practices
- Follow React patterns and conventions
- Use TypeScript strict mode
- Write comprehensive tests
- Document complex algorithms
- Optimize for performance and accessibility

---

*This documentation is maintained alongside the codebase. Please update when making significant changes.*
