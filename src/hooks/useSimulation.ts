import { useState, useRef, useEffect, useCallback } from 'react';
import { Simulation, MarketData } from '../core/models';
import { convertAnnualRateToDaily, startSimulation, runMultipleSimulations } from '../core/functions';
import { formatDate } from '../core/date-utils';

export interface SimulationVariables {
  startDate: Date;
  endDate: Date;
  initialMoney: number;
  rebalanceDays: number;
  targetRate: number;
  cashYearRate: number;
  targetRatio: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationYears: number;
  isLogScale: boolean;
}

export interface UseSimulationReturn {
  simulation: Simulation;
  variables: SimulationVariables;
  simulationResults: Array<{
    startDate: string;
    strategyRate: number;
    qqqRate: number;
    tqqqRate: number;
  }>;
  isRunningMultipleSimulations: boolean;
  simulationProgress: number;
  updateVariable: <K extends keyof SimulationVariables>(key: K, value: SimulationVariables[K]) => void;
  runMultipleSimulationsHandler: () => void;
  cancelSimulation: () => void;
}

export const useSimulation = (marketData: MarketData | null): UseSimulationReturn => {
  // Simulation variables
  const [variables, setVariables] = useState<SimulationVariables>({
    startDate: new Date(2000, 0, 1),
    endDate: new Date(),
    initialMoney: 100,
    rebalanceDays: 90,
    targetRate: 0.2,
    cashYearRate: 0.0,
    targetRatio: 0.5,
    dropRate: -0.2,
    monthlyNewCash: 2,
    simulationYears: 5,
    isLogScale: true,
  });

  const [simulationResults, setSimulationResults] = useState<
    Array<{
      startDate: string;
      strategyRate: number;
      qqqRate: number;
      tqqqRate: number;
    }>
  >([]);

  const [isRunningMultipleSimulations, setIsRunningMultipleSimulations] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);

  const [simulation, setSimulation] = useState<Simulation>({
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: {
      initialMoney: variables.initialMoney,
      startDate: formatDate(variables.startDate),
      endDate: formatDate(variables.endDate),
      rebalanceDays: variables.rebalanceDays,
      targetRate: variables.targetRate,
      cashDayRate: convertAnnualRateToDaily(variables.cashYearRate),
      targetRatio: variables.targetRatio,
      dropRate: variables.dropRate,
      monthlyNewCash: variables.monthlyNewCash,
    },
  });

  // Track when simulation needs to be run
  const lastSimulationParams = useRef<string>('');

  // Update variable function
  const updateVariable = useCallback(<K extends keyof SimulationVariables>(
    key: K,
    value: SimulationVariables[K]
  ) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle multiple simulations - simple approach
  const runMultipleSimulationsHandler = useCallback(async () => {
    if (marketData && simulation.variables) {
      setIsRunningMultipleSimulations(true);
      setSimulationProgress(0);
      
      try {
        console.log(`Starting multiple simulations for ${variables.simulationYears} years each...`);
        
        // Clear previous results
        setSimulationResults([]);
        
        const { analysisResults } = await runMultipleSimulations(
          simulation.variables, 
          marketData, 
          variables.simulationYears,
          (progress) => {
            setSimulationProgress(progress);
          }
        );
        
        // Set only the essential results we need for display
        setSimulationResults(analysisResults.resultsWithRates || []);
        
        console.log(`Completed ${analysisResults.totalSimulations} simulations`);
      } catch (error) {
        console.error('Error running multiple simulations:', error);
        setSimulationResults([]);
      } finally {
        setIsRunningMultipleSimulations(false);
        setSimulationProgress(0);
      }
    }
  }, [marketData, simulation.variables, variables.simulationYears]);

  // Simple cancel function (just resets state)
  const cancelSimulation = useCallback(() => {
    setIsRunningMultipleSimulations(false);
    setSimulationProgress(0);
    console.log('Simulation state reset');
  }, []);

  // Auto-update simulation when variables change
  useEffect(() => {
    setSimulation(prevSimulation => ({
      ...prevSimulation,
      variables: {
        initialMoney: variables.initialMoney,
        startDate: formatDate(variables.startDate),
        endDate: formatDate(variables.endDate),
        rebalanceDays: variables.rebalanceDays,
        targetRate: variables.targetRate,
        cashDayRate: convertAnnualRateToDaily(variables.cashYearRate),
        targetRatio: variables.targetRatio,
        dropRate: variables.dropRate,
        monthlyNewCash: variables.monthlyNewCash,
      },
    }));
  }, [
    variables.startDate,
    variables.endDate,
    variables.initialMoney,
    variables.rebalanceDays,
    variables.targetRate,
    variables.cashYearRate,
    variables.targetRatio,
    variables.dropRate,
    variables.monthlyNewCash,
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
    simulationResults,
    isRunningMultipleSimulations,
    simulationProgress,
    updateVariable,
    runMultipleSimulationsHandler,
    cancelSimulation,
  };
};
