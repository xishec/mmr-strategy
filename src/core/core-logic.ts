import { daysBetween } from "./date-utils";
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

const getInitialSignal = (date: string, marketData: MarketData, startDate: string): Signal => {
  // Get all available market dates before and including the start date for historical analysis
  const allMarketDates = Object.keys(marketData.TQQQ)
    .filter((d) => marketData.QQQ[d] !== undefined)
    .sort();

  const startDateIndex = allMarketDates.findIndex((d) => d >= startDate);
  if (startDateIndex <= 0) {
    // Not enough historical data, default to WaitingForRecovery
    return {
      date,
      hasRedMarker: false,
      hasOrangeMarker: false,
      hasYellowMarker: false,
      hasBlueMarker: false,
      hasGreenTriangle: false,
      hasBlackTriangle: false,
      hasXMarker: false,
      belowSMA: false,
      signalType: SignalType.WaitingForRecovery,
    };
  }

  // Use the day before start date to determine initial signal
  const previousDate = allMarketDates[startDateIndex - 1];
  const previousIndex = startDateIndex - 1;

  // Calculate the same conditions as in the main signal logic
  const fastDrop = allMarketDates
    .slice(Math.max(0, previousIndex - 1), previousIndex + 1)
    .some((d) => marketData.TQQQ[d].rate < -20);

  const lastPeriodMaxClose = allMarketDates
    .slice(Math.max(0, previousIndex - 180), previousIndex + 1)
    .map((d) => marketData.QQQ[d]?.close || 0)
    .reduce((max, closePrice) => Math.max(max, closePrice), 0);
  const QQQPullBack = marketData.QQQ[previousDate].close / lastPeriodMaxClose;
  const mediumDrop = QQQPullBack < 0.75;

  const belowSMAForAWhile = allMarketDates
    .slice(Math.max(0, previousIndex - 30), previousIndex + 1)
    .every((d) => marketData.QQQ[d].close < marketData.QQQ[d].sma! * 1);
  const hadABigDrop = allMarketDates
    .slice(Math.max(0, previousIndex - 5), previousIndex + 1)
    .every((d) => marketData.QQQ[d].close < marketData.QQQ[d].sma! * 0.9);
  const slowDrop = belowSMAForAWhile && hadABigDrop;

  const isAboveSMAForAWhile = (() => {
    const windowDates = allMarketDates.slice(Math.max(0, previousIndex - 30), previousIndex + 1);
    if (windowDates.length === 0) return false;
    const aboveCount = windowDates.filter(
      (d) => marketData.QQQ[d].sma && marketData.QQQ[d].close >= marketData.QQQ[d].sma! * 1.1
    ).length;
    return aboveCount / windowDates.length >= 0.8;
  })();
  const growTooFast = isAboveSMAForAWhile;

  const isBelow90SMA200 =
    marketData.QQQ[previousDate].sma && marketData.QQQ[previousDate].close < marketData.QQQ[previousDate].sma! * 0.9;
  const isBelow95SMA200 =
    marketData.QQQ[previousDate].sma && marketData.QQQ[previousDate].close < marketData.QQQ[previousDate].sma! * 0.95;
  const isAbove105SMA200 = marketData.QQQ[previousDate].close >= marketData.QQQ[previousDate].sma! * 1.05;

  // Determine initial signal type based on market conditions
  let signalType = SignalType.Hold;

  if (isAbove105SMA200) {
    signalType = SignalType.Buy;
  } else if (isBelow90SMA200) {
    signalType = SignalType.WaitingForRecovery;
  } else if (isBelow95SMA200) {
    signalType = SignalType.WaitingForRecovery;
  } else if (fastDrop || mediumDrop || slowDrop) {
    signalType = SignalType.WaitingForDrop;
  } else if (growTooFast) {
    signalType = SignalType.WaitingForSmallDrop;
  } else {
    signalType = SignalType.WaitingForRecovery;
  }

  return {
    date,
    hasRedMarker: fastDrop,
    hasOrangeMarker: mediumDrop,
    hasYellowMarker: slowDrop,
    hasBlueMarker: growTooFast,
    hasGreenTriangle: signalType === SignalType.Buy,
    hasBlackTriangle: false, // Initial signal won't be a sell
    hasXMarker: false,
    belowSMA: false,
    signalType,
  };
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
    return getInitialSignal(date, marketData, simulation.simulationVariables.startDate);
  }

  const yesterdaySignal = yesterdaySnapshot.signal;

  // const sumLastRates = marketDates
  //   .slice(Math.max(0, yesterdayIndex - 5), yesterdayIndex + 1)
  //   .map((date) => marketData.TQQQ[date]?.rate || 0)
  //   .reduce((sum, rate) => sum + rate, 0);
  const fastDrop = simulation.portfolioSnapshots
    .slice(-2)
    .some((snapshot) => marketData.TQQQ[snapshot.date].rate < -20);

  const lookbackPeriod = marketDates.slice(Math.max(0, yesterdayIndex - 180), yesterdayIndex + 1);
  const lastPeriodMaxClose = lookbackPeriod
    .map((date) => marketData.QQQ[date]?.close || 0)
    .reduce((max, closePrice) => Math.max(max, closePrice), 0);
  const QQQPullBack = marketData.QQQ[yesterdayDate].close / lastPeriodMaxClose;
  const mediumDrop = QQQPullBack < 0.75;

  // Find the date when the max close occurred and calculate days since
  // const maxCloseDate =
  //   lookbackPeriod.find((date) => marketData.QQQ[date]?.close === lastPeriodMaxClose) || yesterdayDate;
  // const maxCloseDateIndex = marketDates.indexOf(maxCloseDate);
  // const daysSinceLastPeriodMaxClose = yesterdayIndex - maxCloseDateIndex;

  const belowSMAForAWhile = marketDates
    .slice(Math.max(0, yesterdayIndex - 30), yesterdayIndex + 1)
    .every((date) => marketData.QQQ[date].close < marketData.QQQ[date].sma! * 1);
  const hadABigDrop = marketDates
    .slice(Math.max(0, yesterdayIndex - 5), yesterdayIndex + 1)
    .every((date) => marketData.QQQ[date].close < marketData.QQQ[date].sma! * 0.9);
  const slowDrop = belowSMAForAWhile && hadABigDrop;

  // Use a 90% threshold rather than requiring every single day to be above SMA * 1.1
  const isAboveSMAForAWhile = (() => {
    const windowDates = marketDates.slice(Math.max(0, yesterdayIndex - 30), yesterdayIndex + 1);
    if (windowDates.length === 0) return false;
    const aboveCount = windowDates.filter(
      (d) => marketData.QQQ[d].sma && marketData.QQQ[d].close >= marketData.QQQ[d].sma! * 1.09
    ).length;
    return aboveCount / windowDates.length >= 0.75;
  })();
  const wasRecovering = simulation.portfolioSnapshots
    .slice(-200)
    .some((snapshot) => snapshot.signal.signalType === SignalType.WaitingForRecovery);
  const growTooFast = isAboveSMAForAWhile && !wasRecovering;

  const isBelow90SMA200 =
    marketData.QQQ[yesterdayDate].sma && marketData.QQQ[yesterdayDate].close < marketData.QQQ[yesterdayDate].sma! * 0.9;
  const isBelow95SMA200 =
    marketData.QQQ[yesterdayDate].sma &&
    marketData.QQQ[yesterdayDate].close < marketData.QQQ[yesterdayDate].sma! * 0.95;
  const isAbove105SMA200 = marketData.QQQ[yesterdayDate].close >= marketData.QQQ[yesterdayDate].sma! * 1.05;

  const waitingForSmallDropForTooLong =
    simulation.portfolioSnapshots.slice(-60).every((snapshot) => snapshot.signal.signalType !== SignalType.Sell) &&
    yesterdaySignal.signalType === SignalType.WaitingForSmallDrop;

  const delta = marketDates
    .slice(Math.max(0, yesterdayIndex - 20), yesterdayIndex + 1)
    .map((date) => marketData.QQQ[date]?.rate || 0)
    .reduce((sum, rate) => sum + Math.abs(rate), 0);
  const stable = delta < 35;

  let hasXMarker = false;

  let signalType = SignalType.Hold;
  switch (yesterdaySignal.signalType) {
    case SignalType.Buy:
      signalType = SignalType.Hold;
      break;

    case SignalType.Hold:
      if (fastDrop || mediumDrop || slowDrop || growTooFast) {
        signalType = SignalType.Sell;
      } else {
        signalType = SignalType.Hold;
      }
      break;

    case SignalType.Sell:
      if (growTooFast) {
        signalType = SignalType.WaitingForSmallDrop;
      } else {
        signalType = SignalType.WaitingForDrop;
      }
      break;

    case SignalType.WaitingForSmallDrop:
      if (slowDrop || mediumDrop || fastDrop) {
        signalType = SignalType.WaitingForDrop;
      } else if (isBelow95SMA200) {
        signalType = SignalType.WaitingForRecovery;
      } else if (waitingForSmallDropForTooLong && !growTooFast && stable) {
        signalType = SignalType.Buy;
      } else {
        signalType = SignalType.WaitingForSmallDrop;
      }
      break;

    case SignalType.WaitingForDrop:
      if (isBelow90SMA200) {
        signalType = SignalType.WaitingForRecovery;
      } else {
        signalType = SignalType.WaitingForDrop;
      }
      break;

    case SignalType.WaitingForRecovery:
      if (isAbove105SMA200) {
        signalType = SignalType.Buy;
      } else {
        signalType = SignalType.WaitingForRecovery;
      }
      break;

    default:
      break;
  }

  return {
    date,
    hasRedMarker: fastDrop,
    hasOrangeMarker: mediumDrop,
    hasYellowMarker: slowDrop,
    hasBlueMarker: growTooFast,
    hasGreenTriangle: signalType === SignalType.Buy,
    hasBlackTriangle: signalType === SignalType.Sell,
    belowSMA: isBelow95SMA200 || false,
    hasXMarker: hasXMarker,
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
        currentTotal: newSnapshot.investments.total,
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
        currentTotal: newSnapshot.investments.total,
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
