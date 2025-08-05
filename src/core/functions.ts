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
    rebalanceType: RebalanceType.Excess,
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
  // Create a deep copy of the simulation to avoid mutations
  const newSimulation: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
  };

  setupInitialPortfolio(newSimulation, marketData);

  for (const [date] of Object.entries(marketData.TQQQ)) {
    if (date <= newSimulation.variables.startDate) continue;
    if (date > newSimulation.variables.endDate) break;

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

  simulation.annualizedStrategyRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.total,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedQQQRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalQQQ,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedTQQQRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
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
 * @param variables - The simulation variables (including initialMoney and all required fields)
 * @param marketData - The market data containing QQQ and TQQQ prices
 * @param nbYear - Number of years to run each simulation (default: 5)
 * @param onProgress - Optional callback to report progress (0-100)
 * @returns Object containing array of simulation results with their starting dates and analysis results
 */
export const runMultipleSimulations = async (
  variables: Variables,
  marketData: MarketData,
  nbYear: number,
  onProgress?: (progress: number) => void
): Promise<{
  results: Array<{ startDate: string; simulation: Simulation }>;
  analysisResults: any;
}> => {
  const results: Array<{ startDate: string; simulation: Simulation }> = [];

  // Get all available dates from market data (sorted)
  const availableDates = Object.keys(marketData.TQQQ).sort();
  const firstAvailableDate = availableDates[0];
  const lastAvailableDate = availableDates[availableDates.length - 1];

  // Start from the first available date or 2000-01-01, whichever is later
  const startDate = firstAvailableDate >= "2000-01-01" ? firstAvailableDate : "2000-01-01";
  const todayString = today();

  // End 3 years before the last available date to ensure we have enough data
  const endDate = addYears(lastAvailableDate, -1);
  const finalDate = endDate < todayString ? endDate : todayString;

  // Calculate total number of days to process for progress tracking
  const totalDays = Math.ceil((new Date(finalDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

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
            results.push({
              startDate: nextAvailableDate,
              simulation: completedSimulation,
            });

            simulationCount++;
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    // Move to next date (3 days later)
    currentDateString = addDays(currentDateString, 1);
    
    // Report progress and yield control back to the browser frequently to keep UI responsive
    if (loopIterations % 25 === 0) {
      const progress = Math.min(100, (loopIterations / totalDays) * 100);
      onProgress?.(Math.round(progress));
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }
  }

  console.log(
    `Completed ${simulationCount} simulations from ${results[0]?.startDate} to ${
      results[results.length - 1]?.startDate
    }`
  );

  // Report 100% completion
  onProgress?.(100);

  const analysisResults = analyzeSimulationResults(results);

  return { results, analysisResults };
};
/**
 * Analyzes multiple simulation results to get statistics
 * @param results - Array of simulation results from runMultipleSimulations
 * @returns Statistics about the simulation results and the detailed results data
 */
export const analyzeSimulationResults = (results: Array<{ startDate: string; simulation: Simulation }>) => {
  if (results.length === 0) {
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

  const strategyRates = results.map((r) => r.simulation.annualizedStrategyRate || 0);
  const qqqRates = results.map((r) => r.simulation.annualizedQQQRate || 0);
  const tqqqRates = results.map((r) => r.simulation.annualizedTQQQRate || 0);

  const averageStrategyRate = strategyRates.reduce((sum, rate) => sum + rate, 0) / strategyRates.length;
  const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;
  const averageTQQQRate = tqqqRates.reduce((sum, rate) => sum + rate, 0) / tqqqRates.length;

  const bestStrategyRate = Math.max(...strategyRates);
  const worstStrategyRate = Math.min(...strategyRates);

  // Calculate how much better strategy is than QQQ
  const strategyVsQQQPercentageImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;
  // Count how many times strategy beats QQQ
  const strategyWinsOverQQQ = results.filter(
    (r) => (r.simulation.annualizedStrategyRate || 0) > (r.simulation.annualizedQQQRate || 0)
  ).length;
  const winRateVsQQQ = (strategyWinsOverQQQ / results.length) * 100;

  // // Calculate how much better strategy is than QQQ
  // const TQQQVsQQQPercentageImprovement = (averageTQQQRate / averageQQQRate - 1) * 100;
  // // Count how many times strategy beats QQQ
  // const TQQQWinsOverQQQ = results.filter(
  //   (r) => (r.simulation.annualizedTQQQRate || 0) > (r.simulation.annualizedQQQRate || 0)
  // ).length;
  // const winRateTQQQVsQQQ = (TQQQWinsOverQQQ / results.length) * 100;

  const resultsWithRates = results.map((r) => ({
    startDate: r.startDate,
    strategyRate: r.simulation.annualizedStrategyRate || 0,
    qqqRate: r.simulation.annualizedQQQRate || 0,
    tqqqRate: r.simulation.annualizedTQQQRate || 0,
  }));

  console.log("Absolute worst 10");
  resultsWithRates
    .sort((a, b) => a.strategyRate - b.strategyRate)
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });

  console.log("Relative worst 10");
  resultsWithRates
    .sort((a, b) => a.strategyRate - a.qqqRate - (b.strategyRate - b.qqqRate))
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });

  console.log(
    "\naverageStrategyRate\t\t\t\t",
    `${(averageStrategyRate * 100).toFixed(2)}%`,
    "\nstrategyVsQQQImprovement\t\t\t\t",
    `${strategyVsQQQPercentageImprovement.toFixed(2)}%`,
    "\nwinRateVsQQQ\t\t\t\t",
    `${winRateVsQQQ.toFixed(2)}%`,
    `absoluteWorst`,
    resultsWithRates.sort((a, b) => a.strategyRate - b.strategyRate)[0].strategyRate.toFixed(2) + "%",
    `relativeWorst`,
    resultsWithRates
      .sort((a, b) => a.strategyRate - a.qqqRate - (b.strategyRate - b.qqqRate))[0]
      .strategyRate.toFixed(2) + "%"
  );

  return {
    totalSimulations: results.length,
    averageStrategyRate,
    averageQQQRate,
    averageTQQQRate,
    bestStrategyRate,
    worstStrategyRate,
    dateRange: {
      start: results[0]?.startDate,
      end: results[results.length - 1]?.startDate,
    },
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
