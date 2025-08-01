import {
  Investments,
  MarketData,
  PortfolioSnapshot,
  Simulation,
} from "./models";

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
    target: simulation.initialMoney * 1.09,
    peak: simulation.initialMoney,
    pullback: 1,
    rebalance: null,
  };
  simulation.currentSnapshotIndex = 0;
  simulation.variables = {};
  simulation.portfolioSnapshots = [portfolioSnapshot];
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  if (!simulation.started || simulation.portfolioSnapshots.length > 0) return;

  setupInitialPortfolio(simulation);
  console.log(simulation);

  for (const [date, delta] of Object.entries(marketData.TQQQ)) {
    if (date < simulation.startingDate) continue;

    const lastInvestmentsSnapshot =
      simulation.portfolioSnapshots[simulation.currentSnapshotIndex];

    const newTQQQMoney =
      lastInvestmentsSnapshot.investments.TQQQMoney * (1 + delta / 100);
    const newCash = lastInvestmentsSnapshot.investments.Cash;
    const newTotal = newTQQQMoney + newCash;

    const investments: Investments = {
      Total: newTotal,
      TQQQMoney: newTQQQMoney,
      Cash: newCash,
      Ratio: newTQQQMoney / (newTQQQMoney + newCash),
    };
    const portfolioSnapshot: PortfolioSnapshot = {
      date: date,
      investments: investments,
      target: lastInvestmentsSnapshot.target * 1.09,
      peak: Math.max(lastInvestmentsSnapshot.peak, newTotal),
      pullback: 1,
      rebalance: null,
    };
    simulation.portfolioSnapshots.push(portfolioSnapshot);
    simulation.currentSnapshotIndex += 1;
  }

  setSimulation(simulation);
};

// export const rebalance = (iteration: Iteration) => {
//   iteration.adjustments = {
//     shouldSkip: false,
//     shouldRestart: false,
//     nextPortfolio: {
//       TQQQMoney: iteration.portfolio.TQQQMoney,
//       Cash: iteration.portfolio.Cash,
//     },
//   };
// };
