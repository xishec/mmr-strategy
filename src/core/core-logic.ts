import { addDaysToDate, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from ".";

export const computePortfolioSnapshot = (simulation: Simulation, date: string, marketData: MarketData) => {
  const lastInvestmentsSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newPortfolioSnapshot = deepCopyPortfolioSnapshot(lastInvestmentsSnapshot);

  const TQQQDelta = marketData.TQQQ[date] || 0;
  const QQQDelta = marketData.QQQ[date] || 0;

  const newTQQQ = lastInvestmentsSnapshot.investments.TQQQ * (TQQQDelta / 100 + 1);
  const newCash = lastInvestmentsSnapshot.investments.cash * (1 + simulation.variables.cashDayRate);
  const newTotal = newTQQQ + newCash;
  const investments: Investments = {
    total: newTotal,
    TQQQ: newTQQQ,
    cash: newCash,
    ratio: newTQQQ / (newTQQQ + newCash),
    mockTotalQQQ: lastInvestmentsSnapshot.investments.mockTotalQQQ * (QQQDelta / 100 + 1),
    mockTotalTQQQ: lastInvestmentsSnapshot.investments.mockTotalTQQQ * (TQQQDelta / 100 + 1),
  };

  newPortfolioSnapshot.date = date;
  newPortfolioSnapshot.investments = investments;
  newPortfolioSnapshot.peak = Math.max(lastInvestmentsSnapshot.peak, newTotal);
  newPortfolioSnapshot.pullback = -(newPortfolioSnapshot.peak - newTotal) / newPortfolioSnapshot.peak;
  newPortfolioSnapshot.cumulativeRateSinceRebalance =
    (1 + newPortfolioSnapshot.cumulativeRateSinceRebalance) * (1 + TQQQDelta / 100) - 1;

  return newPortfolioSnapshot;
};

export const rebalance = (before: PortfolioSnapshot, simulation: Simulation, marketData: MarketData) => {
  const { monthlyNewCash, rebalanceDays, targetRatio, targetRate, dropRate } = simulation.variables;

  before.investments.cash += (monthlyNewCash / 30) * rebalanceDays;
  before.investments.mockTotalQQQ += (monthlyNewCash / 30) * rebalanceDays;
  before.investments.mockTotalTQQQ += (monthlyNewCash / 30) * rebalanceDays;
  before.investments.total = before.investments.cash + before.investments.TQQQ;
  before.investments.ratio = before.investments.TQQQ / before.investments.total;

  const after = deepCopyPortfolioSnapshot(before);

  const doubleTargetRate = targetRate * 2;
  const doubleDropRate = dropRate * 2;
  const cumulativeRate = before.cumulativeRateSinceRebalance;

  const isBigSpike = cumulativeRate >= doubleTargetRate;
  const isSpike = cumulativeRate < doubleTargetRate && cumulativeRate >= targetRate;
  const isOnTrack = cumulativeRate < targetRate && cumulativeRate >= dropRate;
  const isDrop = cumulativeRate < dropRate && cumulativeRate >= doubleDropRate;
  const isBigDrop = cumulativeRate < doubleDropRate;

  let rebalanceType: RebalanceType = RebalanceType.Excess;

  if (isBigSpike) {
    rebalanceType = RebalanceType.BigSpike;
    after.investments.TQQQ = before.investments.total * Math.min(targetRatio * 1, 1);
    after.investments.cash = before.investments.total * (1 - Math.min(targetRatio * 1, 1));
    after.investments.total = before.investments.total;
    after.investments.ratio = after.investments.TQQQ / after.investments.total;
  } else if (isSpike) {
    rebalanceType = RebalanceType.Spike;
    after.investments.TQQQ = before.investments.total * targetRatio * 0.75;
    after.investments.cash = before.investments.total * (1 - targetRatio * 0.75);
    after.investments.total = before.investments.total;
    after.investments.ratio = after.investments.TQQQ / after.investments.total;
  } else if (isOnTrack) {
    rebalanceType = RebalanceType.Shortfall;
    const shortfall = Math.max(before.nextTarget - before.investments.total, 0);
    const actualShortfall = Math.min(shortfall, before.investments.cash);
    after.investments.TQQQ = before.investments.TQQQ + actualShortfall;
    after.investments.cash = before.investments.cash - actualShortfall;
    after.investments.total = before.investments.total;
    after.investments.ratio = after.investments.TQQQ / after.investments.total;
  } else if (isDrop) {
    rebalanceType = RebalanceType.Drop;
  } else if (isBigDrop) {
    rebalanceType = RebalanceType.BigDrop;
    after.investments.TQQQ = before.investments.total * targetRatio * 0.5;
    after.investments.cash = before.investments.total * (1 - targetRatio * 0.5);
    after.investments.total = before.investments.total;
    after.investments.ratio = after.investments.TQQQ / after.investments.total;
  } else {
    console.log("bug");
  }

  after.nextTarget = before.investments.total * (1 + 0.2);
  after.nextRebalanceDate = addDaysToDate(before.date, rebalanceDays);
  after.cumulativeRateSinceRebalance = 0;

  const rebalanceLog: RebalanceLog = {
    date: before.date,
    before: before,
    after: after,
    cumulativeRateSinceLastRebalance: cumulativeRate,
    rebalanceType: rebalanceType,
  };
  // console.log(rebalanceLog);
  simulation.rebalanceLogs.push(rebalanceLog);

  return after;
};
