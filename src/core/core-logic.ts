import { addDays, daysBetween } from "./date-utils";
import { calculateAnnualizedRates, deepCopyPortfolioSnapshot, setupInitialPortfolio } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from "./models";
import { PORTFOLIO_LIMITS, TIME_CONSTANTS } from "./constants";

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
      const rebalancedSnapshot = rebalance(portfolioSnapshot, newSimulation);
      newSimulation.portfolioSnapshots.push(rebalancedSnapshot);
    } else {
      newSimulation.portfolioSnapshots.push(portfolioSnapshot);
    }
  }

  // Final rebalance and calculate rates
  if (newSimulation.portfolioSnapshots.length > 0) {
    const lastSnapshot = newSimulation.portfolioSnapshots[newSimulation.portfolioSnapshots.length - 1];
    rebalance(lastSnapshot, newSimulation);
    calculateAnnualizedRates(newSimulation);
  }

  return newSimulation;
};

export const computePortfolioSnapshot = (simulation: Simulation, date: string, marketData: MarketData) => {
  const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newPortfolioSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

  const tqqqDelta = marketData.TQQQ[date] || 0;
  const qqqDelta = marketData.QQQ[date] || 0;
  const tqqqMultiplier = tqqqDelta / 100 + 1;
  const qqqMultiplier = qqqDelta / 100 + 1;
  const cashMultiplier = 1 + simulation.variables.cashDayRate;

  const newTQQQ = lastSnapshot.investments.TQQQ * tqqqMultiplier;
  const newCash = lastSnapshot.investments.cash * cashMultiplier;
  const newTotal = newTQQQ + newCash;

  const investments: Investments = {
    total: newTotal,
    TQQQ: newTQQQ,
    cash: newCash,
    ratio: newTQQQ / newTotal,
    mockTotalQQQ: lastSnapshot.investments.mockTotalQQQ * qqqMultiplier,
    mockTotalTQQQ: lastSnapshot.investments.mockTotalTQQQ * tqqqMultiplier,
    mockTotalNothing: lastSnapshot.investments.mockTotalNothing,
  };

  newPortfolioSnapshot.date = date;
  newPortfolioSnapshot.investments = investments;
  newPortfolioSnapshot.peak = Math.max(lastSnapshot.peak, newTotal);
  newPortfolioSnapshot.pullback = -(newPortfolioSnapshot.peak - newTotal) / newPortfolioSnapshot.peak;
  newPortfolioSnapshot.cumulativeRateSinceRebalance =
    (1 + newPortfolioSnapshot.cumulativeRateSinceRebalance) * tqqqMultiplier - 1;

  if (tqqqDelta < -20) {
    newPortfolioSnapshot.shouldPanic = true;
    newPortfolioSnapshot.nextRebalanceDate = date;
  }

  return newPortfolioSnapshot;
};

// Helper function to update portfolio allocation
const updatePortfolioAllocation = (snapshot: PortfolioSnapshot, newTargetRatio: number) => {
  snapshot.investments.TQQQ = snapshot.investments.total * newTargetRatio;
  snapshot.investments.cash = snapshot.investments.total * (1 - newTargetRatio);
  snapshot.investments.ratio = newTargetRatio;
};

export const rebalance = (before: PortfolioSnapshot, simulation: Simulation) => {
  const { monthlyNewCash, rebalanceDays, dropRate } = simulation.variables;

  const daysSinceRebalance = daysBetween(
    simulation.rebalanceLogs[simulation.rebalanceLogs.length - 1]?.date || before.date,
    before.date
  );
  const newCash = (monthlyNewCash / TIME_CONSTANTS.DAYS_IN_MONTH) * daysSinceRebalance;
  before.investments.cash += newCash;
  before.investments.mockTotalQQQ += newCash;
  before.investments.mockTotalTQQQ += newCash;
  before.investments.mockTotalNothing += newCash;
  before.investments.total = before.investments.cash + before.investments.TQQQ;
  before.investments.ratio = before.investments.TQQQ / before.investments.total;

  const after = deepCopyPortfolioSnapshot(before);
  const cumulativeRate = before.cumulativeRateSinceRebalance;

  // Rebalancing thresholds and step size
  const doubleDropRate = dropRate * 2;

  let rebalanceType: RebalanceType;
  if (cumulativeRate >= dropRate && !before.shouldPanic) {
    // On track or gaining - increase TQQQ allocation
    rebalanceType = RebalanceType.OnTrack;
    updatePortfolioAllocation(after, 1);
  } else if (cumulativeRate >= doubleDropRate  && !before.shouldPanic) {
    // Moderate drop - hold current allocation
    rebalanceType = RebalanceType.Drop;
  } else {
    // Big drop - reduce TQQQ allocation (buy the dip but with reduced exposure)
    rebalanceType = RebalanceType.BigDrop;
    updatePortfolioAllocation(after, 0);
  }
  if (before.shouldPanic) rebalanceType = RebalanceType.Panic;

  // Set post-rebalance metadata
  after.nextRebalanceDate = addDays(before.date, rebalanceDays);
  after.cumulativeRateSinceRebalance = 0;
  after.shouldPanic = false;

  const rebalanceLog: RebalanceLog = {
    date: before.date,
    before: before,
    after: after,
    cumulativeRateSinceLastRebalance: cumulativeRate,
    rebalanceType: rebalanceType,
  };

  simulation.rebalanceLogs.push(rebalanceLog);
  return after;
};
