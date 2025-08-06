import { computePortfolioSnapshot, rebalance } from "./core-logic";
import {
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

export const loadData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData | null) => void
) => {
  try {
    setDataLoading(true);
    setMarketData({
      QQQ: (await import("../data/QQQ.json")).default,
      TQQQ: (await import("../data/TQQQ.json")).default,
    });
  } catch (error) {
    console.error("Error loading data:", error);
  } finally {
    setDataLoading(false);
  }
};

export const setupInitialPortfolio = (simulation: Simulation, marketData: MarketData) => {
  const investments: Investments = {
    total: simulation.variables.initialMoney,
    TQQQ: simulation.variables.initialMoney * simulation.variables.targetRatio,
    cash: simulation.variables.initialMoney * (1 - simulation.variables.targetRatio),
    ratio: simulation.variables.targetRatio,
    mockTotalQQQ: simulation.variables.initialMoney,
    mockTotalTQQQ: simulation.variables.initialMoney,
    mockTotalNothing: simulation.variables.initialMoney,
  };

  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.variables.startDate);

  if (!firstValidDate) {
    throw new Error(`No market data found for start date ${simulation.variables.startDate} or later`);
  }

  simulation.variables.startDate = firstValidDate;

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    nextTarget: simulation.variables.initialMoney * (1 + simulation.variables.targetRate),
    peak: simulation.variables.initialMoney,
    pullback: 0,
    lastRebalanceDate: firstValidDate,
    nextRebalanceDate: addDays(firstValidDate, simulation.variables.rebalanceDays),
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

/**
 * Runs a single simulation with the given parameters
 * @param simulation - The simulation configuration
 * @param marketData - The market data
 * @param endDate - Optional end date to limit the simulation (format: YYYY-MM-DD)
 * @returns The completed simulation
 */
export const runSingleSimulation = (simulation: Simulation, marketData: MarketData): Simulation => {
  // Create a shallow copy of the simulation to avoid mutations
  const newSimulation: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: { ...simulation.variables },
  };

  setupInitialPortfolio(newSimulation, marketData);

  // Get sorted dates within our range for better performance
  const marketDates = Object.keys(marketData.TQQQ).filter(
    (date) => date > newSimulation.variables.startDate && date <= newSimulation.variables.endDate
  );

  for (const date of marketDates) {
    const portfolioSnapshot = computePortfolioSnapshot(newSimulation, date, marketData);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      const rebalancedSnapshot = rebalance(portfolioSnapshot, newSimulation, marketData);
      newSimulation.portfolioSnapshots.push(rebalancedSnapshot);
    } else {
      newSimulation.portfolioSnapshots.push(portfolioSnapshot);
    }
  }

  // Final rebalance and calculate rates
  if (newSimulation.portfolioSnapshots.length > 0) {
    const lastSnapshot = newSimulation.portfolioSnapshots[newSimulation.portfolioSnapshots.length - 1];
    rebalance(lastSnapshot, newSimulation, marketData);
    calculateAnnualizedRates(newSimulation);
  }

  return newSimulation;
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

export const addDaysToDate = addDays;

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
  return Math.pow(1 + annualRate, 1 / 365) - 1;
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

  // End 3 years before the last available date to ensure we have enough data
  const endDate = addYears(lastAvailableDate, -3.5);
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
        // Check if we have at least 30 days of data after the start date
        const minEndDate = addDays(nextAvailableDate, 30);
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

    const simulationFrequencyDays = 3;
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

/**
 * Calculate summary statistics from arrays of rates
 * Memory-efficient approach that doesn't store full simulation objects
 */
const calculateSummaryStats = (
  strategyRates: number[],
  qqqRates: number[],
  tqqqRates: number[],
  startDates: string[]
) => {
  if (strategyRates.length === 0) {
    return {
      totalSimulations: 0,
      averageStrategyRate: 0,
      averageQQQRate: 0,
      averageTQQQRate: 0,
      bestStrategyRate: 0,
      worstStrategyRate: 0,
      winRate: 0,
      resultsWithRates: [],
    };
  }

  const averageStrategyRate = strategyRates.reduce((sum, rate) => sum + rate, 0) / strategyRates.length;
  const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;
  const averageTQQQRate = tqqqRates.reduce((sum, rate) => sum + rate, 0) / tqqqRates.length;

  const bestStrategyRate = Math.max(...strategyRates);
  const worstStrategyRate = Math.min(...strategyRates);

  // Calculate how much better strategy is than QQQ
  const strategyVsQQQPercentageImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;

  // Count how many times strategy beats QQQ
  const strategyWinsOverQQQ = strategyRates.filter((rate, index) => rate > qqqRates[index]).length;
  const winRateVsQQQ = (strategyWinsOverQQQ / strategyRates.length) * 100;

  // Create results array for display - only keep what's needed
  const resultsWithRates = strategyRates.map((strategyRate, index) => ({
    startDate: startDates[index],
    strategyRate,
    qqqRate: qqqRates[index],
    tqqqRate: tqqqRates[index],
  }));

  console.log(`✅ Analysis complete:`);
  console.log(`📊 Total simulations: ${strategyRates.length}`);
  console.log(`📈 Average strategy rate: ${(averageStrategyRate * 100).toFixed(2)}%`);
  console.log(`📈 Average QQQ rate: ${(averageQQQRate * 100).toFixed(2)}%`);
  console.log(`🚀 Strategy vs QQQ improvement: ${strategyVsQQQPercentageImprovement.toFixed(2)}%`);
  console.log(`🎯 Win rate vs QQQ: ${winRateVsQQQ.toFixed(1)}%`);

  return {
    totalSimulations: strategyRates.length,
    averageStrategyRate,
    averageQQQRate,
    averageTQQQRate,
    bestStrategyRate,
    worstStrategyRate,
    winRate: winRateVsQQQ,
    strategyVsQQQPercentageImprovement,
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
