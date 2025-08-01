import { Investments, MarketData, PortfolioSnapshot, Simulation } from "./models";

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
  };
  simulation.portfolioSnapshots = [portfolioSnapshot];
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
      rebalance(portfolioSnapshot, simulation.variables!.rebalancePeriodMonths);
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

const rebalance = (portfolioSnapshot: PortfolioSnapshot, rebalancePeriodMonths: number) => {
  console.log("Rebalancing portfolio...", portfolioSnapshot);

  portfolioSnapshot.currentTarget = portfolioSnapshot.nextTarget;
  portfolioSnapshot.nextTarget = portfolioSnapshot.currentTarget * 1.09;

  if (portfolioSnapshot.investments.Total > portfolioSnapshot.currentTarget) {
    const excess = portfolioSnapshot.investments.Total - portfolioSnapshot.currentTarget;
    portfolioSnapshot.investments.TQQQMoney -= excess;
    portfolioSnapshot.investments.Cash += excess;
  } else {
    const shortfall = portfolioSnapshot.currentTarget - portfolioSnapshot.investments.Total;
    portfolioSnapshot.investments.TQQQMoney += shortfall;
    portfolioSnapshot.investments.Cash -= shortfall;
  }

  portfolioSnapshot.nextRebalanceDate = addMonthToDate(portfolioSnapshot.date, rebalancePeriodMonths);
};

const addMonthToDate = (date: string, months: number): string => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};
