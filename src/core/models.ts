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
  spikeRate: number;
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
  total: number;
  currentTarget: number;
  nextTarget: number;
  cumulativeRateSinceLastRebalance: number;
  rebalanceType: RebalanceType;
  reason: string;
}

export enum RebalanceType {
  BigSpike = "Big Spike",
  Spike = "Spike",
  Excess = "Excess",
  Shortfall = "Shortfall",
  Drop = "Drop",
  BigDrop = "Big Drop",
}

export interface Investments {
  total: number;
  mockTotalQQQ: number;
  mockTotalTQQQ: number;
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
