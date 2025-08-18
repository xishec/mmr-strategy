import { daysBetween, addDays } from "./date-utils";
import { calculateAnnualizedRates, calculateTradeStatistics, deepCopyPortfolioSnapshot } from "./functions";
import { Investments, MarketData, PortfolioSnapshot, Signal, SignalType, Simulation } from "./models";

export const runSingleSimulation = (oldSimulation: Simulation, marketData: MarketData): Simulation => {
  const simulation: Simulation = {
    ...oldSimulation,
    portfolioSnapshots: [],
    simulationVariables: { ...oldSimulation.simulationVariables },
    report: {
      orders: [],
    },
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
    newSnapshot.date = date;

    const daysSinceLastCashAddition = daysBetween(lastCashAdditionDate, date);
    if (daysSinceLastCashAddition >= 30 && simulation.simulationVariables.monthlyNewCash > 0) {
      addNewCashToPortfolio(newSnapshot.investments, simulation.simulationVariables.monthlyNewCash);
      lastCashAdditionDate = date;
    }

    updateStrategyToSnapshotYesterday(newSnapshot, marketData, signal, simulation);
    updateMockToSnapshot(newSnapshot, marketData);

    newSnapshot.signal = signal;
    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    simulation.portfolioSnapshots.push(newSnapshot);
  }

  calculateAnnualizedRates(simulation);
  calculateTradeStatistics(simulation);
  // console.log("=== SIMULATION REPORT ===");
  // console.log("Orders:", simulation.report.orders);
  // console.log("Trade Statistics:", simulation.report.tradeStatistics);
  return simulation;
};

export const getYesterdaySignal = (
  date: string,
  marketData: MarketData,
  marketDates: string[],
  simulation: Simulation
): Signal => {
  const todayIndex = marketDates.indexOf(date);
  const yesterdayIndex = todayIndex - 1;
  const yesterdayDate = marketDates[yesterdayIndex];
  const yesterdaySnapshot = simulation.portfolioSnapshots[yesterdayIndex];

  if (!yesterdaySnapshot || !yesterdaySnapshot.signal) {
    return {
      date,
      bigDropLast30Days: false,
      bigPullbackLast30Days: false,
      isAboveSMA200: false,
      isBelowSMA200: false,
      signalType: SignalType.WaitingForRecovery,
    };
  }

  const yesterdaySignal = yesterdaySnapshot.signal;

  const startDate = addDays(yesterdayDate, -180);
  const yesterdayIdx = marketDates.indexOf(yesterdayDate);
  const relevantDates = marketDates
    .slice(Math.max(0, yesterdayIdx - 180), yesterdayIdx + 1)
    .filter((date) => date >= startDate);

  const lastPeriodMaxClose = relevantDates
    .map((date) => marketData.QQQ[date]?.close || 0)
    .reduce((max, closePrice) => Math.max(max, closePrice), 0);

  const QQQPullBack = marketData.QQQ[yesterdayDate].close / lastPeriodMaxClose;
  const recentBigPullback = QQQPullBack < 0.75;

  const recentlyBelowSMA200 =
    marketData.QQQ[yesterdayDate].sma && marketData.QQQ[yesterdayDate].close < marketData.QQQ[yesterdayDate].sma! * 0.9;

  const isAboveSMA200 = marketData.QQQ[yesterdayDate].close >= marketData.QQQ[yesterdayDate].sma! * 1.05;

  let signalType = SignalType.Hold;
  switch (yesterdaySignal.signalType) {
    case SignalType.Buy:
      signalType = SignalType.Hold;
      break;

    case SignalType.Hold:
      if (recentBigPullback) {
        signalType = SignalType.Sell;
      } else {
        signalType = SignalType.Hold;
      }
      break;

    case SignalType.Sell:
      signalType = SignalType.WaitingForDrop;
      break;

    case SignalType.WaitingForDrop:
      if (recentlyBelowSMA200) {
        signalType = SignalType.WaitingForRecovery;
      } else {
        signalType = SignalType.WaitingForDrop;
      }
      break;

    case SignalType.WaitingForRecovery:
      if (isAboveSMA200) {
        signalType = SignalType.Buy;
      } else {
        signalType = SignalType.WaitingForRecovery;
      }
      break;

    default:
      break;
  }

  // console.log(date, signalType);

  // const recentBigDrop = last120DaysFromCurrent.some((d) => marketData.TQQQ[d]?.rate < -20);

  return {
    date,
    bigDropLast30Days: false,
    bigPullbackLast30Days: recentBigPullback,
    isAboveSMA200,
    isBelowSMA200: recentBigPullback,
    signalType,
  };
};

const updateStrategyToSnapshotYesterday = (
  newSnapshot: PortfolioSnapshot,
  marketData: MarketData,
  signal: Signal,
  simulation: Simulation
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
      // report
      simulation.report.orders.push({
        date: newSnapshot.date,
        type: SignalType.Sell,
        deltaMoney: newSnapshot.investments.total,
      });
      break;
    case SignalType.Buy:
      // buy
      newSnapshot.investments.TQQQ = newSnapshot.investments.total;
      newSnapshot.investments.cash = 0;
      newSnapshot.investments.ratio = 1;
      // report
      simulation.report.orders.push({
        date: newSnapshot.date,
        type: SignalType.Buy,
        deltaMoney: newSnapshot.investments.total,
      });
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
