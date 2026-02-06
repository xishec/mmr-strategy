export interface Simulation {
  portfolioSnapshots: PortfolioSnapshot[];
  simulationVariables: SimulationVariables;
  simulationResults?: SimulationResults;
  report: Report;
}

export interface Report {
  orders: Order[];
  tradeStatistics?: TradeStatistics;
}

export interface TradeStatistics {
  totalTrades: number;
  tradesPerYear: {
    average: number;
    min: number;
    max: number;
  };
}

export interface Order {
  date: string;
  type: SignalType;
  currentTotal: number;
}

export interface SimulationVariables {
  initialMoney: number;
  startDate: string;
  endDate: string;
  cashYearRate: number;
  SMAUpMargin: number;
  SMADownMargin: number;
  monthlyNewCash: number;
  buyAtOpen: boolean;
}

export interface SimulationResults {
  annualizedTQQQRate: number;
  annualizedQQQRate: number;
  annualizedStrategyRate: number;
}

export interface MultiSimulation {
  simulations: Simulation[];
  multiSimulationVariables: MultiSimulationVariables;
  multiSimulationResults?: MultiSimulationResults;
}

export interface MultiSimulationVariables {
  simulationFrequencyDays: number;
  simulationDurationYears: number;
  simulationAnalysisMinusYears: number;
}

export interface DashboardVariables {
  simulationVariables: SimulationVariables;
  multiSimulationVariables: MultiSimulationVariables;
  uiVariables: UIVariables;
}

export interface UIVariables {
  isLogScale: boolean;
  showSignalMarkers: boolean;
}

export interface MultiSimulationResults {
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

export interface PortfolioSnapshot {
  date: string;
  investments: Investments;
  peak: number;
  pullback: number;
  signal: Signal;
}

export interface Signal {
  date: string;
  hasXMarker: boolean;
  hasYellowMarker: boolean;
  hasOrangeMarker: boolean;
  hasRedMarker: boolean;
  hasBlueMarker: boolean;
  hasGreenTriangle: boolean;
  hasBlackTriangle: boolean;
  belowSMA: boolean;
  signalType: SignalType;
  isAboveSMAForAWhile?: boolean;
  growTooFast?: boolean;
}

export const enum SignalType {
  Buy = "Buy",
  Hold = "Hold",
  Sell = "Sell",
  WaitingForSmallDrop = "Waiting for small drop",
  WaitingForDrop = "Waiting for drop",
  WaitingForRecovery = "Waiting for recovery",
  Pause = "Pause",
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
  sma: number | null;
  maxClose: number | null;
  overnight_rate: number;
  day_rate: number;
}

export interface FearGreedEntry {
  value: number;
}

export interface MarketData {
  QQQ: Record<string, DailyData>;
  TQQQ: Record<string, DailyData>;
  fearGreed: Record<string, FearGreedEntry>;
}

export interface ChartPoint {
  time: string;
  value: number;
  hasXMarker?: boolean;
  hasGreenTriangle?: boolean;
  hasBlackTriangle?: boolean;
}

export type ChartData = ChartPoint[];

export type MultiSeriesChartData = Record<string, ChartData>;
export interface D3ChartData {
  priceChart: MultiSeriesChartData;
  ratioChart: MultiSeriesChartData;
  pullbackChart: MultiSeriesChartData;
}
