import {
  Investments,
  MarketData,
  PortfolioSnapshot,
  RebalanceLog,
  RebalanceType,
  Simulation,
  Variables,
} from "./models";

export const loadData = async (
  setDataLoading: (loading: boolean) => void,
  setMarketData: (data: MarketData | null) => void
) => {
  try {
    setDataLoading(true);
    setMarketData({
      QQQ: (await import("../data/QQQ.json")).default,
      TQQQ: (await import("../data/TQQQ.json")).default,
    });
  } catch (error) {
    console.error("Error loading data:", error);
  } finally {
    setDataLoading(false);
  }
};

const setupInitialPortfolio = (simulation: Simulation, marketData: MarketData) => {
  const investments: Investments = {
    total: simulation.variables.initialMoney,
    TQQQ: simulation.variables.initialMoney * simulation.variables.targetRatio,
    cash: simulation.variables.initialMoney * (1 - simulation.variables.targetRatio),
    ratio: simulation.variables.targetRatio,
    mockTotalQQQ: simulation.variables.initialMoney,
    mockTotalTQQQ: simulation.variables.initialMoney,
  };

  const firstValidDate = Object.keys(marketData.TQQQ).find((date) => date >= simulation.variables.startDate);

  if (!firstValidDate) {
    throw new Error(`No market data found for start date ${simulation.variables.startDate} or later`);
  }

  simulation.variables.startDate = firstValidDate;

  const portfolioSnapshot: PortfolioSnapshot = {
    date: firstValidDate,
    investments: investments,
    cumulativeRateSinceRebalance: 0,
    nextTarget: simulation.variables.initialMoney * (1 + simulation.variables.targetRate),
    peak: simulation.variables.initialMoney,
    pullback: 0,
    lastRebalanceDate: firstValidDate,
    nextRebalanceDate: addDaysToDate(firstValidDate, simulation.variables.rebalanceDays),
  };

  simulation.portfolioSnapshots = [portfolioSnapshot];

  const rebalanceLog: RebalanceLog = {
    date: firstValidDate,
    before: portfolioSnapshot,
    after: portfolioSnapshot,
    cumulativeRateSinceLastRebalance: 0,
    rebalanceType: RebalanceType.Excess,
    reason: "Initial setup",
  };
  simulation.rebalanceLogs = [rebalanceLog];
};

export const startSimulation = (
  simulation: Simulation,
  setSimulation: (simulation: Simulation) => void,
  marketData: MarketData
) => {
  const result = runSingleSimulation(simulation, marketData);
  setSimulation(result);
};

/**
 * Runs a single simulation with the given parameters
 * @param simulation - The simulation configuration
 * @param marketData - The market data
 * @param endDate - Optional end date to limit the simulation (format: YYYY-MM-DD)
 * @returns The completed simulation
 */
const runSingleSimulation = (simulation: Simulation, marketData: MarketData): Simulation => {
  // Create a deep copy of the simulation to avoid mutations
  const newSimulation: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
  };

  setupInitialPortfolio(newSimulation, marketData);

  for (const [date] of Object.entries(marketData.TQQQ)) {
    if (date <= newSimulation.variables.startDate) continue;
    if (date > newSimulation.variables.endDate) break;

    const portfolioSnapshot = computePortfolioSnapshot(newSimulation, date, marketData);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      rebalance(portfolioSnapshot, newSimulation, marketData);
    }
  }

  // Final rebalance and calculate rates
  if (newSimulation.portfolioSnapshots.length > 0) {
    const lastSnapshot = newSimulation.portfolioSnapshots[newSimulation.portfolioSnapshots.length - 1];
    rebalance(lastSnapshot, newSimulation, marketData);
    calculateAnnualizedRates(newSimulation);
  }

  return newSimulation;
};

const calculateAnnualizedRates = (simulation: Simulation) => {
  const endDate = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].date;

  simulation.annualizedStrategyRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.total,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedQQQRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalQQQ,
    simulation.variables.startDate,
    endDate
  );
  simulation.annualizedTQQQRate = calculateAnnualizedRate(
    simulation.variables.initialMoney,
    simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].investments.mockTotalTQQQ,
    simulation.variables.startDate,
    endDate
  );
};

const computePortfolioSnapshot = (simulation: Simulation, date: string, marketData: MarketData) => {
  const lastInvestmentsSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newPortfolioSnapshot = { ...lastInvestmentsSnapshot };

  const TQQQDelta = marketData.TQQQ[date] || 0;
  const QQQDelta = marketData.QQQ[date] || 0;

  const newTQQQ = lastInvestmentsSnapshot.investments.TQQQ * (TQQQDelta / 100 + 1);
  const newCash = lastInvestmentsSnapshot.investments.cash * (1 + simulation.variables!.cashDayRate);
  const newTotal = newTQQQ + newCash;
  const investments: Investments = {
    total: newTotal,
    TQQQ: newTQQQ,
    cash: newCash,
    ratio: newTQQQ / (newTQQQ + newCash),
    mockTotalQQQ: lastInvestmentsSnapshot.investments.mockTotalQQQ * (QQQDelta / 100 + 1),
    mockTotalTQQQ: lastInvestmentsSnapshot.investments.mockTotalTQQQ * (TQQQDelta / 100 + 1),
  };

  newPortfolioSnapshot.date = date;
  newPortfolioSnapshot.investments = investments;
  newPortfolioSnapshot.peak = Math.max(lastInvestmentsSnapshot.peak, newTotal);
  newPortfolioSnapshot.pullback = -(newPortfolioSnapshot.peak - newTotal) / newPortfolioSnapshot.peak;
  newPortfolioSnapshot.cumulativeRateSinceRebalance =
    (1 + newPortfolioSnapshot.cumulativeRateSinceRebalance) * (1 + TQQQDelta / 100) - 1;
  simulation.portfolioSnapshots.push(newPortfolioSnapshot);

  return newPortfolioSnapshot;
};

const rebalance = (portfolioSnapshot: PortfolioSnapshot, simulation: Simulation, marketData: MarketData) => {
  const before = { ...portfolioSnapshot };
  const after = portfolioSnapshot;

  const variables = simulation.variables!;
  const targetRatio = variables.targetRatio;
  const targetRate = variables.targetRate;
  const doubleTargetRate = targetRate * 2;
  const dropRate = variables.dropRate;
  const doubleDropRate = dropRate * 2;
  const cumulativeRate = before.cumulativeRateSinceRebalance;

  let rebalanceType: RebalanceType = RebalanceType.Excess;

  const isBigSpike = cumulativeRate >= doubleTargetRate;
  const isSpike = cumulativeRate < doubleTargetRate && cumulativeRate >= targetRate;
  const isExcess = cumulativeRate < targetRate && before.investments.total >= before.nextTarget;
  const isShortfall = before.investments.total < before.nextTarget && cumulativeRate >= dropRate;
  const isDrop = cumulativeRate < dropRate && cumulativeRate >= doubleDropRate;
  const isBigDrop = cumulativeRate < doubleDropRate;

  let reason = `Rebalance on ${before.date}: `;

  if (isBigSpike) {
    rebalanceType = RebalanceType.BigSpike;
    // 1.5 -> 44 35 89
    after.investments.TQQQ = before.investments.total * (targetRatio * 2);
    after.investments.cash = before.investments.total * (1 - targetRatio * 2);
    after.investments.total = before.investments.total;
    after.nextTarget = before.investments.total * (1 + targetRate * 2);
    reason += `Spike (${cumulativeRate.toFixed(3)} > ${targetRate.toFixed(3)})`;
  } else if (isSpike) {
    rebalanceType = RebalanceType.Spike;
    after.investments.TQQQ = before.investments.total * targetRatio * 1;
    after.investments.cash = before.investments.total * (1 - targetRatio * 1);
    after.investments.total = before.investments.total;
    after.nextTarget = before.investments.total * (1 + targetRate * 1);
    reason += `Spike (${cumulativeRate.toFixed(3)} > ${targetRate.toFixed(3)})`;
  } else if (isExcess) {
    rebalanceType = RebalanceType.Excess;
    const excess = before.investments.total - before.nextTarget;
    const actualExcess = Math.min(excess, before.investments.TQQQ);
    after.investments.TQQQ = before.investments.TQQQ - actualExcess;
    after.investments.cash = before.investments.cash + actualExcess;
    after.investments.total = before.investments.total;
    after.nextTarget = before.nextTarget * (1 + targetRate);
    reason += `Excess (${cumulativeRate.toFixed(3)} >= ${variables.targetRate.toFixed(3)})`;
  } else if (isShortfall) {
    rebalanceType = RebalanceType.Shortfall;
    const shortfall = before.nextTarget - before.investments.total;
    const actualShortfall = Math.min(shortfall, before.investments.cash);
    after.investments.TQQQ = before.investments.TQQQ + actualShortfall;
    after.investments.cash = before.investments.cash - actualShortfall;
    after.investments.total = before.investments.total;
    after.nextTarget = before.nextTarget * (1 + targetRate);
    reason += `Shortfall (${cumulativeRate.toFixed(3)} < ${variables.targetRate.toFixed(3)})`;
  } else if (isDrop) {
    rebalanceType = RebalanceType.Drop;
    reason += `Drop ${cumulativeRate.toFixed(3)} < ${variables.dropRate.toFixed(3)}`;
  } else if (isBigDrop) {
    rebalanceType = RebalanceType.BigDrop;
    after.investments.TQQQ = before.investments.total * targetRatio * 1;
    after.investments.cash = before.investments.total * (1 - targetRatio * 1);
    after.investments.total = before.investments.total;
    after.nextTarget = before.investments.total * (1 + targetRate * 1);
    reason += `Big Drop ${cumulativeRate.toFixed(3)} < ${variables.dropRate.toFixed(3)}`;
  } else {
    console.log("bug");
  }

  after.investments.cash += (variables.monthlyNewCash / 30) * variables.rebalanceDays;
  after.investments.mockTotalQQQ += (variables.monthlyNewCash / 30) * variables.rebalanceDays;
  after.investments.mockTotalTQQQ += (variables.monthlyNewCash / 30) * variables.rebalanceDays;

  after.nextRebalanceDate = addDaysToDate(before.date, variables.rebalanceDays);
  after.cumulativeRateSinceRebalance = 0;
  portfolioSnapshot = after;

  const rebalanceLog: RebalanceLog = {
    date: before.date,
    before: before,
    after: after,
    cumulativeRateSinceLastRebalance: cumulativeRate,
    rebalanceType: rebalanceType,
    reason: reason,
  };
  simulation.rebalanceLogs.push(rebalanceLog);
};

const addDaysToDate = (date: string, days: number): string => {
  if (!date || typeof date !== "string") {
    throw new Error(`Invalid date provided to addDaysToDate: ${date}`);
  }

  const dateParts = date.split("-");
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${date}`);
  }

  const [year, month, day] = dateParts.map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date components. Expected numbers, got: ${date}`);
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().split("T")[0];
};

export const calculateAnnualizedRate = (
  initial: number,
  end: number,
  initialDateString: string,
  endDateString: string
): number => {
  // Parse dates as UTC to avoid timezone issues
  const [startYear, startMonth, startDay] = initialDateString.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateString.split("-").map(Number);

  const initialDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  const nbYears = (endDate.getTime() - initialDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  // Ensure we have at least some time period to avoid division by zero
  if (nbYears <= 0) {
    return 0;
  }

  return (end / initial) ** (1 / nbYears) - 1;
};

export const convertAnnualRateToDaily = (annualRate: number): number => {
  return Math.pow(1 + annualRate, 1 / 365) - 1;
};

/**
 * Runs multiple simulations starting every 10 days from 2000-01-01 to today
 * @param variables - The simulation variables (including initialMoney and all required fields)
 * @param marketData - The market data containing QQQ and TQQQ prices
 * @param nbYear - Number of years to run each simulation (default: 5)
 * @returns Array of simulation results with their starting dates
 */
export const runMultipleSimulations = (
  variables: Variables,
  marketData: MarketData,
  nbYear = 5
): Array<{ startDate: string; simulation: Simulation }> => {
  const results: Array<{ startDate: string; simulation: Simulation }> = [];

  // Start from 2000-01-01 using UTC to avoid timezone issues
  const startDate = new Date(Date.UTC(2000, 0, 1));
  // End at today's date using UTC to avoid timezone issues
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0); // Set to start of day in UTC

  // Get all available dates from market data (sorted)
  const availableDates = Object.keys(marketData.TQQQ).sort();
  const firstAvailableDate = availableDates[0];
  const lastAvailableDate = availableDates[availableDates.length - 1];

  // console.log(
  //   `Running simulations from ${firstAvailableDate} to ${lastAvailableDate} (${nbYear} years per simulation)`
  // );

  // Parse available dates as UTC to avoid timezone issues
  const [firstYear, firstMonth, firstDay] = firstAvailableDate.split("-").map(Number);
  const [lastYear, lastMonth, lastDay] = lastAvailableDate.split("-").map(Number);

  const firstAvailableUTC = new Date(Date.UTC(firstYear, firstMonth - 1, firstDay));
  const lastAvailableUTC = new Date(Date.UTC(lastYear, lastMonth - 1, lastDay));

  let currentDate = new Date(Math.max(startDate.getTime(), firstAvailableUTC.getTime()));
  const finalDate = new Date(Math.min(endDate.getTime(), lastAvailableUTC.getTime()));

  let simulationCount = 0;

  while (currentDate <= finalDate) {
    const dateString = currentDate.toISOString().split("T")[0];

    // Check if this date exists in market data or find next available date
    const nextAvailableDate = availableDates.find((date) => date >= dateString);

    if (nextAvailableDate) {
      try {
        // Parse start date as UTC to avoid timezone issues
        const [startYear, startMonth, startDay] = nextAvailableDate.split("-").map(Number);
        const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const minEndDate = new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

        // Parse last available date as UTC for comparison
        const [lastYear, lastMonth, lastDay] = lastAvailableDate.split("-").map(Number);
        const lastAvailableUTC = new Date(Date.UTC(lastYear, lastMonth - 1, lastDay));
        const hasEnoughData = lastAvailableUTC > minEndDate;

        if (hasEnoughData) {
          // Calculate end date for this simulation (start date + nbYear years)
          const simulationEndDate = new Date(startDateObj.getTime());
          simulationEndDate.setUTCFullYear(simulationEndDate.getUTCFullYear() + nbYear);
          const simulationEndDateString = simulationEndDate.toISOString().split("T")[0];

          // Create simulation configuration
          const simulation: Simulation = {
            portfolioSnapshots: [],
            rebalanceLogs: [],
            variables: {
              ...variables,
              startDate: nextAvailableDate,
              endDate: simulationEndDateString,
            },
          };

          // Run the simulation using the shared simulation logic
          const completedSimulation = runSingleSimulation(simulation, marketData);

          if (completedSimulation.portfolioSnapshots.length > 0) {
            results.push({
              startDate: nextAvailableDate,
              simulation: completedSimulation,
            });

            // simulationCount++;
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    // Move to next date (10 days later)
    currentDate.setDate(currentDate.getDate() + 10);
  }

  console.log(
    `Completed ${simulationCount} simulations from ${results[0]?.startDate} to ${
      results[results.length - 1]?.startDate
    }`
  );

  analyzeSimulationResults(results);

  return results;
};

/**
 * Analyzes multiple simulation results to get statistics
 * @param results - Array of simulation results from runMultipleSimulations
 * @returns Statistics about the simulation results
 */
export const analyzeSimulationResults = (results: Array<{ startDate: string; simulation: Simulation }>) => {
  if (results.length === 0) {
    return {
      totalSimulations: 0,
      averageStrategyRate: 0,
      averageQQQRate: 0,
      averageTQQQRate: 0,
      bestStrategyRate: 0,
      worstStrategyRate: 0,
      winRate: 0,
    };
  }

  const strategyRates = results.map((r) => r.simulation.annualizedStrategyRate || 0);
  const qqqRates = results.map((r) => r.simulation.annualizedQQQRate || 0);
  const tqqqRates = results.map((r) => r.simulation.annualizedTQQQRate || 0);

  const averageStrategyRate = strategyRates.reduce((sum, rate) => sum + rate, 0) / strategyRates.length;
  const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;
  const averageTQQQRate = tqqqRates.reduce((sum, rate) => sum + rate, 0) / tqqqRates.length;

  const bestStrategyRate = Math.max(...strategyRates);
  const worstStrategyRate = Math.min(...strategyRates);

  // Calculate how much better strategy is than QQQ
  const strategyVsQQQPercentageImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;
  // Count how many times strategy beats QQQ
  const strategyWinsOverQQQ = results.filter(
    (r) => (r.simulation.annualizedStrategyRate || 0) > (r.simulation.annualizedQQQRate || 0)
  ).length;
  const winRateVsQQQ = (strategyWinsOverQQQ / results.length) * 100;

  // Calculate how much better strategy is than QQQ
  const TQQQVsQQQPercentageImprovement = (averageTQQQRate / averageQQQRate - 1) * 100;
  // Count how many times strategy beats QQQ
  const TQQQWinsOverQQQ = results.filter(
    (r) => (r.simulation.annualizedTQQQRate || 0) > (r.simulation.annualizedQQQRate || 0)
  ).length;
  const winRateTQQQVsQQQ = (TQQQWinsOverQQQ / results.length) * 100;

  const resultsWithRates = results.map((r) => ({
    startDate: r.startDate,
    strategyRate: r.simulation.annualizedStrategyRate || 0,
    qqqRate: r.simulation.annualizedQQQRate || 0,
    tqqqRate: r.simulation.annualizedTQQQRate || 0,
  }));

  console.log("Absolute worst 10");
  resultsWithRates
    .sort((a, b) => a.strategyRate - b.strategyRate)
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });

  console.log("Relative worst 10");
  resultsWithRates
    .sort((a, b) => a.strategyRate - a.qqqRate - (b.strategyRate - b.qqqRate))
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });

  console.log("Absolute worst 10 TQQQ");
  resultsWithRates
    .sort((a, b) => a.tqqqRate - b.tqqqRate)
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });
  console.log("Relative worst 10 TQQQ");
  resultsWithRates
    .sort((a, b) => a.tqqqRate - a.qqqRate - (b.tqqqRate - b.qqqRate))
    .slice(0, 10)
    .forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.startDate}: Strategy= ${(result.strategyRate * 100)?.toFixed(2)}%, QQQ= ${(
          result.qqqRate * 100
        )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
      );
    });

  console.log(
    "\naverageStrategyRate\t\t\t\t",
    `${(averageStrategyRate * 100).toFixed(3)}%`,
    "\nstrategyVsQQQImprovement\t\t\t\t",
    `${strategyVsQQQPercentageImprovement.toFixed(2)}%`,
    "\nwinRateVsQQQ\t\t\t\t",
    `${winRateVsQQQ.toFixed(1)}%`,
    "\nTQQQVsQQQImprovement\t\t\t\t",
    `${TQQQVsQQQPercentageImprovement.toFixed(2)}%`,
    "\nwinRateTQQQVsQQQ\t\t\t\t",
    `${winRateTQQQVsQQQ.toFixed(1)}%`
  );

  return {
    totalSimulations: results.length,
    averageStrategyRate,
    averageQQQRate,
    averageTQQQRate,
    bestStrategyRate,
    worstStrategyRate,
    dateRange: {
      start: results[0]?.startDate,
      end: results[results.length - 1]?.startDate,
    },
  };
};
