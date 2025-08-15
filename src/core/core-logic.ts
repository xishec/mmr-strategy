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

    newSnapshot.peak = Math.max(lastSnapshot.peak, newSnapshot.investments.total);
    newSnapshot.pullback = -(newSnapshot.peak - newSnapshot.investments.total) / newSnapshot.peak;
    simulation.portfolioSnapshots.push(newSnapshot);
  }

  calculateAnnualizedRates(simulation);
  calculateTradeStatistics(simulation);
  console.log("=== SIMULATION REPORT ===");
  console.log("Orders:", simulation.report.orders);
  console.log("Trade Statistics:", simulation.report.tradeStatistics);
  return simulation;
};

// export const getYesterdaySignal = (
//   date: string,
//   marketData: MarketData,
//   marketDates: string[],
//   simulation: Simulation
// ): Signal => {
//   const todayIndex = marketDates.indexOf(date);
//   const yesterdayIndex = todayIndex > 0 ? todayIndex - 1 : 0;

//   const last120DaysFromCurrent = marketDates.slice(Math.max(0, todayIndex - 90), todayIndex);

//   const dateToCheck = marketDates[todayIndex];
//   const qqqData = marketData.QQQ[dateToCheck];

//   const recentBigDrop = last120DaysFromCurrent.some((d) => marketData.TQQQ[d]?.rate < -20);
//   const isAboveSMA200 = qqqData.close >= qqqData.sma200! * 1.03;
//   const isBelowSMA200 = qqqData.close < qqqData.sma300! * 0.9;
//   const newBigPullback =
//     simulation.portfolioSnapshots.slice(-1)[0]?.pullback < -0.6 &&
//     simulation.portfolioSnapshots.slice(-2)[0]?.pullback >= -0.6;

//   const bigPullbackLast30Days = (() => {
//     if (simulation.portfolioSnapshots.length === 0) return false;

//     const startIndex = Math.max(0, todayIndex - 30);
//     const endIndex = todayIndex;
//     const last30Snapshots = simulation.portfolioSnapshots.slice(startIndex, endIndex);

//     if (last30Snapshots.length < 30) return false;

//     for (let i = 1; i < last30Snapshots.length; i++) {
//       const prevPullback = last30Snapshots[i - 1].pullback;
//       const currPullback = last30Snapshots[i].pullback;

//       if (prevPullback > -0.5 && currPullback < -0.5) {
//         return true;
//       }
//     }

//     return false;
//   })();

//   const lastPortfolioSnapshot = simulation.portfolioSnapshots[yesterdayIndex];
//   const inMarket = lastPortfolioSnapshot?.investments.ratio > 0;

//   let signalType = SignalType.Hold;
//   if (inMarket) {
//     if (recentBigDrop || newBigPullback) {
//       signalType = SignalType.Sell;
//     }
//   } else {
//     if (isAboveSMA200 && !recentBigDrop) {
//       signalType = SignalType.Buy;
//     }
//   }

//   return {
//     date,
//     bigDropLast30Days: recentBigDrop,
//     bigPullbackLast30Days,
//     isAboveSMA200,
//     isBelowSMA200,
//     signalType,
//   };
// };

// Helper functions for predicting pullbacks
const detectVolatilityExpansion = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  const lookbackDays = 20;
  const recentDates = marketDates.slice(Math.max(0, dateIndex - lookbackDays), dateIndex);

  if (recentDates.length < lookbackDays) return false;

  const recentVolatility = calculateRollingVolatility(marketData, recentDates);
  const longerTermDates = marketDates.slice(Math.max(0, dateIndex - 60), dateIndex - 20);
  const longerTermVolatility = calculateRollingVolatility(marketData, longerTermDates);

  return recentVolatility > longerTermVolatility * 2;
};

const calculateRollingVolatility = (marketData: MarketData, dates: string[]): number => {
  if (dates.length < 2) return 0;
  const returns = dates.map((d) => marketData.TQQQ[d]?.rate || 0);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
};

const detectMomentumDivergence = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  const lookback = 20;

  if (dateIndex < lookback) return false;

  const currentPrice = marketData.QQQ[date].close;
  const recentDates = marketDates.slice(dateIndex - lookback, dateIndex);
  const recentHighs = recentDates.map((d) => marketData.QQQ[d].close);
  const recentHigh = Math.max(...recentHighs);

  const isPriceAtHigh = currentPrice >= recentHigh * 0.99;

  // Simple momentum check: compare recent 5-day average rate vs previous 5-day average
  const recent5Days = marketDates.slice(dateIndex - 4, dateIndex + 1);
  const previous5Days = marketDates.slice(dateIndex - 9, dateIndex - 4);

  const recentMomentum = recent5Days.reduce((sum, d) => sum + (marketData.QQQ[d]?.rate || 0), 0) / 5;
  const previousMomentum = previous5Days.reduce((sum, d) => sum + (marketData.QQQ[d]?.rate || 0), 0) / 5;

  const momentumDeclining = recentMomentum < previousMomentum - 0.5;

  return isPriceAtHigh && momentumDeclining;
};

const detectDistributionPattern = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  const lookback = 10;

  if (dateIndex < lookback) return false;

  let distributionDays = 0;

  for (let i = dateIndex - lookback; i < dateIndex; i++) {
    const dayData = marketData.TQQQ[marketDates[i]];
    const priceChange = dayData.rate;

    // Look for days with small gains but high volume (potential distribution)
    // Since we might not have volume data, use rate volatility as proxy
    if (priceChange > 0 && priceChange < 2) {
      distributionDays++;
    }
  }

  return distributionDays >= 4;
};

const detectDangerousGapPattern = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  if (dateIndex < 5) return false;

  let largeMoveDays = 0;

  // Since we don't have open prices, look for large daily moves as proxy for gaps
  for (let i = Math.max(1, dateIndex - 4); i <= dateIndex; i++) {
    const dayData = marketData.TQQQ[marketDates[i]];
    const dailyMove = Math.abs(dayData.rate);

    // Consider moves > 3% as potentially gappy/volatile days
    if (dailyMove > 3) {
      largeMoveDays++;
    }
  }

  return largeMoveDays >= 2; // 2+ large move days in last 5 days
};

const detectConsecutiveSellingPressure = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  const lookback = 7;

  if (dateIndex < lookback) return false;

  let consecutiveSellingDays = 0;
  let maxConsecutive = 0;

  for (let i = dateIndex - lookback; i <= dateIndex; i++) {
    const dayData = marketData.TQQQ[marketDates[i]];
    const isSellingDay = dayData.rate < -1;

    if (isSellingDay) {
      consecutiveSellingDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveSellingDays);
    } else {
      consecutiveSellingDays = 0;
    }
  }

  return maxConsecutive >= 3;
};

const detectExtendedRally = (marketData: MarketData, date: string, marketDates: string[]): boolean => {
  const dateIndex = marketDates.indexOf(date);
  const qqqData = marketData.QQQ[date];

  if (!qqqData.sma200) return false;

  const distanceFromSMA200 = (qqqData.close - qqqData.sma200) / qqqData.sma200;
  const farAboveSMA200 = distanceFromSMA200 > 0.25;

  // Check consecutive up days
  let consecutiveUpDays = 0;
  for (let i = dateIndex; i >= Math.max(0, dateIndex - 10); i--) {
    if (marketData.QQQ[marketDates[i]].rate > 0) {
      consecutiveUpDays++;
    } else {
      break;
    }
  }

  return farAboveSMA200 || consecutiveUpDays >= 7;
};

export const getYesterdaySignal = (
  date: string,
  marketData: MarketData,
  marketDates: string[],
  simulation: Simulation
): Signal => {
  const todayIndex = marketDates.indexOf(date);
  const yesterdayIndex = todayIndex > 0 ? todayIndex - 1 : 0;

  const last120DaysFromCurrent = marketDates.slice(Math.max(0, yesterdayIndex - 90), yesterdayIndex);
  // const lastShortDaysFromCurrent = marketDates.slice(Math.max(0, yesterdayIndex - 2), yesterdayIndex);

  const dateToCheck = marketDates[yesterdayIndex];
  const qqqData = marketData.QQQ[dateToCheck];

  const lastPortfolioSnapshot = simulation.portfolioSnapshots[yesterdayIndex];
  // const lastYearPortfolioSnapshot =
  //   simulation.portfolioSnapshots.length >= 150
  //     ? simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 250]
  //     : null;

  const recentBigDrop = last120DaysFromCurrent.some((d) => marketData.TQQQ[d]?.rate < -20);
  const isAboveSMA200 = qqqData.close >= qqqData.sma200! * 1.05;
  // const isBelowLastYear =
  //   lastPortfolioSnapshot && lastYearPortfolioSnapshot
  //     ? lastPortfolioSnapshot.investments.mockTotalQQQ < lastYearPortfolioSnapshot.investments.mockTotalQQQ
  //     : false;
  const newBigPullback =
    simulation.portfolioSnapshots.slice(-1)[0]?.pullback < -0.6 &&
    simulation.portfolioSnapshots.slice(-2)[0]?.pullback >= -0.6;

  // Predictive pullback indicators
  const volatilityExpanding = detectVolatilityExpansion(marketData, dateToCheck, marketDates);
  const momentumDivergence = detectMomentumDivergence(marketData, dateToCheck, marketDates);
  const distributionPattern = detectDistributionPattern(marketData, dateToCheck, marketDates);
  const dangerousGaps = detectDangerousGapPattern(marketData, dateToCheck, marketDates);
  const sellingPressure = detectConsecutiveSellingPressure(marketData, dateToCheck, marketDates);
  const extendedRally = detectExtendedRally(marketData, dateToCheck, marketDates);

  // Calculate composite pullback risk score
  let pullbackRiskScore = 0;
  if (volatilityExpanding) pullbackRiskScore += 25;
  if (momentumDivergence) pullbackRiskScore += 20;
  if (distributionPattern) pullbackRiskScore += 15;
  if (dangerousGaps) pullbackRiskScore += 15;
  if (sellingPressure) pullbackRiskScore += 20;
  if (extendedRally) pullbackRiskScore += 10;

  const highPullbackRisk = pullbackRiskScore > 60;

  const inMarket = lastPortfolioSnapshot?.investments.ratio > 0;
  let signalType = SignalType.Hold;
  if (inMarket) {
    if (recentBigDrop || newBigPullback || highPullbackRisk) {
      signalType = SignalType.Sell;
    }
  } else {
    if (isAboveSMA200 && !recentBigDrop && !highPullbackRisk) {
      signalType = SignalType.Buy;
    }
  }

  return {
    date,
    bigDropLast30Days: recentBigDrop,
    bigPullbackLast30Days: newBigPullback,
    isAboveSMA200,
    isBelowSMA200: highPullbackRisk,
    signalType,
  };
};

// const updateStrategyToSnapshot = (
//   newSnapshot: PortfolioSnapshot,
//   marketData: MarketData,
//   signal: Signal,
//   simulation: Simulation
// ) => {
//   const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;
//   // const TQQQOvernightRate = marketData.TQQQ[newSnapshot.date].overnight_rate || 0;
//   // const TQQQDayRate = marketData.TQQQ[newSnapshot.date].day_rate || 0;

//   switch (signal.signalType) {
//     case SignalType.Hold:
//       if (newSnapshot.investments.ratio > 0) {
//         // if have position, add new cash
//         newSnapshot.investments.TQQQ = newSnapshot.investments.total;
//         newSnapshot.investments.cash = 0;
//         newSnapshot.investments.ratio = 1;
//       }
//       newSnapshot.investments.TQQQ *= TQQQRate / 100 + 1;
//       newSnapshot.investments.cash *= 1;
//       newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
//       newSnapshot.signal = signal;
//       break;
//     case SignalType.Sell:
//       // apply overnight rate first
//       newSnapshot.investments.TQQQ *= TQQQRate / 100 + 1;
//       newSnapshot.investments.cash *= 1;
//       newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
//       newSnapshot.signal = signal;
//       // sell
//       newSnapshot.investments.TQQQ = 0;
//       newSnapshot.investments.cash = newSnapshot.investments.total;
//       newSnapshot.investments.ratio = 0;
//       // report
//       simulation.report.orders.push({
//         date: newSnapshot.date,
//         type: SignalType.Sell,
//         deltaMoney: newSnapshot.investments.total,
//       });
//       break;
//     case SignalType.Buy:
//       // buy
//       newSnapshot.investments.TQQQ = newSnapshot.investments.total;
//       newSnapshot.investments.cash = 0;
//       newSnapshot.investments.ratio = 1;
//       // report
//       simulation.report.orders.push({
//         date: newSnapshot.date,
//         type: SignalType.Buy,
//         deltaMoney: newSnapshot.investments.total,
//       });
//       // // apply day rate after all-in
//       // newSnapshot.investments.TQQQ *= TQQQDayRate / 100 + 1;
//       // newSnapshot.investments.cash *= 1;
//       // newSnapshot.investments.total = newSnapshot.investments.TQQQ + newSnapshot.investments.cash;
//       // newSnapshot.signal = signal;
//       break;
//     default:
//       break;
//   }
// };

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
