export interface Simulation {
  portfolioSnapshots: PortfolioSnapshot[];
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
  peak: number;
  pullback: number;
  signal: Signal;
}

export interface Signal {
  date: string;
  bigDropLast30Days: boolean;
  isAboveSMA200: boolean;
  isBelowSMA200: boolean;
}

export interface Investments {
  total: number;
  mockTotalQQQ: number;
  mockTotalTQQQ: number;
  mockTotalNothing: number;
  TQQQ: number;
  cash: number;
  ratio: number;
}

export interface DailyData {
  rate: number;
  close: number;
  sma200: number | null;
}

export interface MarketData {
  QQQ: Record<string, DailyData>;
  TQQQ: Record<string, DailyData>;
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
