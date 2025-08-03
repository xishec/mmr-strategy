import {
  Investments,
  MarketData,
  PortfolioSnapshot,
  RebalanceLog,
  RebalanceType,
  Simulation,
  Variables,
} from "./models";

const DEBUG = false;

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
    TQQQ: simulation.variables.initialMoney * 0.6,
    cash: simulation.variables.initialMoney * 0.4,
    ratio: 0.6,
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
    total: investments.total,
    nextTarget: portfolioSnapshot.nextTarget,
    cumulativeRateSinceLastRebalance: 0,
    rebalanceType: RebalanceType.Excess,
    reason: "Initial setup",
  };
  simulation.rebalanceLogs = [rebalanceLog];

  if (DEBUG)
    console.log(
      "date",
      portfolioSnapshot.date,
      "$$$",
      portfolioSnapshot.investments.total?.toFixed(3),
      "target",
      portfolioSnapshot.nextTarget?.toFixed(3),
      "TQQQ",
      portfolioSnapshot.investments.TQQQ?.toFixed(3),
      "Rate",
      (portfolioSnapshot.cumulativeRateSinceRebalance * 100)?.toFixed(3)
    );
  if (DEBUG) console.log("\n");
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
  const simulationCopy: Simulation = {
    ...simulation,
    portfolioSnapshots: [],
    rebalanceLogs: [],
  };

  setupInitialPortfolio(simulationCopy, marketData);

  for (const [date, TQQQDelta] of Object.entries(marketData.TQQQ)) {
    const QQQDelta = marketData.QQQ[date];
    if (date <= simulationCopy.variables.startDate) continue;

    // Stop simulation if we've reached the specified end date
    if (date > simulationCopy.variables.endDate) break;

    const portfolioSnapshot = computePortfolioSnapshot(simulationCopy, date, TQQQDelta, QQQDelta);

    if (date >= portfolioSnapshot.nextRebalanceDate) {
      rebalance(portfolioSnapshot, simulationCopy);
    }
  }

  // Final rebalance and calculate rates
  if (simulationCopy.portfolioSnapshots.length > 0) {
    rebalance(simulationCopy.portfolioSnapshots[simulationCopy.portfolioSnapshots.length - 1], simulationCopy);
    calculateAnnualizedRates(simulationCopy);
  }

  return simulationCopy;
};

const calculateAnnualizedRates = (simulation: Simulation) => {
  const endDate = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1].date;

  simulation.annualizedSig9lRate = calculateAnnualizedRate(
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

const computePortfolioSnapshot = (simulation: Simulation, date: string, TQQQDelta: number, QQQDelta: number) => {
  const lastInvestmentsSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
  const newPortfolioSnapshot = { ...lastInvestmentsSnapshot };

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

const rebalance = (portfolioSnapshot: PortfolioSnapshot, simulation: Simulation) => {
  const variables = simulation.variables!;
  const investments = portfolioSnapshot.investments;
  let rebalanceType: RebalanceType = RebalanceType.Excess;
  let cumulativeLastRebalanceLogs = simulation.rebalanceLogs
    .slice(-simulation.variables.lookBackRebalances)
    .reduce((acc, log) => acc + log.cumulativeRateSinceLastRebalance, 0);
  const targetRate = simulation.variables.targetRate;
  let reason = ``;

  investments.cash += 2;
  investments.mockTotalQQQ += 2;
  investments.mockTotalTQQQ += 2;

  if (cumulativeLastRebalanceLogs < variables.lookBackEnterRate * simulation.variables.lookBackRebalances) {
    if (DEBUG) console.log("still dropping");
    rebalanceType = RebalanceType.StillDropping;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
    reason += `Still dropping (${cumulativeLastRebalanceLogs.toFixed(3)} < ${(variables.lookBackEnterRate * 3).toFixed(
      3
    )})`;
  } else if (portfolioSnapshot.cumulativeRateSinceRebalance < variables.dropRate) {
    // DROP
    if (DEBUG) console.log("drop");
    rebalanceType = RebalanceType.Drop;
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
    reason += `Drop (${portfolioSnapshot.cumulativeRateSinceRebalance.toFixed(3)} < ${variables.dropRate.toFixed(3)})`;
  } else if (
    portfolioSnapshot.pullback > -0.5 &&
    portfolioSnapshot.cumulativeRateSinceRebalance > variables.spikeRate
  ) {
    // SPIKE
    if (DEBUG) console.log("spike");
    rebalanceType = RebalanceType.Spike;
    investments.TQQQ = investments.total * variables.targetRatio;
    investments.cash = investments.total * (1 - variables.targetRatio);
    portfolioSnapshot.nextTarget = investments.total * (1 + targetRate);
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
    reason += `Spike (${portfolioSnapshot.cumulativeRateSinceRebalance.toFixed(3)} > ${variables.spikeRate.toFixed(
      3
    )})`;
  } else if (investments.total >= portfolioSnapshot.nextTarget) {
    // Excess
    if (DEBUG) console.log("excess");
    rebalanceType = RebalanceType.Excess;
    const excess = investments.total - portfolioSnapshot.nextTarget;
    const actualExcess = Math.min(excess, investments.TQQQ);
    investments.TQQQ -= actualExcess;
    investments.cash += actualExcess;
    portfolioSnapshot.nextTarget = Math.min(portfolioSnapshot.nextTarget, investments.total) * (1 + targetRate);
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
    reason += `Excess (${portfolioSnapshot.cumulativeRateSinceRebalance.toFixed(3)} >= ${variables.targetRate.toFixed(
      3
    )})`;
  } else if (investments.total < portfolioSnapshot.nextTarget) {
    // Shortfall
    if (DEBUG) console.log("shortfall");
    rebalanceType = RebalanceType.Shortfall;
    const shortfall = portfolioSnapshot.nextTarget - investments.total;
    const actualShortfall = Math.min(shortfall, investments.cash);
    investments.TQQQ += actualShortfall;
    investments.cash -= actualShortfall;
    portfolioSnapshot.nextTarget = Math.min(portfolioSnapshot.nextTarget, investments.total) * (1 + targetRate);
    portfolioSnapshot.nextRebalanceDate = addDaysToDate(portfolioSnapshot.date, variables.rebalanceDays);
    reason += `Shortfall (${portfolioSnapshot.cumulativeRateSinceRebalance.toFixed(3)} < ${variables.targetRate.toFixed(
      3
    )})`;
  } else {
    console.log("bug");
  }

  if (DEBUG)
    console.log(
      "date",
      portfolioSnapshot.date,
      "$$$",
      portfolioSnapshot.investments.total?.toFixed(3),
      "nextTarget",
      portfolioSnapshot.nextTarget?.toFixed(3),
      "TQQQ",
      portfolioSnapshot.investments.TQQQ?.toFixed(3),
      "Rate",
      (portfolioSnapshot.cumulativeRateSinceRebalance * 100)?.toFixed(3)
    );

  const rebalanceLog: RebalanceLog = {
    date: portfolioSnapshot.date,
    total: investments.total,
    nextTarget: portfolioSnapshot.nextTarget,
    cumulativeRateSinceLastRebalance: portfolioSnapshot.cumulativeRateSinceRebalance,
    rebalanceType: rebalanceType,
    reason: reason,
  };
  simulation.rebalanceLogs.push(rebalanceLog);

  portfolioSnapshot.cumulativeRateSinceRebalance = 0;

  if (DEBUG) console.log("\n");
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

  console.log(
    `Running simulations from ${firstAvailableDate} to ${lastAvailableDate} (${nbYear} years per simulation)`
  );

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

            simulationCount++;
          }
        }
      } catch (error) {
        console.warn(`Simulation failed for start date ${nextAvailableDate}:`, error);
      }
    }

    // Move to next date (10 days later)
    currentDate.setDate(currentDate.getDate() + 10);
  }

  // console.log(
  //   `Completed ${simulationCount} simulations from ${results[0]?.startDate} to ${
  //     results[results.length - 1]?.startDate
  //   }`
  // );

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
      averageSig9Rate: 0,
      averageQQQRate: 0,
      averageTQQQRate: 0,
      bestSig9Rate: 0,
      worstSig9Rate: 0,
      winRate: 0,
    };
  }

  const sig9Rates = results.map((r) => r.simulation.annualizedSig9lRate || 0);
  const qqqRates = results.map((r) => r.simulation.annualizedQQQRate || 0);
  const tqqqRates = results.map((r) => r.simulation.annualizedTQQQRate || 0);

  const averageSig9Rate = sig9Rates.reduce((sum, rate) => sum + rate, 0) / sig9Rates.length;
  const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;
  const averageTQQQRate = tqqqRates.reduce((sum, rate) => sum + rate, 0) / tqqqRates.length;

  const bestSig9Rate = Math.max(...sig9Rates);
  const worstSig9Rate = Math.min(...sig9Rates);

  const resultsWithRates = results.map((r) => ({
    startDate: r.startDate,
    sig9Rate: r.simulation.annualizedSig9lRate || 0,
    qqqRate: r.simulation.annualizedQQQRate || 0,
    tqqqRate: r.simulation.annualizedTQQQRate || 0,
  }));

  const worst10Sig9 = resultsWithRates.sort((a, b) => a.sig9Rate - a.qqqRate - (b.sig9Rate - b.qqqRate)).slice(0, 10);

  console.log({
    totalSimulations: results.length,
    averageSig9Rate,
    averageQQQRate,
    averageTQQQRate,
    bestSig9Rate,
    worstSig9Rate,
    dateRange: {
      start: results[0]?.startDate,
      end: results[results.length - 1]?.startDate,
    },
  });

  worst10Sig9.forEach((result, index) => {
    console.log(
      `${index + 1}. ${result.startDate}: Sig9= ${(result.sig9Rate * 100)?.toFixed(2)}%, QQQ= ${(
        result.qqqRate * 100
      )?.toFixed(2)}%, TQQQ= ${(result.tqqqRate * 100)?.toFixed(2)}%`
    );
  });

  return {
    totalSimulations: results.length,
    averageSig9Rate,
    averageQQQRate,
    averageTQQQRate,
    bestSig9Rate,
    worstSig9Rate,
    worst10Sig9,
    dateRange: {
      start: results[0]?.startDate,
      end: results[results.length - 1]?.startDate,
    },
  };
};
