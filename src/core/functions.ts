import { Iteration, MarketData, Simulation } from "./models";

export const initializeSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void
) => {
  if (simulation && simulation.started && !simulation.iterations) {
    const initialIteration: Iteration = {
      date: simulation.startingDate,
      delta: 0,
      portfolio: {
        TQQQMoney: simulation.initialMoney * 0.6,
        Cash: simulation.initialMoney * 0.4,
      },
      currentTarget: simulation.initialMoney * 1.09,
      peak: simulation.initialMoney,
      pullback: 1,
      comment: "",
    };
    computeNextIteration(initialIteration);
    setSimulation({
      ...simulation,
      iterations: [initialIteration],
      currentIterationNumber: 0,
    });
  }
};

export const computeNextIteration = (iteration: Iteration) => {
  iteration.adjustments = {
    shouldSkip: false,
    shouldRestart: false,
    nextPortfolio: {
      TQQQMoney: iteration.portfolio.TQQQMoney,
      Cash: iteration.portfolio.Cash,
    },
  };
};

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
