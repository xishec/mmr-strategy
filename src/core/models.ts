export interface Simulation {
  started: boolean;
  startingDate: string;
  initialMoney: number;
  currentSnapshotIndex: number;
  portfolioSnapshots: PortfolioSnapshot[];
  variables: Variables | null;
}

export interface Variables {
  rebalanceDays: number;
  TQQQTargetRate: number;
  CashDayRate: number;
  TargetRatio: number;
  SpikeRate: number;
  DropRate: number;
}

export interface PortfolioSnapshot {
  date: string;
  investments: Investments;
  cumulativeRateSinceRebalance: number;
  lastTarget: number;
  nextTarget: number;
  peak: number;
  pullback: number;
  nextRebalanceDate: string;
  // rebalance: Rebalance | null;
}
export interface Investments {
  Total: number;
  TQQQMoney: number;
  Cash: number;
  Ratio: number;
}

// export interface Rebalance {
//   shouldSkip: boolean;
//   shouldRestart: boolean;
// }

export interface MarketData {
  QQQ: Record<string, number>;
  TQQQ: Record<string, number>;
}
