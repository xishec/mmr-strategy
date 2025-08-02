import { Investments, MarketData, PortfolioSnapshot, RebalanceLog, RebalanceType, Simulation } from "./models";

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

  simulation.variables = {
    rebalanceDays: 90,
    targetRate: 0.09,
    CashDayRate: 0,
    TargetRatio: 0.6,
    SpikeRate: 0.18,
    DropRate: -0.09,
    DoubleDropRate: -0.18,
  };

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    nextTarget: simulation.initialMoney * (1 + simulation.variables.targetRate),
    peak: simulation.initialMoney,
    pullback: 1,
    lastRebalanceDate: firstValidDate,
    nextRebalanceDate: addDaysToDate(firstValidDate, 90),
  };

  simulation.portfolioSnapshots = [portfolioSnapshot];

  const rebalanceLog: RebalanceLog = {
    date: firstValidDate,
    cumulativeRateSinceLastRebalance: 0,
    rebalanceType: RebalanceType.Skip,
  };
  simulation.rebalanceLogs = [rebalanceLog];

  // console.log(
  //   "date",
  //   portfolioSnapshot.date,
  //   "$$$",
  //   portfolioSnapshot.investments.Total.toFixed(3),
  //   "target",
  //   portfolioSnapshot.nextTarget.toFixed(3),
  //   "TQQQ",
  //   portfolioSnapshot.investments.TQQQ.toFixed(3),
  //   "Rate",
  //   (portfolioSnapshot.cumulativeRateSinceRebalance * 100).toFixed(3)
  // );
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  setupInitialPortfolio(simulation, marketData);

  for (const [date, TQQQDelta] of Object.entries(marketData.TQQQ)) {
    const QQQDelta = marketData.QQQ[date];
    if (date <= simulation.startingDate) continue;

    const portfolioSnapshot = computePortfolioSnapshot(simulation, date, TQQQDelta, QQQDelta);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      rebalance(portfolioSnapshot, simulation);
    }
  }
  rebalance(simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1], simulation);
  setSimulation(simulation);
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
  newPortfolioSnapshot.pullback = 1 + (newTotal - newPortfolioSnapshot.peak) / newPortfolioSnapshot.peak;
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
    // console.log("double drop");
    rebalanceType = RebalanceType.Skip;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // DROP
  else if (portfolioSnapshot.cumulativeRateSinceRebalance < variables.DropRate) {
    // console.log("drop");
    rebalanceType = RebalanceType.Skip;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // SPIKE
  else if (portfolioSnapshot.cumulativeRateSinceRebalance > variables.SpikeRate) {
    // console.log("spike");
    investments.TQQQ = investments.Total * variables.TargetRatio;
    investments.Cash = investments.Total * (1 - variables.TargetRatio);

    rebalanceType = RebalanceType.Reset;
    portfolioSnapshot.nextTarget = investments.Total * (1 + simulation.variables.targetRate);
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // Excess
  else if (investments.Total >= portfolioSnapshot.nextTarget) {
    // if (investments.Total === portfolioSnapshot.nextTarget) console.log("zero");
    // else console.log("excess");
    const excess = investments.Total - portfolioSnapshot.nextTarget;
    const actualExcess = Math.min(excess, investments.TQQQ);

    investments.TQQQ -= actualExcess;
    investments.Cash += actualExcess;

    portfolioSnapshot.nextTarget *= 1 + simulation.variables.targetRate;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  }

  // Shortfall
  else if (investments.Total < portfolioSnapshot.nextTarget) {
    // console.log("shortfall");
    const shortfall = portfolioSnapshot.nextTarget - investments.Total;
    const actualShortfall = Math.min(shortfall, investments.Cash);

    investments.TQQQ += actualShortfall;
    investments.Cash -= actualShortfall;

    portfolioSnapshot.nextTarget *= 1 + simulation.variables.targetRate;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  } else {
    console.log("bug");
  }

  // console.log(
  //   "date",
  //   portfolioSnapshot.date,
  //   "$$$",
  //   portfolioSnapshot.investments.Total.toFixed(3),
  //   "nextTarget",
  //   portfolioSnapshot.nextTarget.toFixed(3),
  //   "TQQQ",
  //   portfolioSnapshot.investments.TQQQ.toFixed(3),
  //   "Rate",
  //   (portfolioSnapshot.cumulativeRateSinceRebalance * 100).toFixed(3)
  // );

  const rebalanceLog: RebalanceLog = {
    date: portfolioSnapshot.date,
    cumulativeRateSinceLastRebalance: portfolioSnapshot.cumulativeRateSinceRebalance,
    rebalanceType: rebalanceType,
  };
  simulation.rebalanceLogs.push(rebalanceLog);

  portfolioSnapshot.cumulativeRateSinceRebalance = 0;

  // console.log("\n");
};

const addDaysToDate = (date: string, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
