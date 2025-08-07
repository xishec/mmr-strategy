import { addDays } from "./date-utils";
import { deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from "./models";
import { PORTFOLIO_LIMITS, TIME_CONSTANTS } from "./constants";

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
  const dailyNewCash = (monthlyNewCash / TIME_CONSTANTS.DAYS_IN_MONTH) * rebalanceDays;

  // Add new cash to all investment types
  before.investments.cash += dailyNewCash;
  before.investments.mockTotalQQQ += dailyNewCash;
  before.investments.mockTotalTQQQ += dailyNewCash;
  before.investments.mockTotalNothing += dailyNewCash;
  before.investments.total = before.investments.cash + before.investments.TQQQ;
  before.investments.ratio = before.investments.TQQQ / before.investments.total;

  const after = deepCopyPortfolioSnapshot(before);
  const cumulativeRate = before.cumulativeRateSinceRebalance;

  // Rebalancing thresholds and step size
  const doubleDropRate = dropRate * 2;

  let rebalanceType: RebalanceType;

  if (cumulativeRate >= dropRate) {
    // On track or gaining - increase TQQQ allocation
    rebalanceType = RebalanceType.OnTrack;
    const newTargetRatio = Math.min(before.investments.ratio + PORTFOLIO_LIMITS.STEP_RATIO, PORTFOLIO_LIMITS.MAX_RATIO);
    updatePortfolioAllocation(after, 0.75);
  } else if (cumulativeRate >= doubleDropRate) {
    // Moderate drop - hold current allocation
    rebalanceType = RebalanceType.Drop;
  } else {
    // Big drop - reduce TQQQ allocation (buy the dip but with reduced exposure)
    rebalanceType = RebalanceType.BigDrop;
    updatePortfolioAllocation(after, 0);
  }

  // Set post-rebalance metadata
  after.nextRebalanceDate = addDays(before.date, rebalanceDays);
  after.cumulativeRateSinceRebalance = 0;

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
