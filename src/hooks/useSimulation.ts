import { useState, useRef, useEffect, useCallback } from "react";
import { Simulation, MarketData, DashboardVariables, MultiSimulationResults, MultiSimulation } from "../core/models";
import { startSimulation, runMultipleSimulations } from "../core/functions";

export interface UseSimulationReturn {
  simulation: Simulation;
  dashboardVariables: DashboardVariables;
  multiSimulationResults: MultiSimulationResults | null;
  updateVariable: <K extends keyof DashboardVariables>(key: K, value: DashboardVariables[K]) => void;
  runMultipleSimulationsHandler: () => void;
  cancelSimulation: () => void;
}

export const useSimulation = (marketData: MarketData | null): UseSimulationReturn => {
  // Simulation variables
  const [dashboardVariables, setDashboardVariables] = useState<DashboardVariables>({
    simulationVariables: {
      initialMoney: 100000,
      startDate: Object.keys(marketData!.QQQ)[0],
      endDate: Object.keys(marketData!.QQQ).slice(-1)[0],
      cashYearRate: 0.0,
      SMAUpMargin: 0.03,
      SMADownMargin: -0.0,
      monthlyNewCash: 2000,
      buyAtOpen: true,
    },
    multiSimulationVariables: {
      simulationFrequencyDays: 3,
      simulationDurationYears: 10,
      simulationAnalysisMinusYears: 1,
    },
    uiVariables: {
      isLogScale: true,
      showSignalMarkers: false,
    },
  });

  const [simulation, setSimulation] = useState<Simulation>({
    portfolioSnapshots: [],
    simulationVariables: {
      initialMoney: dashboardVariables.simulationVariables.initialMoney,
      startDate: dashboardVariables.simulationVariables.startDate,
      endDate: dashboardVariables.simulationVariables.endDate,
      cashYearRate: dashboardVariables.simulationVariables.cashYearRate,
      SMAUpMargin: dashboardVariables.simulationVariables.SMAUpMargin,
      SMADownMargin: dashboardVariables.simulationVariables.SMADownMargin,
      monthlyNewCash: dashboardVariables.simulationVariables.monthlyNewCash,
      buyAtOpen: dashboardVariables.simulationVariables.buyAtOpen,
    },
    simulationResults: undefined,
  });

  const [multiSimulation, setMultiSimulation] = useState<MultiSimulation>({
    simulations: [],
    multiSimulationVariables: {
      simulationFrequencyDays: dashboardVariables.multiSimulationVariables.simulationFrequencyDays,
      simulationDurationYears: dashboardVariables.multiSimulationVariables.simulationDurationYears,
      simulationAnalysisMinusYears: dashboardVariables.multiSimulationVariables.simulationAnalysisMinusYears,
    },
    multiSimulationResults: undefined,
  });

  const [multiSimulationResults, setMultiSimulationResults] = useState<MultiSimulationResults | null>(null);

  useEffect(() => {
    setMultiSimulation((prev) => ({
      ...prev,
      multiSimulationVariables: {
        simulationFrequencyDays: dashboardVariables.multiSimulationVariables.simulationFrequencyDays,
        simulationDurationYears: dashboardVariables.multiSimulationVariables.simulationDurationYears,
        simulationAnalysisMinusYears: dashboardVariables.multiSimulationVariables.simulationAnalysisMinusYears,
      },
    }));
  }, [dashboardVariables.multiSimulationVariables]);

  useEffect(() => {
    setSimulation((prev) => ({
      ...prev,
      simulationVariables: {
        initialMoney: dashboardVariables.simulationVariables.initialMoney,
        startDate: dashboardVariables.simulationVariables.startDate,
        endDate: dashboardVariables.simulationVariables.endDate,
        cashYearRate: dashboardVariables.simulationVariables.cashYearRate,
        SMAUpMargin: dashboardVariables.simulationVariables.SMAUpMargin,
        SMADownMargin: dashboardVariables.simulationVariables.SMADownMargin,
        monthlyNewCash: dashboardVariables.simulationVariables.monthlyNewCash,
        buyAtOpen: dashboardVariables.simulationVariables.buyAtOpen,
      },
    }));
  }, [dashboardVariables.simulationVariables]);

  const updateVariable = useCallback(<K extends keyof DashboardVariables>(key: K, value: DashboardVariables[K]) => {
    setDashboardVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle multiple simulations - simple approach
  const runMultipleSimulationsHandler = useCallback(async () => {
    if (marketData && multiSimulation) {
      try {
        console.log(
          `Starting multiple simulations for ${multiSimulation.multiSimulationVariables.simulationDurationYears} years each...`
        );

        // Clear previous results
        setMultiSimulationResults(null);

        const multiSimulationResults = await runMultipleSimulations(dashboardVariables, marketData);

        // Set the analysis results and the individual results
        setMultiSimulationResults(multiSimulationResults);

        console.log(`Completed ${multiSimulationResults.totalSimulations} simulations`);
      } catch (error) {
        console.error("Error running multiple simulations:", error);
        setMultiSimulationResults(null);
      } finally {
      }
    }
  }, [marketData, multiSimulation, dashboardVariables]);

  const cancelSimulation = useCallback(() => {
    console.log("Simulation state reset");
  }, []);

  const lastSimulationParams = useRef<string>("");
  useEffect(() => {
    if (marketData && simulation) {
      const currentParams = JSON.stringify(simulation.simulationVariables);
      if (currentParams !== lastSimulationParams.current) {
        lastSimulationParams.current = currentParams;
        startSimulation(simulation, setSimulation, marketData);
      }
    }
  }, [marketData, simulation]);

  return {
    simulation,
    dashboardVariables,
    multiSimulationResults,
    updateVariable,
    runMultipleSimulationsHandler,
    cancelSimulation,
  };
};
