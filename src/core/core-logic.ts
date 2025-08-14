import { daysBetween } from "./date-utils";
import { calculateAnnualizedRates, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, Signal, SignalType, Simulation } from "./models";

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

  for (const date of marketDates) {
    const signal = getYesterdaySignal(date, marketData, marketDates, simulation);

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

    updateStrategyToSnapshot(newSnapshot, marketData, signal, simulation.simulationVariables.buyAtOpen);
    updateMockToSnapshot(newSnapshot, marketData);

    newSnapshot.date = date;
    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    simulation.portfolioSnapshots.push(newSnapshot);
  }

  calculateAnnualizedRates(simulation);

  return simulation;
};

export const getYesterdaySignal = (
  date: string,
  marketData: MarketData,
  marketDates: string[],
  simulation: Simulation
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
  const isAboveSMA200 = qqqData.close >= qqqData.sma200! * (1 - 0.05);
  const isBelowSMA200 = qqqData.close < qqqData.sma200! * (1 + 0.05);

  const bigPullbackLast30Days = (() => {
    if (simulation.portfolioSnapshots.length === 0) return false;
    
    const startIndex = Math.max(0, indexToCheck - 30);
    const endIndex = indexToCheck;
    const last30Snapshots = simulation.portfolioSnapshots.slice(startIndex, endIndex);

    if (last30Snapshots.length < 2) return false;

    for (let i = 1; i < last30Snapshots.length; i++) {
      const prevPullback = last30Snapshots[i - 1].pullback;
      const currPullback = last30Snapshots[i].pullback;

      if (prevPullback > -0.4 && currPullback < -0.4) {
        return true;
      }
    }

    return false;
  })();

  const lastPortfolioSnapshot = simulation.portfolioSnapshots[indexToCheck];
  let signalType = SignalType.Hold;
  if (isBelowSMA200 || bigDropLast30Days || bigPullbackLast30Days) {
    if (lastPortfolioSnapshot?.investments.ratio === 0) {
      signalType = SignalType.Hold;
    } else {
      signalType = SignalType.Sell;
    }
  } else if (isAboveSMA200) {
    if (lastPortfolioSnapshot?.investments.ratio > 0) {
      signalType = SignalType.Hold;
    } else {
      signalType = SignalType.Buy;
    }
  }

  return {
    date,
    bigDropLast30Days,
    bigPullbackLast30Days,
    isAboveSMA200,
    isBelowSMA200,
    signalType,
  };
};

const updateStrategyToSnapshot = (
  newSnapshot: PortfolioSnapshot,
  marketData: MarketData,
  signal: Signal,
  buyAtOpen: boolean
) => {
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;
  const TQQQOvernightRate = marketData.TQQQ[newSnapshot.date].overnight_rate || 0;
  const TQQQDayRate = marketData.TQQQ[newSnapshot.date].day_rate || 0;

  switch (signal.signalType) {
    case SignalType.Hold:
      if (newSnapshot.investments.ratio > 0) {
        // if have position, add new cash
        newSnapshot.investments.TQQQ = newSnapshot.investments.total;
        newSnapshot.investments.cash = 0;
        newSnapshot.investments.ratio = 1;
      }
      newSnapshot.investments.TQQQ *= TQQQRate / 100 + 1;
      newSnapshot.investments.cash *= 1;
      newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
      newSnapshot.signal = signal;
      break;
    case SignalType.Sell:
      // apply overnight rate first
      newSnapshot.investments.TQQQ *= TQQQOvernightRate / 100 + 1;
      newSnapshot.investments.cash *= 1;
      newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
      newSnapshot.signal = signal;
      // sell
      newSnapshot.investments.TQQQ = 0;
      newSnapshot.investments.cash = newSnapshot.investments.total;
      newSnapshot.investments.ratio = 0;
      break;
    case SignalType.Buy:
      // buy
      newSnapshot.investments.TQQQ = newSnapshot.investments.total;
      newSnapshot.investments.cash = 0;
      newSnapshot.investments.ratio = 1;
      // apply day rate after all-in
      newSnapshot.investments.TQQQ *= TQQQDayRate / 100 + 1;
      newSnapshot.investments.cash *= 1;
      newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
      newSnapshot.signal = signal;
      break;
    default:
      break;
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
