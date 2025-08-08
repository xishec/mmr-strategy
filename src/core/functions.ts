import { runSingleSimulation } from "./core-logic";
import {
  AnalysisResults,
  Investments,
  MarketData,
  PortfolioSnapshot,
  RebalanceLog,
  RebalanceType,
  Simulation,
  Variables,
} from "./models";
import { addDays, yearsBetween, addYears, today } from "./date-utils";
import { green, red, yellow, black } from "../components/Chart";
import { TIME_CONSTANTS } from "./constants";

export const loadData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData) => void
) => {
  try {
    setDataLoading(true);
    const marketData = {
      QQQ: (await import("../data/QQQ.json")).default,
      TQQQ: (await import("../data/TQQQ.json")).default,
    };

    // Initialize cumulative rate cache for performance
    initializeCumulativeRateCache(marketData);

    // Initialize SMA cache for performance (200-day period)
    initializeSMACache(marketData, 200);

    setMarketData(marketData);
  } catch (error) {
    console.error("Error loading data:", error);
  } finally {
    setDataLoading(false);
  }
};

export const setupInitialPortfolio = (simulation: Simulation, marketData: MarketData) => {
  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.variables.startDate);

  if (!firstValidDate) {
    throw new Error(`No market data found for start date ${simulation.variables.startDate} or later`);
  }

  simulation.variables.startDate = firstValidDate;

  const cumulativeRate = calculateCumulativeRate(firstValidDate, marketData);
  const shouldStart = cumulativeRate > 0;

  const investments: Investments = {
    total: simulation.variables.initialMoney * 1,
    TQQQ: simulation.variables.initialMoney * (shouldStart ? 1 : 0),
    cash: simulation.variables.initialMoney * (shouldStart ? 0 : 1),
    ratio: shouldStart ? 1 : 0,
    mockTotalQQQ: simulation.variables.initialMoney,
    mockTotalTQQQ: simulation.variables.initialMoney,
    mockTotalNothing: simulation.variables.initialMoney,
  };

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    cumulativeRate: cumulativeRate,
    peak: simulation.variables.initialMoney,
    pullback: 0,
    shouldPanic: false,
    shouldEnter: false,
    lastRebalanceDate: firstValidDate,
    nextRebalanceDate: addDays(firstValidDate, 1),
  };

  simulation.portfolioSnapshots = [portfolioSnapshot];

  const rebalanceLog: RebalanceLog = {
    date: firstValidDate,
    before: portfolioSnapshot,
    after: portfolioSnapshot,
    cumulativeRateSinceLastRebalance: 0,
    rebalanceType: RebalanceType.OnTrack,
  };
  simulation.rebalanceLogs = [rebalanceLog];
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  const result = runSingleSimulation(simulation, marketData);
  setSimulation(result);
};

export const calculateAnnualizedRates = (simulation: Simulation) => {
  const endDate = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].date;
  const lastRebalanceLog = simulation.rebalanceLogs[simulation.rebalanceLogs.length - 1];

  simulation.annualizedStrategyRate = calculateAnnualizedRate(
    lastRebalanceLog.before.investments.mockTotalNothing,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.total,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedQQQRate = calculateAnnualizedRate(
    lastRebalanceLog.before.investments.mockTotalNothing,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalQQQ,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedTQQQRate = calculateAnnualizedRate(
    lastRebalanceLog.before.investments.mockTotalNothing,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalTQQQ,
    simulation.variables.startDate,
    endDate
  );
};

/**
 * Creates a deep copy of a PortfolioSnapshot object
 * @param snapshot - The PortfolioSnapshot to copy
 * @returns A new PortfolioSnapshot with all nested objects copied
 */
export const deepCopyPortfolioSnapshot = (snapshot: PortfolioSnapshot): PortfolioSnapshot => {
  return {
    ...snapshot,
    investments: {
      ...snapshot.investments,
    },
  };
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

export const convertAnnualRateToDaily = (annualRate: number): number => {
  return Math.pow(1 + annualRate, 1 / TIME_CONSTANTS.DAYS_IN_YEAR) - 1;
};

/**
 * Runs multiple simulations starting every 10 days from 2000-01-01 to today
 * Memory-efficient version that only keeps essential rate data
 * @param variables - The simulation variables (including initialMoney and all required fields)
 * @param marketData - The market data containing QQQ and TQQQ prices
 * @param nbYear - Number of years to run each simulation (default: 5)
 * @returns Object containing array of simulation results with their starting dates and analysis results
 */
export const runMultipleSimulations = async (
  variables: Variables,
  marketData: MarketData,
  nbYear: number
): Promise<{
  results: Array<{ startDate: string; simulation: Simulation }>;
  analysisResults: any;
}> => {
  // Only store essential data to minimize memory usage
  const strategyRates: number[] = [];
  const qqqRates: number[] = [];
  const tqqqRates: number[] = [];
  const startDates: string[] = [];

  // Get all available dates from market data (sorted)
  const availableDates = Object.keys(marketData.TQQQ).sort();
  const firstAvailableDate = availableDates[0];
  const lastAvailableDate = availableDates[availableDates.length - 1];

  // Start from the first available date or 2000-01-01, whichever is later
  const startDate = firstAvailableDate >= "2000-01-01" ? firstAvailableDate : "2000-01-01";
  const todayString = today();

  const endDate = addYears(lastAvailableDate, -variables.simulationAnalysisMinusYears);
  const finalDate = endDate < todayString ? endDate : todayString;

  let currentDateString = startDate;
  let simulationCount = 0;
  let loopIterations = 0;

  while (currentDateString <= finalDate) {
    const currentIterationDate = currentDateString;
    loopIterations++;

    // Check if this date exists in market data or find next available date
    const nextAvailableDate = availableDates.find((date) => date >= currentIterationDate);

    if (nextAvailableDate) {
      try {
        // Check if we have at least minimum required days of data after the start date
        const minEndDate = addDays(nextAvailableDate, TIME_CONSTANTS.MIN_DATA_DAYS);
        const hasEnoughData = lastAvailableDate >= minEndDate;

        if (hasEnoughData) {
          // Calculate end date for this simulation
          const simulationEndDateString = addYears(nextAvailableDate, nbYear);

          // Create simulation configuration
          const simulation: Simulation = {
            portfolioSnapshots: [],
            rebalanceLogs: [],
            variables: {
              ...variables,
              startDate: nextAvailableDate,
              endDate: simulationEndDateString,
            },
          };

          // Run the simulation using the shared simulation logic
          const completedSimulation = runSingleSimulation(simulation, marketData);

          if (completedSimulation.portfolioSnapshots.length > 0) {
            // Extract only the essential data we need
            strategyRates.push(completedSimulation.annualizedStrategyRate || 0);
            qqqRates.push(completedSimulation.annualizedQQQRate || 0);
            tqqqRates.push(completedSimulation.annualizedTQQQRate || 0);
            startDates.push(nextAvailableDate);

            simulationCount++;

            // Immediately clear simulation data to free memory
            completedSimulation.portfolioSnapshots = [];
            completedSimulation.rebalanceLogs = [];
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    const simulationFrequencyDays = variables.simulationFrequencyDays;
    currentDateString = addDays(currentDateString, simulationFrequencyDays);

    // Yield control back to the browser occasionally to keep UI responsive
    if (loopIterations % 50 === 0) {
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }
  }

  console.log(`Completed ${simulationCount} simulations`);

  const analysisResults = calculateSummaryStats(strategyRates, qqqRates, tqqqRates, startDates);

  return { results: [], analysisResults };
};

let cumulativeRateCache: { [date: string]: number } = {};
let cacheInitialized = false;

// Cache for pre-computed SMA values to improve performance
let smaCache: { [date: string]: number } = {};
let smaCacheInitialized = false;

export const initializeCumulativeRateCache = (marketData: MarketData): void => {
  cumulativeRateCache = {};
  const availableDates = Object.keys(marketData.TQQQ).sort();

  for (let i = 0; i < availableDates.length; i++) {
    const currentDate = availableDates[i];

    const startDate90DaysAgo = addDays(currentDate, -400);
    let startIndex = -1;

    // Find the first date on or after startDate90DaysAgo
    for (let j = 0; j < i; j++) {
      if (availableDates[j] >= startDate90DaysAgo) {
        startIndex = j;
        break;
      }
    }

    if (startIndex === -1 || startIndex >= i) {
      cumulativeRateCache[currentDate] = -1; // Return -100% if not enough data
      continue;
    }

    const startDate = availableDates[startIndex];
    const startData = marketData.TQQQ[startDate];
    const endData = marketData.TQQQ[currentDate];

    if (!startData || !endData) {
      cumulativeRateCache[currentDate] = -1;
      continue;
    }

    // Extract close prices from the new data structure
    const startClose = typeof startData === "object" ? startData.close : startData;
    const endClose = typeof endData === "object" ? endData.close : endData;

    if (startClose === undefined || endClose === undefined || startClose <= 0) {
      cumulativeRateCache[currentDate] = -1;
      continue;
    }

    // Calculate cumulative rate: (end_price - start_price) / start_price
    const cumulativeRate = (endClose - startClose) / startClose;
    cumulativeRateCache[currentDate] = cumulativeRate;
  }

  cacheInitialized = true;
};

/**
 * Pre-computes all SMA values for better performance
 * This should be called once when market data is loaded
 */
export const initializeSMACache = (marketData: MarketData, period: number = 90): void => {
  smaCache = {};
  const availableDates = Object.keys(marketData.TQQQ).sort();

  for (let i = 0; i < availableDates.length; i++) {
    const currentDate = availableDates[i];

    // Need at least 'period' days of data for SMA calculation
    if (i < period - 1) {
      smaCache[currentDate] = -1; // Not enough data
      continue;
    }

    // Get the last 'period' days including current date
    const startIndex = i - period + 1;
    const endIndex = i + 1; // exclusive

    let sum = 0;
    let validDays = 0;

    for (let j = startIndex; j < endIndex; j++) {
      const date = availableDates[j];
      const data = marketData.TQQQ[date];

      if (data) {
        const closePrice = typeof data === "object" ? data.close : data;
        if (closePrice !== undefined && closePrice > 0) {
          sum += closePrice;
          validDays++;
        }
      }
    }

    if (validDays === period) {
      smaCache[currentDate] = sum / period;
    } else {
      smaCache[currentDate] = -1; // Not enough valid data
    }
  }

  smaCacheInitialized = true;
};

export const calculateCumulativeRate = (date: string, marketData: MarketData): number => {
  // Initialize cache if not done yet
  if (!cacheInitialized) {
    initializeCumulativeRateCache(marketData);
  }

  // Return cached value if available
  if (cumulativeRateCache[date] !== undefined) {
    return cumulativeRateCache[date] === -1 ? -1 : cumulativeRateCache[date];
  }

  // Fallback to original calculation for dates not in cache
  // Calculate date 90 days before the given date
  const startDate90DaysAgo = addDays(date, -90);

  // Get all available dates from market data
  const availableDates = Object.keys(marketData.TQQQ).sort();

  // Find the first available date on or after startDate90DaysAgo
  const startDate = availableDates.find((d) => d >= startDate90DaysAgo);

  if (!startDate || startDate >= date) {
    return -1;
  }

  // Get the start and end close prices
  const startData = marketData.TQQQ[startDate];
  const endData = marketData.TQQQ[date];

  if (!startData || !endData) {
    return -1;
  }

  // Extract close prices from the new data structure
  const startClose = typeof startData === "object" ? startData.close : startData;
  const endClose = typeof endData === "object" ? endData.close : endData;

  if (startClose === undefined || endClose === undefined || startClose <= 0) {
    return -1;
  }

  // Calculate cumulative rate: (end_price - start_price) / start_price
  const cumulativeRate = (endClose - startClose) / startClose;

  return cumulativeRate;
};

export const calculateSMA = (date: string, marketData: MarketData, period: number = 90): number => {
  // Initialize cache if not done yet
  if (!smaCacheInitialized) {
    initializeSMACache(marketData, period);
  }

  // Return cached value if available
  if (smaCache[date] !== undefined) {
    return smaCache[date] === -1 ? -1 : smaCache[date];
  }

  // Fallback to original calculation for dates not in cache
  const availableDates = Object.keys(marketData.TQQQ).sort();
  const dateIndex = availableDates.indexOf(date);

  if (dateIndex === -1 || dateIndex < period - 1) {
    return -1; // Not enough data
  }

  // Calculate SMA for the specified period
  let sum = 0;
  let validDays = 0;

  for (let i = dateIndex - period + 1; i <= dateIndex; i++) {
    const currentDate = availableDates[i];
    const data = marketData.TQQQ[currentDate];

    if (data) {
      const closePrice = typeof data === "object" ? data.close : data;
      if (closePrice !== undefined && closePrice > 0) {
        sum += closePrice;
        validDays++;
      }
    }
  }

  if (validDays === period) {
    return sum / period;
  }

  return -1; // Not enough valid data
};

/**
 * Calculate summary statistics from arrays of rates
 * Memory-efficient approach that doesn't store full simulation objects
 */
const calculateSummaryStats = (
  strategyRates: number[],
  qqqRates: number[],
  tqqqRates: number[],
  startDates: string[]
): AnalysisResults => {
  if (strategyRates.length === 0) {
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

  const averageStrategyRate = strategyRates.reduce((sum, rate) => sum + rate, 0) / strategyRates.length;
  const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;
  const averageTQQQRate = tqqqRates.reduce((sum, rate) => sum + rate, 0) / tqqqRates.length;

  // Calculate standard deviations
  const strategyStandardDeviation = Math.sqrt(
    strategyRates.reduce((sum, rate) => sum + Math.pow(rate - averageStrategyRate, 2), 0) / strategyRates.length
  );
  const qqqStandardDeviation = Math.sqrt(
    qqqRates.reduce((sum, rate) => sum + Math.pow(rate - averageQQQRate, 2), 0) / qqqRates.length
  );
  const tqqqStandardDeviation = Math.sqrt(
    tqqqRates.reduce((sum, rate) => sum + Math.pow(rate - averageTQQQRate, 2), 0) / tqqqRates.length
  );

  // Create results array for display - only keep what's needed
  const resultsWithRates = strategyRates.map((strategyRate, index) => ({
    startDate: startDates[index],
    strategyRate,
    qqqRate: qqqRates[index],
    tqqqRate: tqqqRates[index],
  }));

  const absoluteWorstStrategyRate = Math.min(...strategyRates);
  const absoluteWorstStrategyRateDate = startDates[strategyRates.indexOf(absoluteWorstStrategyRate)];

  const relativeWorstStrategy = [...resultsWithRates].sort(
    (a, b) => a.strategyRate - a.qqqRate - (b.strategyRate - b.qqqRate)
  )[0];
  const relativeWorstStrategyRate = relativeWorstStrategy.strategyRate;
  const relativeWorstStrategyRateDate = relativeWorstStrategy.startDate;

  // Calculate how much better strategy is than QQQ
  const strategyVsQQQImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;

  // Count how many times strategy beats QQQ
  const strategyWinsOverQQQ = strategyRates.filter((rate, index) => rate > qqqRates[index]).length;
  const winRateVsQQQ = (strategyWinsOverQQQ / strategyRates.length) * 100;

  console.log(`✅ Analysis complete:`);
  console.log(`📊 Total simulations: ${strategyRates.length}`);
  console.log(`📈 Average strategy rate: ${(averageStrategyRate * 100).toFixed(2)}%`);
  console.log(`📈 Average QQQ rate: ${(averageQQQRate * 100).toFixed(2)}%`);
  console.log(`🚀 Strategy vs QQQ improvement: ${strategyVsQQQImprovement.toFixed(2)}%`);
  console.log(`🎯 Win rate vs QQQ: ${winRateVsQQQ.toFixed(1)}%`);

  return {
    totalSimulations: strategyRates.length,
    averageStrategyRate,
    averageQQQRate,
    averageTQQQRate,
    strategyStandardDeviation,
    qqqStandardDeviation,
    tqqqStandardDeviation,
    absoluteWorstStrategyRate,
    relativeWorstStrategyRate,
    absoluteWorstStrategyRateDate,
    relativeWorstStrategyRateDate,
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

export const getRebalanceTypeColor = (rebalanceLog: RebalanceLog): string => {
  const rebalanceType = rebalanceLog.rebalanceType;

  switch (rebalanceType) {
    case RebalanceType.OnTrack:
      return green;
    case RebalanceType.Drop:
      return yellow;
    case RebalanceType.BigDrop:
      return red;
    default:
      return black;
  }
};
