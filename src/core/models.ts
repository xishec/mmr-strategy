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
  cashDayRate: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationFrequencyDays: number;
  simulationAnalysisMinusYears: number;
}

export interface DashboardVariables {
  startDate: Date;
  endDate: Date;
  initialMoney: number;
  rebalanceDays: number;
  cashYearRate: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationYears: number;
  isLogScale: boolean;
  simulationFrequencyDays: number;
  simulationAnalysisMinusYears: number;
}

export interface PortfolioSnapshot {
  date: string;
  investments: Investments;
  cumulativeRateSinceRebalance: number;
  peak: number;
  pullback: number;
  lastRebalanceDate: string;
  nextRebalanceDate: string;
  shouldPanic: boolean;
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
  Panic = "Panic",
}

export const RebalanceTypeExplanation = {
  "On Track":
    "Market is on track, +25% TQQQ ratio, to maximum 75%. We want to increase exposure to TQQQ, but we don't all-in just in case of a pullback.",
  Drop: "No action taken, maintain current allocation. There's a drop but we don't sell low, we hold and see.",
  "Big Drop":
    "Market is dropping big, -25% TQQQ ratio, to minimum 25%. We want to decrease exposure to TQQQ, but still keep some in case of a bounce back.",
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
export interface D3ChartData {
  priceChart: MultiSeriesChartData;
  ratioChart: MultiSeriesChartData;
  pullbackChart: MultiSeriesChartData;
  rebalanceLogsMap: Record<string, RebalanceLog>;
}

export interface AnalysisResults {
  totalSimulations: number;
  averageStrategyRate: number;
  averageQQQRate: number;
  averageTQQQRate: number;
  strategyStandardDeviation: number;
  qqqStandardDeviation: number;
  tqqqStandardDeviation: number;
  absoluteWorstStrategyRate: number;
  relativeWorstStrategyRate: number;
  absoluteWorstStrategyRateDate: string;
  relativeWorstStrategyRateDate: string;
  winRateVsQQQ: number;
  strategyVsQQQImprovement: number;
  resultsWithRates: Array<{
    startDate: string;
    strategyRate: number;
    qqqRate: number;
    tqqqRate: number;
  }>;
}
