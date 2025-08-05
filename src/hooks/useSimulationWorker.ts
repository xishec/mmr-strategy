import { useState, useCallback } from 'react';
import { Variables, MarketData } from '../core/models';
import { runMultipleSimulations } from '../core/functions';

export interface UseSimulationWorkerReturn {
  isRunning: boolean;
  progress: number;
  results: any[];
  error: string | null;
  runSimulation: (variables: Variables, marketData: MarketData, nbYear: number) => void;
  cancelSimulation: () => void;
}

export const useSimulationWorker = (): UseSimulationWorkerReturn => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async (variables: Variables, marketData: MarketData, nbYear: number) => {
    setIsRunning(true);
    setProgress(0);
    setError(null);
    setResults([]);

    try {
      // Run simulation in main thread with progress updates
      const simulationResults = await runMultipleSimulations(
        variables,
        marketData,
        nbYear,
        (progress: number) => setProgress(progress)
      );
      
      setResults(simulationResults?.analysisResults?.resultsWithRates || []);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  }, []);

  const cancelSimulation = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      setProgress(0);
      setError(null);
      console.log('Simulation cancelled');
    }
  }, [isRunning]);

  return {
    isRunning,
    progress,
    results,
    error,
    runSimulation,
    cancelSimulation,
  };
};
