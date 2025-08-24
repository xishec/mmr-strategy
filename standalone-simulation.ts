#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { runSingleSimulation } from './src/core/core-logic';
import { MarketData, Simulation, SignalType } from './src/core/models';

/**
 * Standalone script to run a single simulation with default variables from useSimulation
 * Can be executed from command line with: npx tsx standalone-simulation.ts
 */

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
 * Main function to run the simulation
 */
async function runStandaloneSimulation() {
  try {
    console.log("=== MMR Strategy Standalone Simulation ===\n");
    
    // Load market data
    const marketData = await loadMarketData();
    
    // Calculate SMA and MaxClose
    console.log("Calculating SMA200 and MaxClose values...");
    calculateSMAAndMaxClose(marketData);
    
    // Get date range from market data
    const qqqDates = Object.keys(marketData.QQQ).sort();
    const startDate = qqqDates[0];
    const endDate = qqqDates[qqqDates.length - 1];
    
    console.log(`Data range: ${startDate} to ${endDate}`);
    console.log(`Total trading days: ${qqqDates.length}\n`);
    
    // Create simulation with default variables
    const simulation: Simulation = {
      portfolioSnapshots: [],
      simulationVariables: {
        ...DEFAULT_SIMULATION_VARIABLES,
        startDate,
        endDate,
      },
      report: {
        orders: [],
      },
    };
    
    console.log("Simulation Parameters:");
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
    }
    
    // Show final portfolio values
    if (result.portfolioSnapshots.length > 0) {
      const finalSnapshot = result.portfolioSnapshots[result.portfolioSnapshots.length - 1];
      console.log(`\nFinal Portfolio Value: ${formatCurrency(finalSnapshot.investments.total)}`);
      console.log(`Final QQQ Comparison: ${formatCurrency(finalSnapshot.investments.mockTotalQQQ)}`);
      console.log(`Final TQQQ Comparison: ${formatCurrency(finalSnapshot.investments.mockTotalTQQQ)}`);
      console.log(`Cash Position: ${formatCurrency(finalSnapshot.investments.cash)}`);
      console.log(`TQQQ Position: ${formatCurrency(finalSnapshot.investments.TQQQ)}`);
      console.log(`Current Pullback: ${formatPercentage(-finalSnapshot.pullback)}`);
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
        console.log(`${order.date}: ${action} - ${formatCurrency(order.currentTotal)}`);
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
  runStandaloneSimulation();
}

export { runStandaloneSimulation };
