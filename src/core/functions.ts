import { Iteration, Simulation } from "./models";

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
