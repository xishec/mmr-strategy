import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from "./models";

const DEBUG = true;

export const loadData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData | null) => void
) => {
  try {
    setDataLoading(true);
    setMarketData({
      QQQ: (await import("../data/QQQ.json")).default,
      TQQQ: (await import("../data/TQQQ.json")).default,
    });
  } catch (error) {
    console.error("Error loading data:", error);
  } finally {
    setDataLoading(false);
  }
};

const setupInitialPortfolio = (simulation: Simulation, marketData: MarketData) => {
  const investments: Investments = {
    Total: simulation.initialMoney,
    TQQQ: simulation.initialMoney * 0.6,
    Cash: simulation.initialMoney * 0.4,
    Ratio: 0.6,
    MockTotalQQQ: simulation.initialMoney,
    MockTotalTQQQ: simulation.initialMoney,
  };

  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.startingDate)!;
  simulation.startingDate = firstValidDate;

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    nextTarget: simulation.initialMoney * (1 + simulation.variables.targetRate),
    peak: simulation.initialMoney,
    pullback: 0,
    lastRebalanceDate: firstValidDate,
    nextRebalanceDate: addDaysToDate(firstValidDate, simulation.variables.rebalanceDays),
  };

  simulation.portfolioSnapshots = [portfolioSnapshot];

  const rebalanceLog: RebalanceLog = {
    date: firstValidDate,
    total: investments.Total,
    cumulativeRateSinceLastRebalance: 0,
    rebalanceType: RebalanceType.Skip,
  };
  simulation.rebalanceLogs = [rebalanceLog];

  if (DEBUG)
    console.log(
      "date",
      portfolioSnapshot.date,
      "$$$",
      portfolioSnapshot.investments.Total.toFixed(3),
      "target",
      portfolioSnapshot.nextTarget.toFixed(3),
      "TQQQ",
      portfolioSnapshot.investments.TQQQ.toFixed(3),
      "Rate",
      (portfolioSnapshot.cumulativeRateSinceRebalance * 100).toFixed(3)
    );
  if (DEBUG) console.log("\n");
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  // Create a deep copy of the simulation to avoid mutations
  const simulationCopy: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
  };

  setupInitialPortfolio(simulationCopy, marketData);

  for (const [date, TQQQDelta] of Object.entries(marketData.TQQQ)) {
    const QQQDelta = marketData.QQQ[date];
    if (date <= simulationCopy.startingDate) continue;

    const portfolioSnapshot = computePortfolioSnapshot(simulationCopy, date, TQQQDelta, QQQDelta);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      rebalance(portfolioSnapshot, simulationCopy);
    }
  }
  rebalance(simulationCopy.portfolioSnapshots[simulationCopy.portfolioSnapshots.length - 1], simulationCopy);
  setSimulation(simulationCopy);
};

const computePortfolioSnapshot = (simulation: Simulation, date: string, TQQQDelta: number, QQQDelta: number) => {
  const lastInvestmentsSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newPortfolioSnapshot = { ...lastInvestmentsSnapshot };

  const newTQQQ = lastInvestmentsSnapshot.investments.TQQQ * (TQQQDelta / 100 + 1);
  const newCash = lastInvestmentsSnapshot.investments.Cash * (1 + simulation.variables!.CashDayRate);
  const newTotal = newTQQQ + newCash;
  const investments: Investments = {
    Total: newTotal,
    TQQQ: newTQQQ,
    Cash: newCash,
    Ratio: newTQQQ / (newTQQQ + newCash),
    MockTotalQQQ: lastInvestmentsSnapshot.investments.MockTotalQQQ * (QQQDelta / 100 + 1),
    MockTotalTQQQ: lastInvestmentsSnapshot.investments.MockTotalTQQQ * (TQQQDelta / 100 + 1),
  };

  newPortfolioSnapshot.date = date;
  newPortfolioSnapshot.investments = investments;
  newPortfolioSnapshot.peak = Math.max(lastInvestmentsSnapshot.peak, newTotal);
  newPortfolioSnapshot.pullback = -(newPortfolioSnapshot.peak - newTotal) / newPortfolioSnapshot.peak;
  newPortfolioSnapshot.cumulativeRateSinceRebalance =
    (1 + newPortfolioSnapshot.cumulativeRateSinceRebalance) * (1 + TQQQDelta / 100) - 1;
  simulation.portfolioSnapshots.push(newPortfolioSnapshot);

  return newPortfolioSnapshot;
};

const rebalance = (portfolioSnapshot: PortfolioSnapshot, simulation: Simulation) => {
  const variables = simulation.variables!;
  const investments = portfolioSnapshot.investments;

  // Double DROP - get the second-to-last snapshot
  const lastRebalanceRate =
    simulation.rebalanceLogs[simulation.rebalanceLogs.length - 1].cumulativeRateSinceLastRebalance;

  let rebalanceType: RebalanceType = RebalanceType.Rebalance;

  // Double DROP
  if (lastRebalanceRate < variables.DoubleDropRate) {
    if (DEBUG) console.log("double drop");
    rebalanceType = RebalanceType.Skip;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // DROP
  else if (portfolioSnapshot.cumulativeRateSinceRebalance < variables.DropRate) {
    if (DEBUG) console.log("drop");
    rebalanceType = RebalanceType.Skip;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // SPIKE
  else if (portfolioSnapshot.cumulativeRateSinceRebalance > variables.SpikeRate) {
    if (DEBUG) console.log("spike");
    investments.TQQQ = investments.Total * variables.TargetRatio;
    investments.Cash = investments.Total * (1 - variables.TargetRatio);

    rebalanceType = RebalanceType.Reset;
    portfolioSnapshot.nextTarget = investments.Total * (1 + simulation.variables.targetRate);
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // Excess
  else if (investments.Total >= portfolioSnapshot.nextTarget) {
    if (DEBUG) console.log("excess");
    const excess = investments.Total - portfolioSnapshot.nextTarget;
    const actualExcess = Math.min(excess, investments.TQQQ);

    investments.TQQQ -= actualExcess;
    investments.Cash += actualExcess;

    portfolioSnapshot.nextTarget *= 1 + simulation.variables.targetRate;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // Shortfall
  else if (investments.Total < portfolioSnapshot.nextTarget) {
    if (DEBUG) console.log("shortfall");
    const shortfall = portfolioSnapshot.nextTarget - investments.Total;
    const actualShortfall = Math.min(shortfall, investments.Cash);

    investments.TQQQ += actualShortfall;
    investments.Cash -= actualShortfall;

    portfolioSnapshot.nextTarget *= 1 + simulation.variables.targetRate;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  } else {
    console.log("bug");
  }

  if (DEBUG)
    console.log(
      "date",
      portfolioSnapshot.date,
      "$$$",
      portfolioSnapshot.investments.Total.toFixed(3),
      "nextTarget",
      portfolioSnapshot.nextTarget.toFixed(3),
      "TQQQ",
      portfolioSnapshot.investments.TQQQ.toFixed(3),
      "Rate",
      (portfolioSnapshot.cumulativeRateSinceRebalance * 100).toFixed(3)
    );

  const rebalanceLog: RebalanceLog = {
    date: portfolioSnapshot.date,
    total: investments.Total,
    cumulativeRateSinceLastRebalance: portfolioSnapshot.cumulativeRateSinceRebalance,
    rebalanceType: rebalanceType,
  };
  simulation.rebalanceLogs.push(rebalanceLog);

  portfolioSnapshot.cumulativeRateSinceRebalance = 0;

  if (DEBUG) console.log("\n");
};

const addDaysToDate = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().split("T")[0];
};
