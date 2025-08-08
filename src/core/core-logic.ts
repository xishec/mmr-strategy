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

  for (const date of marketDates) {
    const signal = getSignal(date, marketData, marketDates, simulation.simulationVariables);

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
  }

  calculateAnnualizedRates(simulation);

  return simulation;
};

const getSignal = (
  date: string,
  marketData: MarketData,
  marketDates: string[],
  simulationVariables: SimulationVariables
): Signal => {
  const currentDateIndex = marketDates.indexOf(date);
  const last30DaysFromCurrent = marketDates.slice(Math.max(0, currentDateIndex - 30), currentDateIndex);
  console.log(simulationVariables.SMAUpMargin, simulationVariables.SMADownMargin);
  return {
    date,
    bigDropLast30Days: last30DaysFromCurrent.some((d) => marketData.TQQQ[d].rate < -20),
    isAboveSMA200: marketData.QQQ[date].close >= marketData.QQQ[date].sma200! * (1 + simulationVariables.SMAUpMargin),
    isBelowSMA200: marketData.QQQ[date].close < marketData.QQQ[date].sma200! * (1 - simulationVariables.SMADownMargin),
  };
};

const updateStrategyToSnapshot = (newSnapshot: PortfolioSnapshot, marketData: MarketData, signal: Signal) => {
  const TQQQRate = marketData.TQQQ[newSnapshot.date].rate || 0;

  if (signal.isAboveSMA200 && !signal.bigDropLast30Days) {
    // all-in
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
