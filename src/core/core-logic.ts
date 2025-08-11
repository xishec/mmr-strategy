import { daysBetween } from "./date-utils";
import { calculateAnnualizedRates, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, Signal, Simulation, SimulationVariables } from "./models";

export const runSingleSimulation = (oldSimulation: Simulation, marketData: MarketData): Simulation => {
  const simulation: Simulation = {
    ...oldSimulation,
    portfolioSnapshots: [],
    simulationVariables: { ...oldSimulation.simulationVariables },
  };

  const marketDates = getRelevantMarketDates(
    marketData,
    simulation.simulationVariables.startDate,
    simulation.simulationVariables.endDate
  );

  let lastCashAdditionDate = simulation.simulationVariables.startDate;
  let lastSignal: Signal | null = null;

  for (const date of marketDates) {
    const signal = getYesterdaySignal(date, marketData, marketDates, simulation.simulationVariables, lastSignal);

    const lastSnapshot =
      simulation.portfolioSnapshots.length === 0
        ? createMockPortfolioSnapshot(simulation, signal)
        : simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
    const newSnapshot = deepCopyPortfolioSnapshot(lastSnapshot);

    const daysSinceLastCashAddition = daysBetween(lastCashAdditionDate, date);
    if (daysSinceLastCashAddition >= 30 && simulation.simulationVariables.monthlyNewCash > 0) {
      addNewCashToPortfolio(newSnapshot.investments, simulation.simulationVariables.monthlyNewCash);
      lastCashAdditionDate = date;
    }

    updateStrategyToSnapshot(newSnapshot, marketData, signal);
    updateMockToSnapshot(newSnapshot, marketData);

    newSnapshot.date = date;
    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    simulation.portfolioSnapshots.push(newSnapshot);
    lastSignal = signal;
  }

  calculateAnnualizedRates(simulation);

  return simulation;
};

const getYesterdaySignal = (
  date: string,
  marketData: MarketData,
  marketDates: string[],
  simulationVariables: SimulationVariables,
  lastSignal: Signal | null
): Signal => {
  const todayIndex = marketDates.indexOf(date);
  const indexToCheck = todayIndex > 0 ? todayIndex - 1 : 0;
  const last30DaysFromCurrent = marketDates.slice(Math.max(0, indexToCheck - 30), indexToCheck);

  // Safety check: ensure both QQQ and TQQQ data exist for this date
  const qqqData = marketData.QQQ[date];
  const tqqqData = marketData.TQQQ[date];

  if (!qqqData || !tqqqData) {
    throw new Error(`Missing market data for date ${date}. QQQ: ${!!qqqData}, TQQQ: ${!!tqqqData}`);
  }

  const bigDropLast30Days = last30DaysFromCurrent.some((d) => marketData.TQQQ[d]?.rate < -20);
  const isAboveSMA200 = qqqData.close >= qqqData.sma200! * (1 + simulationVariables.SMAUpMargin);
  const isBelowSMA200 = qqqData.close < qqqData.sma200! * (1 + simulationVariables.SMADownMargin);

  const combinedShouldPanicSignal = isBelowSMA200 || bigDropLast30Days;
  const isNew = !lastSignal || (!lastSignal.combinedShouldPanicSignal && combinedShouldPanicSignal);

  return {
    date,
    bigDropLast30Days,
    isAboveSMA200,
    isBelowSMA200,
    combinedShouldPanicSignal,
    isNew,
  };
};

const updateStrategyToSnapshot = (newSnapshot: PortfolioSnapshot, marketData: MarketData, signal: Signal) => {
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;
  const TQQQOvernightRate = marketData.TQQQ[newSnapshot.date].overnight_rate || 0;
  const TQQQDayRate = marketData.TQQQ[newSnapshot.date].day_rate || 0;

  if (signal.isNew) {
    if (signal.combinedShouldPanicSignal) {
      // apply overnight rate first
      newSnapshot.investments.TQQQ *= TQQQOvernightRate / 100 + 1;
      newSnapshot.investments.cash *= 1;
      newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
      newSnapshot.signal = signal;
      // panic
      newSnapshot.investments.TQQQ = 0;
      newSnapshot.investments.cash = newSnapshot.investments.total;
      newSnapshot.investments.ratio = 0;
    } else {
      // all-in
      newSnapshot.investments.TQQQ = newSnapshot.investments.total;
      newSnapshot.investments.cash = 0;
      newSnapshot.investments.ratio = 1;
      // apply day rate after all-in
      newSnapshot.investments.TQQQ *= TQQQDayRate / 100 + 1;
      newSnapshot.investments.cash *= 1;
      newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
      newSnapshot.signal = signal;
    }
  } else {
    if (signal.combinedShouldPanicSignal) {
      // panic
      newSnapshot.investments.TQQQ = 0;
      newSnapshot.investments.cash = newSnapshot.investments.total;
      newSnapshot.investments.ratio = 0;
    } else {
      // all-in
      newSnapshot.investments.TQQQ = newSnapshot.investments.total;
      newSnapshot.investments.cash = 0;
      newSnapshot.investments.ratio = 1;
    }
    newSnapshot.investments.TQQQ *= TQQQRate / 100 + 1;
    newSnapshot.investments.cash *= 1;
    newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
    newSnapshot.signal = signal;
  }
};

const updateMockToSnapshot = (newSnapshot: PortfolioSnapshot, marketData: MarketData) => {
  const QQQRate = marketData.QQQ[newSnapshot.date].rate || 0;
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;

  newSnapshot.investments.mockTotalQQQ *= QQQRate / 100 + 1;
  newSnapshot.investments.mockTotalTQQQ *= TQQQRate / 100 + 1;
};

const createMockPortfolioSnapshot = (simulation: Simulation, signal: Signal): PortfolioSnapshot => {
  const investments: Investments = {
    total: simulation.simulationVariables.initialMoney,
    TQQQ: 0,
    cash: simulation.simulationVariables.initialMoney * 1,
    ratio: 0,
    mockTotalQQQ: simulation.simulationVariables.initialMoney,
    mockTotalTQQQ: simulation.simulationVariables.initialMoney,
    mockTotalNothing: simulation.simulationVariables.initialMoney,
  };

  return {
    date: signal.date,
    investments,
    peak: simulation.simulationVariables.initialMoney,
    pullback: 0,
    signal,
  };
};

const getRelevantMarketDates = (marketData: MarketData, startDate: string, endDate: string): string[] => {
  return Object.keys(marketData.TQQQ).filter(
    (date) => date > startDate && date <= endDate && marketData.QQQ[date] !== undefined
  );
};

const addNewCashToPortfolio = (investments: Investments, newCash: number) => {
  investments.cash += newCash;
  investments.mockTotalQQQ += newCash;
  investments.mockTotalTQQQ += newCash;
  investments.mockTotalNothing += newCash;
  investments.total = investments.cash + investments.TQQQ;
  investments.ratio = investments.TQQQ / investments.total;
};
