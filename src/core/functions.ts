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

const setupInitialPortfolio = (simulation: Simulation) => {
  const investments: Investments = {
    Total: simulation.initialMoney,
    TQQQMoney: simulation.initialMoney * 0.6,
    Cash: simulation.initialMoney * 0.4,
    Ratio: 0.6,
  };
  const startingDate = simulation.startingDate;
  const portfolioSnapshot: PortfolioSnapshot = {
    date: simulation.startingDate,
    investments: investments,
    currentTarget: simulation.initialMoney,
    nextTarget: simulation.initialMoney * 1.09,
    peak: simulation.initialMoney,
    pullback: 1,
    nextRebalanceDate: addMonthToDate(simulation.startingDate, 3),
  };
  simulation.currentSnapshotIndex = 0;
  simulation.variables = {
    rebalancePeriodMonths: 3,
    TQQQTargetRate: 0.09,
    CASHTargetRate: (0.04 / 12) * 3,
    TargetRatio: 0.6,
    SpikeRate: 0.18,
    DropRate: -0.09,
  };
  simulation.portfolioSnapshots = [portfolioSnapshot];

  console.log(
    "$$$",
    portfolioSnapshot.investments.Total.toFixed(1),
    "date",
    portfolioSnapshot.date,
    "currentTarget",
    portfolioSnapshot.currentTarget.toFixed(1),
    "nextTarget",
    portfolioSnapshot.nextTarget.toFixed(1),
    "Ratio",
    portfolioSnapshot.investments.Ratio.toFixed(1)
  );
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  setupInitialPortfolio(simulation);

  for (const [date, delta] of Object.entries(marketData.TQQQ)) {
    if (date < simulation.startingDate) continue;

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

  const newTQQQMoney = lastInvestmentsSnapshot.investments.TQQQMoney * (1 + delta / 100);
  const newCash = lastInvestmentsSnapshot.investments.Cash;
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
  simulation.portfolioSnapshots.push(newPortfolioSnapshot);
  simulation.currentSnapshotIndex += 1;

  return newPortfolioSnapshot;
};

const rebalance = (portfolioSnapshot: PortfolioSnapshot, simulation: Simulation) => {
  const variables = simulation.variables!;
  const investments = portfolioSnapshot.investments;
  console.log(
    "$$$",
    portfolioSnapshot.investments.Total.toFixed(1),
    "date",
    portfolioSnapshot.date,
    "currentTarget",
    portfolioSnapshot.currentTarget.toFixed(1),
    "nextTarget",
    portfolioSnapshot.nextTarget.toFixed(1),
    "Ratio",
    portfolioSnapshot.investments.Ratio.toFixed(1)
  );

  portfolioSnapshot.currentTarget = portfolioSnapshot.nextTarget;
  portfolioSnapshot.nextTarget = portfolioSnapshot.currentTarget * 1.09;
  portfolioSnapshot.nextRebalanceDate = addMonthToDate(portfolioSnapshot.date, variables.rebalancePeriodMonths);

  // Double DROP
  if (false) {
    return;
  }

  // DROP
  if (investments.Total < portfolioSnapshot.currentTarget * (1 + variables.DropRate)) {
    console.log("Drop detected, rebalancing...", investments);
    return;
  }

  // SPIKE
  if (investments.Total > portfolioSnapshot.currentTarget * (1 + variables.SpikeRate)) {
    console.log("Spike detected, rebalancing...");
    investments.TQQQMoney = investments.Total * variables.TargetRatio;
    investments.Cash = investments.Total * (1 - variables.TargetRatio);
    return;
  }

  if (investments.Total > portfolioSnapshot.currentTarget) {
    const excess = investments.Total - portfolioSnapshot.currentTarget;
    investments.TQQQMoney -= excess;
    investments.Cash += excess;
  } else {
    const shortfall = portfolioSnapshot.currentTarget - investments.Total;
    investments.TQQQMoney += shortfall;
    investments.Cash -= shortfall;
  }
};

const addMonthToDate = (date: string, months: number): string => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};
