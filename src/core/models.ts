export interface Simulation {
  started: boolean;
  startingDate: string;
  initialMoney: number;
  currentSnapshotIndex: number;
  portfolioSnapshots: PortfolioSnapshot[];
  variables: Variables;
}

export interface Variables {}

export interface PortfolioSnapshot {
  date: string;
  investments: Investments;
  currentTarget: number;
  peak: number;
  pullback: number;
  rebalance: Rebalance | null;
}
export interface Investments {
  Total: number;
  TQQQMoney: number;
  Cash: number;
  Ratio: number;
}

export interface Rebalance {
  shouldSkip: boolean;
  shouldRestart: boolean;
  nextTarget: number;
  newInvestments: Investments;
}

export interface MarketData {
  QQQ: Record<string, number>;
  TQQQ: Record<string, number>;
}
