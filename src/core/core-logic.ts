import { addDays, daysBetween } from "./date-utils";
import { calculateAnnualizedRates, calculateCumulativeRate, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Signal, Simulation } from "./models";
import { TIME_CONSTANTS } from "./constants";

const PANIC_THRESHOLD = -20;
const DOUBLE_DROP_MULTIPLIER = 2;

export const runSingleSimulation = (simulation: Simulation, marketData: MarketData): Simulation => {
  const newSimulation: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: { ...simulation.variables },
  };

  setupInitialPortfolio(newSimulation, marketData);

  const marketDates = getRelevantMarketDates(
    marketData,
    newSimulation.variables.startDate,
    newSimulation.variables.endDate
  );

  let lastCashAdditionDate = newSimulation.variables.startDate;

  for (const date of marketDates) {
    const lastSnapshot = newSimulation.portfolioSnapshots[newSimulation.portfolioSnapshots.length - 1];
    const newSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

    const currentDateIndex = marketDates.indexOf(date);
    const last30DaysFromCurrent = marketDates.slice(Math.max(0, currentDateIndex - 30), currentDateIndex);
    const signal: Signal = {
      date,
      bigDropLast30Days: last30DaysFromCurrent.some((d) => marketData.TQQQ[d].rate < -20),
      isAboveSMA200: marketData.QQQ[date].close >= marketData.QQQ[date].sma200! * 1.05,
      isBelowSMA200: marketData.QQQ[date].close < marketData.QQQ[date].sma200! * 0.95,
    };

    const daysSinceLastCashAddition = daysBetween(lastCashAdditionDate, date);
    if (daysSinceLastCashAddition >= 30 && newSimulation.variables.monthlyNewCash > 0) {
      addNewCashToPortfolio(newSnapshot.investments, newSimulation.variables.monthlyNewCash);
      lastCashAdditionDate = date;
    }

    updateStrategyToSnapshot(newSnapshot, marketData, signal);
    updateMockToSnapshot(newSnapshot, marketData);

    newSnapshot.date = date;
    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    newSimulation.portfolioSnapshots.push(newSnapshot);
  }

  calculateAnnualizedRates(newSimulation);

  return newSimulation;
};

const updateStrategyToSnapshot = (newSnapshot: PortfolioSnapshot, marketData: MarketData, signal: Signal) => {
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;

  if (signal.isAboveSMA200 && !signal.bigDropLast30Days) {
    // all-in
    console.log(newSnapshot.date);
    newSnapshot.investments.TQQQ = newSnapshot.investments.total;
    newSnapshot.investments.cash = 0;
    newSnapshot.investments.ratio = 1;
  } else if (signal.isBelowSMA200 || signal.bigDropLast30Days) {
    // panic
    newSnapshot.investments.TQQQ = 0;
    newSnapshot.investments.cash = newSnapshot.investments.total;
    newSnapshot.investments.ratio = 0;
  } else {
    // hold
  }
  newSnapshot.investments.TQQQ *= TQQQRate / 100 + 1;
  newSnapshot.investments.cash *= 1;
  newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
};

const updateMockToSnapshot = (newSnapshot: PortfolioSnapshot, marketData: MarketData) => {
  const QQQRate = marketData.QQQ[newSnapshot.date].rate || 0;
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;

  newSnapshot.investments.mockTotalQQQ *= QQQRate / 100 + 1;
  newSnapshot.investments.mockTotalTQQQ *= TQQQRate / 100 + 1;
};

export const setupInitialPortfolio = (simulation: Simulation, marketData: MarketData) => {
  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.variables.startDate);

  if (!firstValidDate) {
    throw new Error(`No market data found for start date ${simulation.variables.startDate} or later`);
  }

  simulation.variables.startDate = firstValidDate;

  const investments: Investments = {
    total: simulation.variables.initialMoney * 1,
    TQQQ: simulation.variables.initialMoney * 0.01,
    cash: simulation.variables.initialMoney * 0.99,
    ratio: 0.01,
    mockTotalQQQ: simulation.variables.initialMoney,
    mockTotalTQQQ: simulation.variables.initialMoney,
    mockTotalNothing: simulation.variables.initialMoney,
  };

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    cumulativeRate: 0,
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
    note: "Initial setup",
    rebalanceType: RebalanceType.OnTrack,
  };
  simulation.rebalanceLogs = [rebalanceLog];
};

const getRelevantMarketDates = (marketData: MarketData, startDate: string, endDate: string): string[] => {
  return Object.keys(marketData.TQQQ).filter((date) => date > startDate && date <= endDate);
};

// const calculateMultipliers = (tqqqDelta: number, qqqDelta: number, cashDayRate: number) => ({
//   tqqq: tqqqDelta / 100 + 1,
//   qqq: qqqDelta / 100 + 1,
//   cash: cashDayRate + 1,
// });

const addNewCashToPortfolio = (investments: Investments, newCash: number) => {
  investments.cash += newCash;
  investments.mockTotalQQQ += newCash;
  investments.mockTotalTQQQ += newCash;
  investments.mockTotalNothing += newCash;
  investments.total = investments.cash + investments.TQQQ;
  investments.ratio = investments.TQQQ / investments.total;
};

// export const computePortfolioSnapshot = (
//   simulation: Simulation,
//   date: string,
//   marketData: MarketData
// ): PortfolioSnapshot => {
//   const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
//   const newSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

//   const tqqqDelta = marketData.TQQQ[date].rate || 0;
//   const qqqDelta = marketData.QQQ[date].rate || 0;
//   const multipliers = calculateMultipliers(tqqqDelta, qqqDelta, simulation.variables.cashDayRate);

//   // Calculate new portfolio values
//   const newTQQQ = lastSnapshot.investments.TQQQ * multipliers.tqqq;
//   const newCash = lastSnapshot.investments.cash * multipliers.cash;
//   const newTotal = newTQQQ + newCash;

//   const investments: Investments = {
//     total: newTotal,
//     TQQQ: newTQQQ,
//     cash: newCash,
//     ratio: newTQQQ / newTotal,
//     mockTotalQQQ: lastSnapshot.investments.mockTotalQQQ * multipliers.qqq,
//     mockTotalTQQQ: lastSnapshot.investments.mockTotalTQQQ * multipliers.tqqq,
//     mockTotalNothing: lastSnapshot.investments.mockTotalNothing,
//   };

//   newSnapshot.date = date;
//   newSnapshot.investments = investments;
//   newSnapshot.peak = Math.max(lastSnapshot.peak, newTotal);
//   newSnapshot.pullback = -(newSnapshot.peak - newTotal) / newSnapshot.peak;

//   if (tqqqDelta < PANIC_THRESHOLD || marketData.QQQ[date].close < marketData.QQQ[date].sma200!) {
//     newSnapshot.shouldPanic = true;
//     newSnapshot.nextRebalanceDate = date;
//   }

//   return newSnapshot;
// };

// const updatePortfolioAllocation = (snapshot: PortfolioSnapshot, newTargetRatio: number) => {
//   snapshot.investments.TQQQ = snapshot.investments.total * newTargetRatio;
//   snapshot.investments.cash = snapshot.investments.total * (1 - newTargetRatio);
//   snapshot.investments.ratio = newTargetRatio;
// };

// const determineRebalanceStrategy = (
//   cumulativeRate: number,
//   dropRate: number,
//   shouldPanic: boolean,
//   baseRebalanceDays: number
// ): { type: RebalanceType; targetRatio?: number; rebalanceDays: number } => {
//   if (shouldPanic) {
//     return { type: RebalanceType.Panic, targetRatio: 0, rebalanceDays: baseRebalanceDays };
//   }

//   const doubleDropRate = dropRate * DOUBLE_DROP_MULTIPLIER;

//   if (cumulativeRate >= 0.3) {
//     return { type: RebalanceType.OnTrack, targetRatio: 1, rebalanceDays: 1 };
//   } else if (cumulativeRate >= 0) {
//     return { type: RebalanceType.OnTrack, targetRatio: 1, rebalanceDays: 1 };
//   } else if (cumulativeRate >= doubleDropRate) {
//     return { type: RebalanceType.Drop, rebalanceDays: 1 };
//   } else {
//     return { type: RebalanceType.BigDrop, rebalanceDays: 1 };
//   }
// };

// export const rebalance = (before: PortfolioSnapshot, simulation: Simulation): PortfolioSnapshot => {
//   // if should

//   const { monthlyNewCash, rebalanceDays, dropRate } = simulation.variables;

//   const lastRebalanceDate = simulation.rebalanceLogs[simulation.rebalanceLogs.length - 1]?.date || before.date;
//   const daysSinceRebalance = daysBetween(lastRebalanceDate, before.date);
//   const newCash = (monthlyNewCash / TIME_CONSTANTS.DAYS_IN_MONTH) * daysSinceRebalance;

//   addNewCashToPortfolio(before.investments, newCash);

//   const after = deepCopyPortfolioSnapshot(before);
//   const cumulativeRate = before.cumulativeRate;

//   const strategy = determineRebalanceStrategy(cumulativeRate, dropRate, before.shouldPanic, rebalanceDays);
//   if (strategy.targetRatio !== undefined) {
//     updatePortfolioAllocation(after, strategy.targetRatio);
//   }

//   // Set post-rebalance metadata
//   after.nextRebalanceDate = addDays(before.date, strategy.rebalanceDays);
//   after.cumulativeRateSinceRebalance = 0;
//   after.shouldPanic = false;

//   const rebalanceLog: RebalanceLog = {
//     date: before.date,
//     before: before,
//     after: after,
//     cumulativeRateSinceLastRebalance: cumulativeRate,
//     rebalanceType: strategy.type,
//   };

//   simulation.rebalanceLogs.push(rebalanceLog);
//   return after;
// };
