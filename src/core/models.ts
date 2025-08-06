export interface Simulation {
  portfolioSnapshots: PortfolioSnapshot[];
  rebalanceLogs: RebalanceLog[];
  variables: Variables;
  annualizedTQQQRate?: number;
  annualizedQQQRate?: number;
  annualizedStrategyRate?: number;
}

export interface Variables {
  initialMoney: number;
  startDate: string;
  endDate: string;
  rebalanceDays: number;
  targetRate: number;
  cashDayRate: number;
  targetRatio: number;
  dropRate: number;
  monthlyNewCash: number;
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
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
  cumulativeRateSinceLastRebalance: number;
  rebalanceType: RebalanceType;
}

export enum RebalanceType {
  OnTrack = "On Track",
  Drop = "Drop",
  BigDrop = "Big Drop",
}

export const RebalanceTypeExplanation = {
  "Big Spike": "Rebalance with 1.5x factor, usually big spikes comes together",
  Spike: "Rebalance with 1x factor, basically just restart",
  Excess: "Sell excess TQQQ to follow the target rate",
  Shortfall: "Buy more TQQQ to follow the target rate",
  Drop: "No action taken, maintain current allocation, we don't sell low",
  "Big Drop": "Rebalance with 0.5x factor, now market is very low, we have to buy something",
};

export interface Investments {
  total: number;
  mockTotalQQQ: number;
  mockTotalTQQQ: number;
  mockTotalNothing: number;
  TQQQ: number;
  cash: number;
  ratio: number;
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
