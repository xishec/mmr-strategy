// Portfolio allocation constants
export const PORTFOLIO_LIMITS = {
  MAX_RATIO: 0.75,
  MIN_RATIO: 0.25,
  STEP_RATIO: 0.25,
} as const;

// Time constants
export const TIME_CONSTANTS = {
  DAYS_IN_MONTH: 30,
  DAYS_IN_YEAR: 365,
  GROWTH_TARGET_MULTIPLIER: 1.2, // 20% growth target
  SIMULATION_FREQUENCY_DAYS: 3,
  MIN_DATA_DAYS: 30,
} as const;

// Chart layout constants
export const CHART_LAYOUT = {
  PRICE_HEIGHT_RATIO: 0.75,
  RATIO_HEIGHT_RATIO: 0.25,
  SPACE_BETWEEN_CHARTS: 20,
} as const;
