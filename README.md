# MMR Strategy App

A financial data analysis tool for tracking and analyzing QQQ and TQQQ market movements with dynamic data updates.

## 🚀 Features

- **Interactive Chart Visualization**: D3.js-powered financial charts with crosshairs and hover labels
- **Real-time Data Updates**: Automatic data refresh every 5 minutes via GitHub Actions
- **Dynamic Data Loading**: Fetches fresh market data without app redeployment
- **Advanced Rate Analysis**: Three-tier rate calculation system (overnight, intraday, combined)
- **200-day SMA Tracking**: Simple Moving Average analysis and visualization
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 📊 Data Features

### Rate Calculation Types
- **Overnight Rate**: Gap movements from previous close to current open
- **Day Rate**: Intraday movements from open to close  
- **Combined Rate**: Traditional close-to-close daily returns

### Data Coverage
- **QQQ**: Complete historical data from 1998 to present
- **TQQQ**: Simulated data (1998-2010) + real data (2010+)
- **Update Frequency**: Every 5 minutes during market hours
- **Total Records**: 6,500+ trading days per symbol

## 🌐 Live Demo

The app automatically loads fresh market data from GitHub repository files, ensuring you always see the latest information.

## 🛠️ Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- Python 3.8+ (for data scripts)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/mmr-strategy.git
cd mmr-strategy

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Production Build
```bash
npm run build
```

## 📈 Data Updates

### Automatic Updates
- GitHub Actions runs every 5 minutes
- Downloads latest market data automatically
- Commits updated JSON files to repository
- App fetches fresh data on next cache refresh

### Manual Refresh
Click the refresh icon (🔄) in the app header to immediately fetch the latest data.

## 🔧 Configuration

The app is configured for immediate use with sensible defaults:

- **Data Sources**: GitHub raw files (production) / Local files (development)
- **Cache Duration**: 5 minutes to balance freshness and performance
- **Fallback**: Local files if remote loading fails

## 📁 Project Structure

```
mmr-strategy/
├── src/
│   ├── components/       # React UI components
│   ├── core/            # Business logic and data services
│   ├── data/            # JSON data files
│   └── hooks/           # Custom React hooks
├── src/data/script/     # Python data download scripts
└── build/               # Production build output
```

## 🐍 Data Scripts

### Initial Data Download
```bash
cd src/data/script
pip install -r requirements.txt
python download_complete_data.py
```

### Daily Updates
```bash
python daily_update.py
```

For detailed setup instructions, see [Data Scripts Documentation](src/data/script/README.md).

## 🔍 Data Quality

- **Dual Data Sources**: Twelve Data + Yahoo Finance for reliability
- **High Precision**: 6+ decimal places to prevent cumulative errors
- **Comprehensive Validation**: Automated quality checks and mathematical verification
- **Robust Error Handling**: Intelligent fallbacks and retry logic

## 📱 Usage

1. **Chart Navigation**: Click and drag to select date ranges
2. **Hover Analysis**: Hover over chart points for detailed information
3. **Data Refresh**: Use the refresh button for latest market data
4. **Rate Comparison**: Compare overnight vs intraday movements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆕 Recent Updates

- **Enhanced Rate Calculations**: Three separate rate types for granular analysis
- **Improved Data Quality**: Higher precision and dual data source reliability
- **Dynamic Data Loading**: Real-time updates without app redeployment
- **Better Error Handling**: Comprehensive API failure protection
- **Chart Improvements**: Enhanced crosshair behavior and label positioning