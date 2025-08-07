import { useState, useRef, useEffect, useCallback } from "react";
import { Simulation, MarketData, AnalysisResults, DashboardVariables } from "../core/models";
import { convertAnnualRateToDaily, startSimulation, runMultipleSimulations } from "../core/functions";
import { formatDate } from "../core/date-utils";

export interface UseSimulationReturn {
  simulation: Simulation;
  variables: DashboardVariables;
  analysisResults: AnalysisResults | null;
  updateVariable: <K extends keyof DashboardVariables>(key: K, value: DashboardVariables[K]) => void;
  runMultipleSimulationsHandler: () => void;
  cancelSimulation: () => void;
}

export const useSimulation = (marketData: MarketData | null): UseSimulationReturn => {
  // Simulation variables
  const [variables, setVariables] = useState<DashboardVariables>({
    startDate: new Date(2000, 0, 1),
    endDate: new Date(),
    initialMoney: 100000,
    rebalanceDays: 90,
    cashYearRate: 0.0,
    dropRate: -0.2,
    monthlyNewCash: 2000,
    simulationYears: 10,
    isLogScale: true,
    simulationFrequencyDays: 3,
    simulationAnalysisMinusYears: 6,
  });

  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);

  const [simulation, setSimulation] = useState<Simulation>({
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: {
      initialMoney: variables.initialMoney,
      startDate: formatDate(variables.startDate),
      endDate: formatDate(variables.endDate),
      rebalanceDays: variables.rebalanceDays,
      cashDayRate: convertAnnualRateToDaily(variables.cashYearRate),
      dropRate: variables.dropRate,
      monthlyNewCash: variables.monthlyNewCash,
      simulationFrequencyDays: 3,
      simulationAnalysisMinusYears: 2,
    },
  });

  // Track when simulation needs to be run
  const lastSimulationParams = useRef<string>("");

  // Update variable function
  const updateVariable = useCallback(<K extends keyof DashboardVariables>(key: K, value: DashboardVariables[K]) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle multiple simulations - simple approach
  const runMultipleSimulationsHandler = useCallback(async () => {
    if (marketData && simulation.variables) {
      try {
        console.log(`Starting multiple simulations for ${variables.simulationYears} years each...`);

        // Clear previous results
        setAnalysisResults(null);

        const { analysisResults } = await runMultipleSimulations(
          simulation.variables,
          marketData,
          variables.simulationYears
        );

        // Set the analysis results and the individual results
        setAnalysisResults(analysisResults);

        console.log(`Completed ${analysisResults.totalSimulations} simulations`);
      } catch (error) {
        console.error("Error running multiple simulations:", error);
        setAnalysisResults(null);
      } finally {
      }
    }
  }, [marketData, simulation.variables, variables.simulationYears]);

  // Simple cancel function (just resets state)
  const cancelSimulation = useCallback(() => {
    console.log("Simulation state reset");
  }, []);

  // Auto-update simulation when variables change
  useEffect(() => {
    setSimulation((prevSimulation) => ({
      ...prevSimulation,
      variables: {
        initialMoney: variables.initialMoney,
        startDate: formatDate(variables.startDate),
        endDate: formatDate(variables.endDate),
        rebalanceDays: variables.rebalanceDays,
        cashDayRate: convertAnnualRateToDaily(variables.cashYearRate),
        dropRate: variables.dropRate,
        monthlyNewCash: variables.monthlyNewCash,
        simulationFrequencyDays: variables.simulationFrequencyDays,
        simulationAnalysisMinusYears: variables.simulationAnalysisMinusYears,
      },
    }));
  }, [
    variables.startDate,
    variables.endDate,
    variables.initialMoney,
    variables.rebalanceDays,
    variables.cashYearRate,
    variables.dropRate,
    variables.monthlyNewCash,
    variables.simulationFrequencyDays,
    variables.simulationAnalysisMinusYears,
  ]);

  // Run simulation when parameters change
  useEffect(() => {
    if (marketData && simulation) {
      const currentParams = JSON.stringify(simulation.variables);
      if (currentParams !== lastSimulationParams.current) {
        lastSimulationParams.current = currentParams;
        startSimulation(simulation, setSimulation, marketData);
      }
    }
  }, [marketData, simulation]);

  return {
    simulation,
    variables,
    analysisResults,
    updateVariable,
    runMultipleSimulationsHandler,
    cancelSimulation,
  };
};
