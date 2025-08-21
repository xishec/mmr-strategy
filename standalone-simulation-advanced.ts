#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { runSingleSimulation } from './src/core/core-logic';
import { MarketData, Simulation, SignalType } from './src/core/models';

/**
 * Advanced standalone script to run a single simulation with customizable parameters
 * Can be executed from command line with: npx tsx standalone-simulation-advanced.ts [options]
 * 
 * Options:
 *   --initial-money <amount>     Initial investment amount (default: 200000)
 *   --monthly-cash <amount>      Monthly new cash injection (default: 0)
 *   --start-date <YYYY-MM-DD>    Start date for simulation (default: first available)
 *   --end-date <YYYY-MM-DD>      End date for simulation (default: last available)
 *   --cash-rate <percentage>     Annual cash rate percentage (default: 2000)
 *   --sma-up-margin <decimal>    SMA up margin (default: 0.0)
 *   --sma-down-margin <decimal>  SMA down margin (default: 0.0)
 *   --buy-at-open <true/false>   Buy at market open (default: true)
 *   --help                       Show help message
 */

interface CommandLineOptions {
  initialMoney?: number;
  monthlyCash?: number;
  startDate?: string;
  endDate?: string;
  cashRate?: number;
  smaUpMargin?: number;
  smaDownMargin?: number;
  buyAtOpen?: boolean;
  help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): CommandLineOptions {
  const args = process.argv.slice(2);
  const options: CommandLineOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--initial-money':
        options.initialMoney = parseFloat(args[++i]);
        break;
      case '--monthly-cash':
        options.monthlyCash = parseFloat(args[++i]);
        break;
      case '--start-date':
        options.startDate = args[++i];
        break;
      case '--end-date':
        options.endDate = args[++i];
        break;
      case '--cash-rate':
        options.cashRate = parseFloat(args[++i]);
        break;
      case '--sma-up-margin':
        options.smaUpMargin = parseFloat(args[++i]);
        break;
      case '--sma-down-margin':
        options.smaDownMargin = parseFloat(args[++i]);
        break;
      case '--buy-at-open':
        options.buyAtOpen = args[++i].toLowerCase() === 'true';
        break;
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
MMR Strategy Standalone Simulation (Advanced)

Usage: npx tsx standalone-simulation-advanced.ts [options]

Options:
  --initial-money <amount>     Initial investment amount (default: 200000)
  --monthly-cash <amount>      Monthly new cash injection (default: 0)
  --start-date <YYYY-MM-DD>    Start date for simulation (default: first available)
  --end-date <YYYY-MM-DD>      End date for simulation (default: last available)
  --cash-rate <percentage>     Annual cash rate percentage (default: 2000)
  --sma-up-margin <decimal>    SMA up margin (default: 0.0)
  --sma-down-margin <decimal>  SMA down margin (default: 0.0)
  --buy-at-open <true/false>   Buy at market open (default: true)
  --help, -h                   Show this help message

Examples:
  npx tsx standalone-simulation-advanced.ts --initial-money 100000 --monthly-cash 1000
  npx tsx standalone-simulation-advanced.ts --start-date 2020-01-01 --end-date 2023-12-31
  npx tsx standalone-simulation-advanced.ts --sma-up-margin 0.05 --sma-down-margin -0.05
`);
}

// Default variables from useSimulation hook
const DEFAULT_SIMULATION_VARIABLES = {
  initialMoney: 200000,
  cashYearRate: 2000,
  SMAUpMargin: 0.0,
  SMADownMargin: -0.0,
  monthlyNewCash: 0,
  buyAtOpen: true,
};

/**
 * Calculate SMA200 and maxClose for market data
 * This replicates the calculateSMAAndMaxClose function from functions.ts
 */
function calculateSMAAndMaxClose(marketData: MarketData): void {
  // Process QQQ data
  const qqqDates = Object.keys(marketData.QQQ);
  const qqqClosePrices: number[] = [];
  let qqqMaxClose = 0;

  qqqDates.forEach((date, index) => {
    const dailyData = marketData.QQQ[date];
    qqqClosePrices.push(dailyData.close);
    
    // Update maxClose (maximum close price since beginning)
    qqqMaxClose = Math.max(qqqMaxClose, dailyData.close);
    dailyData.maxClose = qqqMaxClose;
    
    // Calculate SMA200 (need at least 200 days)
    if (index >= 199) {
      const sma200 = qqqClosePrices.slice(index - 199, index + 1).reduce((sum, price) => sum + price, 0) / 200;
      dailyData.sma = sma200;
    } else {
      dailyData.sma = null;
    }
  });

  // Process TQQQ data
  const tqqqDates = Object.keys(marketData.TQQQ);
  const tqqqClosePrices: number[] = [];
  let tqqqMaxClose = 0;

  tqqqDates.forEach((date, index) => {
    const dailyData = marketData.TQQQ[date];
    tqqqClosePrices.push(dailyData.close);
    
    // Update maxClose (maximum close price since beginning)
    tqqqMaxClose = Math.max(tqqqMaxClose, dailyData.close);
    dailyData.maxClose = tqqqMaxClose;
    
    // Calculate SMA200 (need at least 200 days)
    if (index >= 199) {
      const sma200 = tqqqClosePrices.slice(index - 199, index + 1).reduce((sum, price) => sum + price, 0) / 200;
      dailyData.sma = sma200;
    } else {
      dailyData.sma = null;
    }
  });
}

/**
 * Load market data from local JSON files
 */
async function loadMarketData(): Promise<MarketData> {
  try {
    console.log("Loading market data from local files...");
    
    const qqqPath = path.join(__dirname, 'src', 'data', 'QQQ.json');
    const tqqqPath = path.join(__dirname, 'src', 'data', 'TQQQ.json');
    
    const rawQQQData = JSON.parse(fs.readFileSync(qqqPath, 'utf8'));
    const rawTQQQData = JSON.parse(fs.readFileSync(tqqqPath, 'utf8'));
    
    // Transform raw data to include sma and maxClose properties
    const transformedQQQData: Record<string, any> = {};
    for (const [date, data] of Object.entries(rawQQQData)) {
      transformedQQQData[date] = {
        ...(data as any),
        sma: null,
        maxClose: null,
      };
    }
    
    const transformedTQQQData: Record<string, any> = {};
    for (const [date, data] of Object.entries(rawTQQQData)) {
      transformedTQQQData[date] = {
        ...(data as any),
        sma: null,
        maxClose: null,
      };
    }
    
    const marketData = {
      QQQ: transformedQQQData,
      TQQQ: transformedTQQQData,
    };
    
    console.log("Successfully loaded market data from local files");
    return marketData;
  } catch (error) {
    console.error("Failed to load market data:", error);
    throw new Error("Failed to load market data from local files");
  }
}

/**
 * Format number as percentage
 */
function formatPercentage(num: number): string {
  return (num * 100).toFixed(2) + '%';
}

/**
 * Format number as currency
 */
function formatCurrency(num: number): string {
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Validate date format
 */
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 10) === dateString;
}

/**
 * Main function to run the simulation
 */
async function runAdvancedStandaloneSimulation() {
  const options = parseArguments();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    console.log("=== MMR Strategy Standalone Simulation (Advanced) ===\n");
    
    // Load market data
    const marketData = await loadMarketData();
    
    // Calculate SMA and MaxClose
    console.log("Calculating SMA200 and MaxClose values...");
    calculateSMAAndMaxClose(marketData);
    
    // Get date range from market data
    const qqqDates = Object.keys(marketData.QQQ).sort();
    const dataStartDate = qqqDates[0];
    const dataEndDate = qqqDates[qqqDates.length - 1];
    
    console.log(`Available data range: ${dataStartDate} to ${dataEndDate}`);
    console.log(`Total trading days in dataset: ${qqqDates.length}\n`);
    
    // Validate and set date range
    const startDate = options.startDate || dataStartDate;
    const endDate = options.endDate || dataEndDate;
    
    if (options.startDate && !isValidDate(options.startDate)) {
      throw new Error(`Invalid start date format: ${options.startDate}. Use YYYY-MM-DD format.`);
    }
    if (options.endDate && !isValidDate(options.endDate)) {
      throw new Error(`Invalid end date format: ${options.endDate}. Use YYYY-MM-DD format.`);
    }
    if (startDate >= endDate) {
      throw new Error("Start date must be before end date.");
    }
    if (startDate < dataStartDate || endDate > dataEndDate) {
      throw new Error(`Date range must be within available data range: ${dataStartDate} to ${dataEndDate}`);
    }
    
    // Create simulation with custom or default variables
    const simulation: Simulation = {
      portfolioSnapshots: [],
      simulationVariables: {
        initialMoney: options.initialMoney ?? DEFAULT_SIMULATION_VARIABLES.initialMoney,
        startDate,
        endDate,
        cashYearRate: options.cashRate ?? DEFAULT_SIMULATION_VARIABLES.cashYearRate,
        SMAUpMargin: options.smaUpMargin ?? DEFAULT_SIMULATION_VARIABLES.SMAUpMargin,
        SMADownMargin: options.smaDownMargin ?? DEFAULT_SIMULATION_VARIABLES.SMADownMargin,
        monthlyNewCash: options.monthlyCash ?? DEFAULT_SIMULATION_VARIABLES.monthlyNewCash,
        buyAtOpen: options.buyAtOpen ?? DEFAULT_SIMULATION_VARIABLES.buyAtOpen,
      },
      report: {
        orders: [],
      },
    };
    
    // Calculate actual trading days in simulation range
    const simulationDates = qqqDates.filter(date => date > startDate && date <= endDate);
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const simulationYears = (new Date(endDate).getTime() - new Date(startDate).getTime()) / millisecondsPerYear;
    
    console.log("Simulation Parameters:");
    console.log(`Date Range: ${startDate} to ${endDate} (${simulationYears.toFixed(1)} years)`);
    console.log(`Trading Days: ${simulationDates.length}`);
    console.log(`Initial Money: ${formatCurrency(simulation.simulationVariables.initialMoney)}`);
    console.log(`Monthly New Cash: ${formatCurrency(simulation.simulationVariables.monthlyNewCash)}`);
    console.log(`Cash Year Rate: ${simulation.simulationVariables.cashYearRate}%`);
    console.log(`SMA Up Margin: ${formatPercentage(simulation.simulationVariables.SMAUpMargin)}`);
    console.log(`SMA Down Margin: ${formatPercentage(simulation.simulationVariables.SMADownMargin)}`);
    console.log(`Buy at Open: ${simulation.simulationVariables.buyAtOpen}\n`);
    
    // Run the simulation
    console.log("Running simulation...");
    const startTime = Date.now();
    const result = runSingleSimulation(simulation, marketData);
    const endTime = Date.now();
    
    console.log(`Simulation completed in ${endTime - startTime}ms\n`);
    
    // Display results
    if (result.simulationResults) {
      console.log("=== SIMULATION RESULTS ===");
      console.log(`Strategy Annualized Return: ${formatPercentage(result.simulationResults.annualizedStrategyRate)}`);
      console.log(`QQQ Annualized Return: ${formatPercentage(result.simulationResults.annualizedQQQRate)}`);
      console.log(`TQQQ Annualized Return: ${formatPercentage(result.simulationResults.annualizedTQQQRate)}`);
      
      const { annualizedStrategyRate, annualizedQQQRate, annualizedTQQQRate } = result.simulationResults;
      const strategyVsQQQ = annualizedStrategyRate - annualizedQQQRate;
      const strategyVsTQQQ = annualizedStrategyRate - annualizedTQQQRate;
      console.log(`Strategy vs QQQ: ${strategyVsQQQ >= 0 ? '+' : ''}${formatPercentage(strategyVsQQQ)}`);
      console.log(`Strategy vs TQQQ: ${strategyVsTQQQ >= 0 ? '+' : ''}${formatPercentage(strategyVsTQQQ)}`);
    }
    
    // Show final portfolio values
    if (result.portfolioSnapshots.length > 0) {
      const finalSnapshot = result.portfolioSnapshots[result.portfolioSnapshots.length - 1];
      const totalReturn = (finalSnapshot.investments.total / simulation.simulationVariables.initialMoney - 1);
      
      console.log(`\n=== PORTFOLIO PERFORMANCE ===`);
      console.log(`Final Portfolio Value: ${formatCurrency(finalSnapshot.investments.total)}`);
      console.log(`Total Return: ${formatPercentage(totalReturn)}`);
      console.log(`Final QQQ Comparison: ${formatCurrency(finalSnapshot.investments.mockTotalQQQ)}`);
      console.log(`Final TQQQ Comparison: ${formatCurrency(finalSnapshot.investments.mockTotalTQQQ)}`);
      console.log(`Current Cash Position: ${formatCurrency(finalSnapshot.investments.cash)}`);
      console.log(`Current TQQQ Position: ${formatCurrency(finalSnapshot.investments.TQQQ)}`);
      console.log(`Maximum Drawdown: ${formatPercentage(-finalSnapshot.pullback)}`);
      console.log(`Current Signal: ${finalSnapshot.signal.signalType}`);
    }
    
    // Show trade statistics
    if (result.report.tradeStatistics) {
      const stats = result.report.tradeStatistics;
      console.log(`\n=== TRADE STATISTICS ===`);
      console.log(`Total Trades: ${stats.totalTrades}`);
      console.log(`Average Trades per Year: ${stats.tradesPerYear.average.toFixed(1)}`);
      console.log(`Min Trades per Year: ${stats.tradesPerYear.min}`);
      console.log(`Max Trades per Year: ${stats.tradesPerYear.max}`);
    }
    
    // Show recent orders
    if (result.report.orders.length > 0) {
      console.log(`\n=== RECENT ORDERS (Last 10) ===`);
      const recentOrders = result.report.orders.slice(-10);
      recentOrders.forEach(order => {
        const action = order.type === SignalType.Buy ? "BUY " : "SELL";
        console.log(`${order.date}: ${action} - ${formatCurrency(order.deltaMoney)}`);
      });
    }
    
    console.log(`\n=== Simulation Complete ===`);
    
  } catch (error) {
    console.error("Error running simulation:", error);
    process.exit(1);
  }
}

// Run the simulation if this file is executed directly
if (require.main === module) {
  runAdvancedStandaloneSimulation();
}

export { runAdvancedStandaloneSimulation };
