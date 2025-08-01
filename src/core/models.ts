export interface Simulation {
  started: boolean;
  startingDate: Date;
  initialMoney: number;
  currentIterationNumber?: number;
  iterations?: Iteration[];
  variables?: Variables;
}

export interface Variables {}

export interface Iteration {
  date: Date;
  delta: number;
  portfolio: Portfolio;
  currentTarget: number;
  peak: number;
  pullback: number;
  comment: string;
  adjustments?: Adjustments;
}

export interface Portfolio {
  TQQQMoney: number;
  Cash: number;
}

export interface Adjustments {
  shouldSkip: boolean;
  shouldRestart: boolean;
  nextPortfolio: Portfolio;
}
