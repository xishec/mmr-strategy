export interface Simulation {
  started: boolean;
  startingDate: string;
  initialMoney: number;
  portfolioSnapshots: PortfolioSnapshot[];
  rebalanceLogs: RebalanceLog[];
  variables: Variables;
}

export interface Variables {
  rebalanceDays: number;
  targetRate: number;
  CashDayRate: number;
  TargetRatio: number;
  SpikeRate: number;
  DropRate: number;
  DoubleDropRate: number;
}

export interface PortfolioSnapshot {
  date: string;
  investments: Investments;
  cumulativeRateSinceRebalance: number;
  nextTarget: number;
  peak: number;
  pullback: number;
  lastRebalanceDate: string;
  nextRebalanceDate: string;
}

export interface RebalanceLog {
  date: string;
  cumulativeRateSinceLastRebalance: number;
}
export interface Investments {
  Total: number;
  MockTotalQQQ: number;
  MockTotalTQQQ: number;
  TQQQ: number;
  Cash: number;
  Ratio: number;
}

export interface MarketData {
  QQQ: Record<string, number>;
  TQQQ: Record<string, number>;
}

export interface ChartPoint {
  time: string;
  value: number;
}

export type ChartData = ChartPoint[];

export type MultiSeriesChartData = Record<string, ChartData>;
