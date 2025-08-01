import { Investments, MarketData, PortfolioSnapshot, Simulation, Variables } from "./models";

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
    TQQQMoney: simulation.initialMoney * 0.6,
    Cash: simulation.initialMoney * 0.4,
    Ratio: 0.6,
  };

  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.startingDate)!;
  simulation.startingDate = firstValidDate;

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    lastTarget: simulation.initialMoney,
    nextTarget: simulation.initialMoney * 1.09,
    peak: simulation.initialMoney,
    pullback: 1,
    nextRebalanceDate: addDaysToDate(firstValidDate, 90),
  };
  simulation.currentSnapshotIndex = 0;
  simulation.variables = {
    rebalanceDays: 90,
    TQQQTargetRate: 0.09,
    CashDayRate: 0,
    TargetRatio: 0.6,
    SpikeRate: 0.18,
    DropRate: -0.09,
  };
  simulation.portfolioSnapshots = [portfolioSnapshot];

  console.log(
    "date",
    portfolioSnapshot.date,
    "$$$",
    portfolioSnapshot.investments.Total.toFixed(3),
    "TQQQMoney",
    portfolioSnapshot.investments.TQQQMoney.toFixed(3)
  );
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  setupInitialPortfolio(simulation, marketData);

  for (const [date, delta] of Object.entries(marketData.TQQQ)) {
    if (date <= simulation.startingDate) continue;

    const portfolioSnapshot = computePortfolioSnapshot(simulation, date, delta);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      rebalance(portfolioSnapshot, simulation);
    }
  }
  setSimulation(simulation);
};

const computePortfolioSnapshot = (simulation: Simulation, date: string, delta: number) => {
  const lastInvestmentsSnapshot = simulation.portfolioSnapshots[simulation.currentSnapshotIndex];
  const newPortfolioSnapshot = { ...lastInvestmentsSnapshot };

  const newTQQQMoney = lastInvestmentsSnapshot.investments.TQQQMoney * (delta / 100 + 1);
  const newCash = lastInvestmentsSnapshot.investments.Cash * (1 + simulation.variables!.CashDayRate);
  const newTotal = newTQQQMoney + newCash;
  const investments: Investments = {
    Total: newTotal,
    TQQQMoney: newTQQQMoney,
    Cash: newCash,
    Ratio: newTQQQMoney / (newTQQQMoney + newCash),
  };

  newPortfolioSnapshot.date = date;
  newPortfolioSnapshot.investments = investments;
  newPortfolioSnapshot.peak = Math.max(lastInvestmentsSnapshot.peak, newTotal);
  newPortfolioSnapshot.pullback = 1;
  newPortfolioSnapshot.cumulativeRateSinceRebalance =
    (1 + newPortfolioSnapshot.cumulativeRateSinceRebalance) * (1 + delta / 100) - 1;
  simulation.portfolioSnapshots.push(newPortfolioSnapshot);
  simulation.currentSnapshotIndex += 1;

  return newPortfolioSnapshot;
};

const rebalance = (portfolioSnapshot: PortfolioSnapshot, simulation: Simulation) => {
  const variables = simulation.variables!;
  const investments = portfolioSnapshot.investments;
  console.log(
    "date",
    portfolioSnapshot.date,
    "$$$",
    portfolioSnapshot.investments.Total.toFixed(3),
    "TQQQMoney",
    portfolioSnapshot.investments.TQQQMoney.toFixed(3)
  );

  // Double DROP
  if (false) {
    return;
  }

  // DROP
  else if (portfolioSnapshot.cumulativeRateSinceRebalance < variables.DropRate) {
    console.log("Drop detected ", portfolioSnapshot.cumulativeRateSinceRebalance * 100);
  }

  // SPIKE
  else if (portfolioSnapshot.cumulativeRateSinceRebalance > variables.SpikeRate) {
    console.log("Spike detected, rebalancing...");
    investments.TQQQMoney = investments.Total * variables.TargetRatio;
    investments.Cash = investments.Total * (1 - variables.TargetRatio);
  }

  // Excess
  else if (investments.Total > portfolioSnapshot.nextTarget) {
    const excess = investments.Total - portfolioSnapshot.nextTarget;
    console.log("excess", excess);
    investments.TQQQMoney -= excess;
    investments.Cash += excess;
  }

  // Shortfall
  else if (investments.Total < portfolioSnapshot.nextTarget) {
    const shortfall = portfolioSnapshot.nextTarget - investments.Total;
    console.log("shortfall", shortfall);
    investments.TQQQMoney += shortfall;
    investments.Cash -= shortfall;
  }

  portfolioSnapshot.lastTarget = portfolioSnapshot.nextTarget;
  portfolioSnapshot.nextTarget = portfolioSnapshot.lastTarget * 1.09;
  portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
  portfolioSnapshot.cumulativeRateSinceRebalance = 1;

  console.log(
    "$$$",
    portfolioSnapshot.investments.Total.toFixed(3),
    "tqqq",
    portfolioSnapshot.investments.TQQQMoney.toFixed(3)
  );
};

const addDaysToDate = (date: string, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
