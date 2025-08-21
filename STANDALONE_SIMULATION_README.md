# Standalone MMR Strategy Simulation Scripts

This directory contains standalone TypeScript scripts that allow you to run MMR strategy simulations from the command line without needing to start the full React application.

## Prerequisites

Make sure you have Node.js installed, then install `tsx` globally:

```bash
npm install -g tsx
```

## Basic Standalone Simulation

The `standalone-simulation.ts` script runs a simulation with the default parameters from the `useSimulation` hook.

### Usage

```bash
npx tsx standalone-simulation.ts
```

### Default Parameters

- Initial Money: $200,000
- Monthly New Cash: $0
- Cash Year Rate: 2000%
- SMA Up Margin: 0.0%
- SMA Down Margin: 0.0%
- Buy at Open: true
- Date Range: Full available dataset (1999-03-10 to present)

### Example Output

```
=== MMR Strategy Standalone Simulation ===

Loading market data from local files...
Successfully loaded market data from local files
Calculating SMA200 and MaxClose values...
Data range: 1999-03-10 to 2025-08-20
Total trading days: 6653

Simulation Parameters:
Initial Money: $200,000.00
Monthly New Cash: $0.00
Cash Year Rate: 2000%
SMA Up Margin: 0.00%
SMA Down Margin: 0.00%
Buy at Open: true

Running simulation...
Simulation completed in 108ms

=== SIMULATION RESULTS ===
Strategy Annualized Return: 47.26%
QQQ Annualized Return: 10.21%
TQQQ Annualized Return: 0.49%

Final Portfolio Value: $5,576,793,522.81
Final QQQ Comparison: $2,617,506.27
Final TQQQ Comparison: $227,464.63
```

## Advanced Standalone Simulation

The `standalone-simulation-advanced.ts` script allows customization of all simulation parameters through command-line arguments.

### Usage

```bash
npx tsx standalone-simulation-advanced.ts [options]
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--initial-money <amount>` | Initial investment amount | 200000 |
| `--monthly-cash <amount>` | Monthly new cash injection | 0 |
| `--start-date <YYYY-MM-DD>` | Start date for simulation | First available |
| `--end-date <YYYY-MM-DD>` | End date for simulation | Last available |
| `--cash-rate <percentage>` | Annual cash rate percentage | 2000 |
| `--sma-up-margin <decimal>` | SMA up margin | 0.0 |
| `--sma-down-margin <decimal>` | SMA down margin | 0.0 |
| `--buy-at-open <true/false>` | Buy at market open | true |
| `--help`, `-h` | Show help message | - |

### Examples

1. **Run simulation with custom initial money and date range:**
   ```bash
   npx tsx standalone-simulation-advanced.ts --initial-money 100000 --start-date 2020-01-01 --end-date 2023-12-31
   ```

2. **Add monthly cash injections:**
   ```bash
   npx tsx standalone-simulation-advanced.ts --initial-money 50000 --monthly-cash 1000
   ```

3. **Adjust SMA margins:**
   ```bash
   npx tsx standalone-simulation-advanced.ts --sma-up-margin 0.05 --sma-down-margin -0.05
   ```

4. **Test different cash rates:**
   ```bash
   npx tsx standalone-simulation-advanced.ts --cash-rate 5000 --buy-at-open false
   ```

5. **Show help:**
   ```bash
   npx tsx standalone-simulation-advanced.ts --help
   ```

### Advanced Output Features

The advanced script provides additional information:

- **Performance Comparison**: Shows strategy vs QQQ and TQQQ performance
- **Portfolio Breakdown**: Current cash and TQQQ positions
- **Trading Activity**: Detailed trade statistics
- **Signal Information**: Current market signal
- **Validation**: Date range and parameter validation

```
=== SIMULATION RESULTS ===
Strategy Annualized Return: 73.76%
QQQ Annualized Return: 18.62%
TQQQ Annualized Return: 24.46%
Strategy vs QQQ: +55.14%
Strategy vs TQQQ: +49.30%

=== PORTFOLIO PERFORMANCE ===
Final Portfolio Value: $907,518.08
Total Return: 807.52%
Final QQQ Comparison: $197,713.65
Final TQQQ Comparison: $239,508.75
Current Cash Position: $0.00
Current TQQQ Position: $907,518.08
Maximum Drawdown: 1.63%
Current Signal: hold
```

## Data Requirements

Both scripts require the following JSON data files to be present:
- `src/data/QQQ.json`
- `src/data/TQQQ.json`

These files contain historical market data with the following structure:
```json
{
  "YYYY-MM-DD": {
    "rate": 1.23,
    "close": 456.78,
    "overnight_rate": 0.45,
    "day_rate": 0.78
  }
}
```

## Technical Details

### What the Scripts Do

1. **Load Data**: Read market data from local JSON files
2. **Calculate Indicators**: Compute SMA200 and maxClose values for all data points
3. **Run Simulation**: Execute the MMR strategy using `runSingleSimulation` from core-logic.ts
4. **Display Results**: Show comprehensive performance metrics and trade statistics

### Key Functions Used

- `runSingleSimulation()` - Core simulation logic from `src/core/core-logic.ts`
- `calculateAnnualizedRates()` - Performance calculation (called internally)
- `calculateTradeStatistics()` - Trading activity analysis (called internally)

### Performance

Simulations typically complete in under 200ms for the full dataset (26+ years of data).

## Error Handling

The scripts include comprehensive error handling for:
- Invalid date formats
- Date ranges outside available data
- Missing or corrupted data files
- Invalid parameter values
- File system access issues

## Integration

These scripts can be easily integrated into:
- CI/CD pipelines for strategy backtesting
- Automated reporting systems
- Research and analysis workflows
- Batch parameter optimization studies

## Extending the Scripts

To add new parameters or modify behavior:

1. Add the parameter to the `CommandLineOptions` interface
2. Update the argument parsing logic in `parseArguments()`
3. Add the parameter to the help message
4. Use the parameter in the simulation variables

Example:
```typescript
// Add to CommandLineOptions
interface CommandLineOptions {
  // ... existing options
  customParameter?: number;
}

// Add to parseArguments()
case '--custom-parameter':
  options.customParameter = parseFloat(args[++i]);
  break;

// Use in simulation
simulationVariables: {
  // ... existing variables
  customValue: options.customParameter ?? DEFAULT_VALUE,
}
```
