import { runSingleSimulation } from "./core-logic";
import { DashboardVariables, MarketData, MultiSimulationResults, PortfolioSnapshot, Simulation } from "./models";
import { addDays, yearsBetween, addYears, today } from "./date-utils";
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

    setMarketData(marketData);
  } catch (error) {
    console.error("Error loading data:", error);
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

const calculateAnnualizedRate = (
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
  // Only store essential data to minimize memory usage
  const strategyRates: number[] = [];
  const qqqRates: number[] = [];
  const tqqqRates: number[] = [];
  const startDates: string[] = [];

  // Get all available dates from market data (sorted)
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
          const simulationEndDateString = addYears(
            nextAvailableDate,
            dashboardVariables.multiSimulationVariables.simulationDurationYears
          );

          // Create simulation configuration
          const simulation: Simulation = {
            portfolioSnapshots: [],
            simulationVariables: {
              ...dashboardVariables.simulationVariables,
              startDate: nextAvailableDate,
              endDate: simulationEndDateString,
            },
          };

          // Run the simulation using the shared simulation logic
          const completedSimulation = runSingleSimulation(simulation, marketData);

          if (completedSimulation.portfolioSnapshots.length > 0) {
            // Extract only the essential data we need
            strategyRates.push(completedSimulation.simulationResults?.annualizedStrategyRate || 0);
            qqqRates.push(completedSimulation.simulationResults?.annualizedQQQRate || 0);
            tqqqRates.push(completedSimulation.simulationResults?.annualizedTQQQRate || 0);
            startDates.push(nextAvailableDate);

            simulationCount++;

            // Immediately clear simulation data to free memory
            completedSimulation.portfolioSnapshots = [];
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    currentDateString = addDays(currentDateString, dashboardVariables.multiSimulationVariables.simulationFrequencyDays);

    // Yield control back to the browser occasionally to keep UI responsive
    if (loopIterations % 50 === 0) {
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }
  }

  console.log(`Completed ${simulationCount} simulations`);

  return calculateSummaryStats(strategyRates, qqqRates, tqqqRates, startDates);
};

const calculateSummaryStats = (
  strategyRates: number[],
  qqqRates: number[],
  tqqqRates: number[],
  startDates: string[]
): MultiSimulationResults => {
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
