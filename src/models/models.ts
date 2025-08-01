export interface Simulation {
  started: boolean;
  startingDate: Date;
  initialMoney: number;
  iterations?: Iteration[];
  currentIterationNumber?: number;
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
  adjustments: Adjustments | null;
}

export interface Portfolio {
  TQQQMoney: number;
  SQQQMoney: number;
}

export interface Adjustments {
  shouldSkip: boolean;
  shouldRestart: boolean;
  nextPortfolio: Portfolio;
}
