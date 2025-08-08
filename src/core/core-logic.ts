import { addDays, daysBetween } from "./date-utils";
import { calculateAnnualizedRates, deepCopyPortfolioSnapshot, setupInitialPortfolio } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from "./models";
import { PORTFOLIO_LIMITS, TIME_CONSTANTS } from "./constants";

// Trading constants
const PANIC_THRESHOLD = -20; // Percentage drop that triggers panic mode
const DOUBLE_DROP_MULTIPLIER = 2;

/**
 * Processes a single date in the simulation, handling portfolio updates and rebalancing
 */
const processSimulationDate = (simulation: Simulation, date: string, marketData: MarketData): PortfolioSnapshot => {
  const portfolioSnapshot = computePortfolioSnapshot(simulation, date, marketData);

  if (date >= portfolioSnapshot.nextRebalanceDate) {
    return rebalance(portfolioSnapshot, simulation);
  }

  return portfolioSnapshot;
};

/**
 * Filters market data to only include dates within the simulation range
 */
const getRelevantMarketDates = (marketData: MarketData, startDate: string, endDate: string): string[] => {
  return Object.keys(marketData.TQQQ).filter((date) => date > startDate && date <= endDate);
};

export const runSingleSimulation = (simulation: Simulation, marketData: MarketData): Simulation => {
  // Create a shallow copy of the simulation to avoid mutations
  const newSimulation: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: { ...simulation.variables },
  };

  setupInitialPortfolio(newSimulation, marketData);
  rebalance(newSimulation.portfolioSnapshots[0], newSimulation);

  // Get relevant market dates within our simulation range
  const marketDates = getRelevantMarketDates(
    marketData,
    newSimulation.variables.startDate,
    newSimulation.variables.endDate
  );

  // Process each date in the simulation
  for (const date of marketDates) {
    const portfolioSnapshot = processSimulationDate(newSimulation, date, marketData);
    newSimulation.portfolioSnapshots.push(portfolioSnapshot);
  }

  // Final rebalance and calculate rates
  if (newSimulation.portfolioSnapshots.length > 0) {
    const lastSnapshot = newSimulation.portfolioSnapshots[newSimulation.portfolioSnapshots.length - 1];
    rebalance(lastSnapshot, newSimulation);
    calculateAnnualizedRates(newSimulation);
  }

  return newSimulation;
};

/**
 * Helper function to calculate market multipliers from percentage changes
 */
const calculateMultipliers = (tqqqDelta: number, qqqDelta: number, cashDayRate: number) => ({
  tqqq: tqqqDelta / 100 + 1,
  qqq: qqqDelta / 100 + 1,
  cash: cashDayRate + 1,
});

/**
 * Helper function to update mock portfolio totals with new cash
 */
const addNewCashToPortfolio = (investments: Investments, newCash: number) => {
  investments.cash += newCash;
  investments.mockTotalQQQ += newCash;
  investments.mockTotalTQQQ += newCash;
  investments.mockTotalNothing += newCash;
  investments.total = investments.cash + investments.TQQQ;
  investments.ratio = investments.TQQQ / investments.total;
};

export const computePortfolioSnapshot = (
  simulation: Simulation,
  date: string,
  marketData: MarketData
): PortfolioSnapshot => {
  const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

  const tqqqDelta = marketData.TQQQ[date] || 0;
  const qqqDelta = marketData.QQQ[date] || 0;
  const multipliers = calculateMultipliers(tqqqDelta, qqqDelta, simulation.variables.cashDayRate);

  // Calculate new portfolio values
  const newTQQQ = lastSnapshot.investments.TQQQ * multipliers.tqqq;
  const newCash = lastSnapshot.investments.cash * multipliers.cash;
  const newTotal = newTQQQ + newCash;

  const investments: Investments = {
    total: newTotal,
    TQQQ: newTQQQ,
    cash: newCash,
    ratio: newTQQQ / newTotal,
    mockTotalQQQ: lastSnapshot.investments.mockTotalQQQ * multipliers.qqq,
    mockTotalTQQQ: lastSnapshot.investments.mockTotalTQQQ * multipliers.tqqq,
    mockTotalNothing: lastSnapshot.investments.mockTotalNothing,
  };

  // Update snapshot with new values
  newSnapshot.date = date;
  newSnapshot.investments = investments;
  newSnapshot.peak = Math.max(lastSnapshot.peak, newTotal);
  newSnapshot.pullback = -(newSnapshot.peak - newTotal) / newSnapshot.peak;
  newSnapshot.cumulativeRateSinceRebalance = (1 + newSnapshot.cumulativeRateSinceRebalance) * multipliers.tqqq - 1;

  // Check for panic conditions
  if (tqqqDelta < PANIC_THRESHOLD) {
    newSnapshot.shouldPanic = true;
    newSnapshot.nextRebalanceDate = date;
  }

  return newSnapshot;
};

/**
 * Helper function to update portfolio allocation
 */
const updatePortfolioAllocation = (snapshot: PortfolioSnapshot, newTargetRatio: number) => {
  snapshot.investments.TQQQ = snapshot.investments.total * newTargetRatio;
  snapshot.investments.cash = snapshot.investments.total * (1 - newTargetRatio);
  snapshot.investments.ratio = newTargetRatio;
};

/**
 * Determines the rebalance type and target allocation based on performance and panic state
 */
const determineRebalanceStrategy = (
  cumulativeRate: number,
  dropRate: number,
  shouldPanic: boolean,
  baseRebalanceDays: number
): { type: RebalanceType; targetRatio?: number; rebalanceDays: number } => {
  if (shouldPanic) {
    return { type: RebalanceType.Panic, targetRatio: 0, rebalanceDays: baseRebalanceDays };
  }

  const doubleDropRate = dropRate * DOUBLE_DROP_MULTIPLIER;

  if (cumulativeRate >= dropRate) {
    return { type: RebalanceType.OnTrack, targetRatio: PORTFOLIO_LIMITS.MAX_RATIO, rebalanceDays: baseRebalanceDays };
  } else if (cumulativeRate >= doubleDropRate) {
    return { type: RebalanceType.Drop, rebalanceDays: baseRebalanceDays };
  } else {
    return { type: RebalanceType.BigDrop, targetRatio: PORTFOLIO_LIMITS.MIN_RATIO, rebalanceDays: baseRebalanceDays };
  }
};

export const rebalance = (before: PortfolioSnapshot, simulation: Simulation): PortfolioSnapshot => {
  const { monthlyNewCash, rebalanceDays, dropRate } = simulation.variables;

  const lastRebalanceDate = simulation.rebalanceLogs[simulation.rebalanceLogs.length - 1]?.date || before.date;
  const daysSinceRebalance = daysBetween(lastRebalanceDate, before.date);
  const newCash = (monthlyNewCash / TIME_CONSTANTS.DAYS_IN_MONTH) * daysSinceRebalance;

  addNewCashToPortfolio(before.investments, newCash);

  const after = deepCopyPortfolioSnapshot(before);
  const cumulativeRate = before.cumulativeRateSinceRebalance;

  const strategy = determineRebalanceStrategy(cumulativeRate, dropRate, before.shouldPanic, rebalanceDays);
  if (strategy.targetRatio !== undefined) {
    updatePortfolioAllocation(after, strategy.targetRatio);
  }

  // Set post-rebalance metadata
  after.nextRebalanceDate = addDays(before.date, strategy.rebalanceDays);
  after.cumulativeRateSinceRebalance = 0;
  after.shouldPanic = false;

  const rebalanceLog: RebalanceLog = {
    date: before.date,
    before: before,
    after: after,
    cumulativeRateSinceLastRebalance: cumulativeRate,
    rebalanceType: strategy.type,
  };

  simulation.rebalanceLogs.push(rebalanceLog);
  return after;
};
