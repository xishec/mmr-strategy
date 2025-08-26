import { runSingleSimulation } from "./core-logic";
import { DashboardVariables, MarketData, MultiSimulationResults, PortfolioSnapshot, Simulation } from "./models";
import { addDays, yearsBetween, addYears, today } from "./date-utils";
import { TIME_CONSTANTS } from "./constants";
import { DataService } from "./data-service";

const calculateSMAAndMaxClose = (marketData: MarketData) => {
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
};

export const loadData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData) => void
) => {
  try {
    setDataLoading(true);
    const dataService = DataService.getInstance();
    const marketData = await dataService.loadMarketData();
    
    // Calculate SMA200 and maxClose for all market data
    calculateSMAAndMaxClose(marketData);
    
    setMarketData(marketData);
  } catch (error) {
    console.error("Error loading data:", error);
    // You could show a user-friendly error message here
    throw error;
  } finally {
    setDataLoading(false);
  }
};

export const refreshData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData) => void
) => {
  try {
    setDataLoading(true);
    const dataService = DataService.getInstance();
    const marketData = await dataService.refreshData();
    
    // Calculate SMA200 and maxClose for all market data
    calculateSMAAndMaxClose(marketData);
    
    setMarketData(marketData);
  } catch (error) {
    console.error("Error refreshing data:", error);
    throw error;
  } finally {
    setDataLoading(false);
  }
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  setSimulation(runSingleSimulation(simulation, marketData));
};

export const calculateAnnualizedRate = (
  initial: number,
  end: number,
  initialDateString: string,
  endDateString: string
): number => {
  const nbYears = yearsBetween(initialDateString, endDateString);

  // Ensure we have at least some time period to avoid division by zero
  if (nbYears <= 0) {
    return 0;
  }

  return (end / initial) ** (1 / nbYears) - 1;
};

export const calculateAnnualizedRates = (simulation: Simulation) => {
  // Safety check: ensure we have portfolio snapshots before calculating rates
  if (simulation.portfolioSnapshots.length === 0) {
    simulation.simulationResults = {
      annualizedStrategyRate: 0,
      annualizedQQQRate: 0,
      annualizedTQQQRate: 0,
    };
    return;
  }

  const endDate = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].date;
  const lastPortfolioSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];

  simulation.simulationResults = {
    annualizedStrategyRate: calculateAnnualizedRate(
      lastPortfolioSnapshot.investments.mockTotalNothing,
      simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.total,
      simulation.simulationVariables.startDate,
      endDate
    ),
    annualizedQQQRate: calculateAnnualizedRate(
      lastPortfolioSnapshot.investments.mockTotalNothing,
      simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalQQQ,
      simulation.simulationVariables.startDate,
      endDate
    ),
    annualizedTQQQRate: calculateAnnualizedRate(
      lastPortfolioSnapshot.investments.mockTotalNothing,
      simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalTQQQ,
      simulation.simulationVariables.startDate,
      endDate
    ),
  };
};

export const calculateTradeStatistics = (simulation: Simulation) => {
  const totalTrades = simulation.report.orders.length;
  
  if (totalTrades === 0) {
    simulation.report.tradeStatistics = {
      totalTrades: 0,
      tradesPerYear: {
        average: 0,
        min: 0,
        max: 0,
      },
    };
    return;
  }

  // Calculate the total duration of the simulation in years
  const totalYears = yearsBetween(simulation.simulationVariables.startDate, simulation.simulationVariables.endDate);
  
  if (totalYears <= 0) {
    simulation.report.tradeStatistics = {
      totalTrades,
      tradesPerYear: {
        average: 0,
        min: 0,
        max: 0,
      },
    };
    return;
  }

  // Group trades by year
  const tradesByYear: Record<string, number> = {};
  
  simulation.report.orders.forEach(order => {
    const year = order.date.substring(0, 4); // Extract year from date (YYYY-MM-DD format)
    tradesByYear[year] = (tradesByYear[year] || 0) + 1;
  });
  
  const tradesPerYearValues = Object.values(tradesByYear);
  const averageTradesPerYear = totalTrades / totalYears;
  const minTradesPerYear = tradesPerYearValues.length > 0 ? Math.min(...tradesPerYearValues) : 0;
  const maxTradesPerYear = tradesPerYearValues.length > 0 ? Math.max(...tradesPerYearValues) : 0;

  simulation.report.tradeStatistics = {
    totalTrades,
    tradesPerYear: {
      average: Number(averageTradesPerYear.toFixed(2)),
      min: minTradesPerYear,
      max: maxTradesPerYear,
    },
  };
};

export const deepCopyPortfolioSnapshot = (snapshot: PortfolioSnapshot): PortfolioSnapshot => {
  return {
    ...snapshot,
    investments: {
      ...snapshot.investments,
    },
  };
};

export const convertAnnualRateToDaily = (annualRate: number): number => {
  return Math.pow(1 + annualRate, 1 / TIME_CONSTANTS.DAYS_IN_YEAR) - 1;
};

export const runMultipleSimulations = async (
  dashboardVariables: DashboardVariables,
  marketData: MarketData
): Promise<MultiSimulationResults> => {
  // Yield once at the start to allow UI to update loading state
  await new Promise((resolve) => setTimeout(resolve, 0));
  
  // Only store essential data to minimize memory usage
  const strategyRates: number[] = [];
  const qqqRates: number[] = [];
  const tqqqRates: number[] = [];
  const startDates: string[] = [];

  // Pre-compute and cache sorted available dates
  const availableDates = Object.keys(marketData.TQQQ);
  const firstAvailableDate = availableDates[0];
  const lastAvailableDate = availableDates[availableDates.length - 1];

  // Start from the first available date or 2000-01-01, whichever is later
  const startDate = firstAvailableDate >= "2000-01-01" ? firstAvailableDate : "2000-01-01";
  const todayString = today();

  const endDate = addYears(
    lastAvailableDate,
    -dashboardVariables.multiSimulationVariables.simulationAnalysisMinusYears
  );
  const finalDate = endDate < todayString ? endDate : todayString;

  // Pre-compute simulation parameters
  const simulationFrequencyDays = dashboardVariables.multiSimulationVariables.simulationFrequencyDays;
  const simulationDurationYears = dashboardVariables.multiSimulationVariables.simulationDurationYears;
  const simulationVariables = dashboardVariables.simulationVariables;

  let currentDateString = startDate;
  let simulationCount = 0;
  let loopIterations = 0;

  while (currentDateString <= finalDate) {
    loopIterations++;

    // Use binary search to find next available date more efficiently
    const nextAvailableDate = findNextAvailableDate(availableDates, currentDateString);

    if (nextAvailableDate && nextAvailableDate <= finalDate) {
      try {
        // Check if we have at least minimum required days of data after the start date
        const minEndDate = addDays(nextAvailableDate, TIME_CONSTANTS.MIN_DATA_DAYS);
        const hasEnoughData = lastAvailableDate >= minEndDate;

        if (hasEnoughData) {
          // Calculate end date for this simulation
          const simulationEndDateString = addYears(nextAvailableDate, simulationDurationYears);

          // Create minimal simulation configuration
          const simulation: Simulation = {
            portfolioSnapshots: [],
            simulationVariables: {
              ...simulationVariables,
              startDate: nextAvailableDate,
              endDate: simulationEndDateString,
            },
            report: {
              orders: [],
            },
          };

          // Run the simulation using the existing logic
          const completedSimulation = runSingleSimulation(simulation, marketData);

          if (completedSimulation.portfolioSnapshots.length > 0 && completedSimulation.simulationResults) {
            // Extract only the essential data we need
            strategyRates.push(completedSimulation.simulationResults.annualizedStrategyRate);
            qqqRates.push(completedSimulation.simulationResults.annualizedQQQRate);
            tqqqRates.push(completedSimulation.simulationResults.annualizedTQQQRate);
            startDates.push(nextAvailableDate);
            simulationCount++;

            // Immediately clear simulation data to free memory
            completedSimulation.portfolioSnapshots.length = 0;
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    currentDateString = addDays(currentDateString, simulationFrequencyDays);

    // Periodic yielding to prevent "Page Unresponsive" dialog
    // Less frequent than before but enough to keep the browser happy
    if (loopIterations % 500 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }

  console.log(`Completed ${simulationCount} simulations`);

  return calculateSummaryStats(strategyRates, qqqRates, tqqqRates, startDates);
};

// Helper function for binary search to find next available date
const findNextAvailableDate = (sortedDates: string[], targetDate: string): string | undefined => {
  let left = 0;
  let right = sortedDates.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midDate = sortedDates[mid];
    
    if (midDate >= targetDate) {
      if (mid === 0 || sortedDates[mid - 1] < targetDate) {
        return midDate;
      }
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  
  return undefined;
};

const calculateSummaryStats = (
  strategyRates: number[],
  qqqRates: number[],
  tqqqRates: number[],
  startDates: string[]
): MultiSimulationResults => {
  const numSimulations = strategyRates.length;
  
  if (numSimulations === 0) {
    return {
      totalSimulations: 0,
      averageStrategyRate: 0,
      averageQQQRate: 0,
      averageTQQQRate: 0,
      strategyVsQQQImprovement: 0,
      strategyStandardDeviation: 0,
      qqqStandardDeviation: 0,
      tqqqStandardDeviation: 0,
      absoluteWorstStrategyRate: 0,
      relativeWorstStrategyRate: 0,
      absoluteWorstStrategyRateDate: "",
      relativeWorstStrategyRateDate: "",
      winRateVsQQQ: 0,
      resultsWithRates: [],
    };
  }

  // Calculate averages in one pass
  let strategySum = 0;
  let qqqSum = 0;
  let tqqqSum = 0;
  let strategyWinsOverQQQ = 0;
  let absoluteWorstStrategyRate = strategyRates[0];
  let absoluteWorstIndex = 0;
  let relativeWorstDiff = strategyRates[0] - qqqRates[0];
  let relativeWorstIndex = 0;

  for (let i = 0; i < numSimulations; i++) {
    const strategyRate = strategyRates[i];
    const qqqRate = qqqRates[i];
    const tqqqRate = tqqqRates[i];
    
    strategySum += strategyRate;
    qqqSum += qqqRate;
    tqqqSum += tqqqRate;
    
    if (strategyRate > qqqRate) {
      strategyWinsOverQQQ++;
    }
    
    if (strategyRate < absoluteWorstStrategyRate) {
      absoluteWorstStrategyRate = strategyRate;
      absoluteWorstIndex = i;
    }
    
    const relativeDiff = strategyRate - qqqRate;
    if (relativeDiff < relativeWorstDiff) {
      relativeWorstDiff = relativeDiff;
      relativeWorstIndex = i;
    }
  }

  const averageStrategyRate = strategySum / numSimulations;
  const averageQQQRate = qqqSum / numSimulations;
  const averageTQQQRate = tqqqSum / numSimulations;

  // Calculate standard deviations in second pass
  let strategyVarianceSum = 0;
  let qqqVarianceSum = 0;
  let tqqqVarianceSum = 0;

  for (let i = 0; i < numSimulations; i++) {
    strategyVarianceSum += Math.pow(strategyRates[i] - averageStrategyRate, 2);
    qqqVarianceSum += Math.pow(qqqRates[i] - averageQQQRate, 2);
    tqqqVarianceSum += Math.pow(tqqqRates[i] - averageTQQQRate, 2);
  }

  const strategyStandardDeviation = Math.sqrt(strategyVarianceSum / numSimulations);
  const qqqStandardDeviation = Math.sqrt(qqqVarianceSum / numSimulations);
  const tqqqStandardDeviation = Math.sqrt(tqqqVarianceSum / numSimulations);

  // Create results array for display - only keep what's needed
  const resultsWithRates = strategyRates.map((strategyRate, index) => ({
    startDate: startDates[index],
    strategyRate,
    qqqRate: qqqRates[index],
    tqqqRate: tqqqRates[index],
  }));

  const relativeWorstStrategyRate = strategyRates[relativeWorstIndex];

  // Calculate how much better strategy is than QQQ
  const strategyVsQQQImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;

  // Win rate vs QQQ
  const winRateVsQQQ = (strategyWinsOverQQQ / numSimulations) * 100;

  console.log(`✅ Analysis complete:`);
  console.log(`📊 Total simulations: ${numSimulations}`);
  console.log(`📈 Average strategy rate: ${(averageStrategyRate * 100).toFixed(2)}%`);
  console.log(`📈 Average QQQ rate: ${(averageQQQRate * 100).toFixed(2)}%`);
  console.log(`🚀 Strategy vs QQQ improvement: ${strategyVsQQQImprovement.toFixed(2)}%`);
  console.log(`🎯 Win rate vs QQQ: ${winRateVsQQQ.toFixed(1)}%`);

  return {
    totalSimulations: numSimulations,
    averageStrategyRate,
    averageQQQRate,
    averageTQQQRate,
    strategyStandardDeviation,
    qqqStandardDeviation,
    tqqqStandardDeviation,
    absoluteWorstStrategyRate,
    relativeWorstStrategyRate,
    absoluteWorstStrategyRateDate: startDates[absoluteWorstIndex],
    relativeWorstStrategyRateDate: startDates[relativeWorstIndex],
    winRateVsQQQ,
    strategyVsQQQImprovement,
    resultsWithRates,
  };
};

export const formatValue = (value: number, isPercentage = false): string => {
  if (typeof value !== "number") return "";

  // Format ratios and pullbacks as percentages
  if (isPercentage) {
    return (value * 100).toFixed(2) + "%";
  }

  // Format currency values
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
