import { addDays, daysBetween } from "./date-utils";
import { calculateAnnualizedRates, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Signal, Simulation } from "./models";

export const runSingleSimulation = (oldSimulation: Simulation, marketData: MarketData): Simulation => {
  const simulation: Simulation = {
    ...oldSimulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: { ...oldSimulation.variables },
  };

  setupInitialPortfolio(simulation, marketData);

  const marketDates = getRelevantMarketDates(marketData, simulation.variables.startDate, simulation.variables.endDate);

  let lastCashAdditionDate = simulation.variables.startDate;

  for (const date of marketDates) {
    const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
    const newSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

    const currentDateIndex = marketDates.indexOf(date);
    const last30DaysFromCurrent = marketDates.slice(Math.max(0, currentDateIndex - 30), currentDateIndex);
    const signal: Signal = {
      date,
      bigDropLast30Days: last30DaysFromCurrent.some((d) => marketData.TQQQ[d].rate < -20),
      isAboveSMA200: marketData.QQQ[date].close >= marketData.QQQ[date].sma200! * 1.05,
      isBelowSMA200: marketData.QQQ[date].close < marketData.QQQ[date].sma200! * 1,
    };

    const daysSinceLastCashAddition = daysBetween(lastCashAdditionDate, date);
    if (daysSinceLastCashAddition >= 30 && simulation.variables.monthlyNewCash > 0) {
      addNewCashToPortfolio(newSnapshot.investments, simulation.variables.monthlyNewCash);
      lastCashAdditionDate = date;
    }

    updateStrategyToSnapshot(newSnapshot, marketData, signal);
    updateMockToSnapshot(newSnapshot, marketData);

    newSnapshot.date = date;
    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    simulation.portfolioSnapshots.push(newSnapshot);
  }

  calculateAnnualizedRates(simulation);

  return simulation;
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
};

const getRelevantMarketDates = (marketData: MarketData, startDate: string, endDate: string): string[] => {
  return Object.keys(marketData.TQQQ).filter((date) => date > startDate && date <= endDate);
};

const addNewCashToPortfolio = (investments: Investments, newCash: number) => {
  investments.cash += newCash;
  investments.mockTotalQQQ += newCash;
  investments.mockTotalTQQQ += newCash;
  investments.mockTotalNothing += newCash;
  investments.total = investments.cash + investments.TQQQ;
  investments.ratio = investments.TQQQ / investments.total;
};
