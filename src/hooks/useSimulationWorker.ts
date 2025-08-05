import { useState, useRef, useEffect, useCallback } from 'react';
import { Variables, MarketData } from '../core/models';

interface SimulationWorkerMessage {
  type: 'RUN_SIMULATIONS';
  variables: Variables;
  marketData: MarketData;
  nbYear: number;
}

interface SimulationWorkerResponse {
  type: 'SIMULATION_COMPLETE' | 'SIMULATION_ERROR' | 'SIMULATION_PROGRESS';
  results?: any;
  error?: string;
  progress?: number;
}

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
  
  const workerRef = useRef<Worker | null>(null);
  const lastProgressUpdateRef = useRef<number>(0);

  // Throttled progress update to prevent excessive re-renders
  const throttledProgressUpdate = useCallback((progress: number) => {
    const now = Date.now();
    if (now - lastProgressUpdateRef.current > 100 || progress === 100) {
      lastProgressUpdateRef.current = now;
      setProgress(progress);
    }
  }, []);

  // Initialize worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        workerRef.current = new Worker(
          new URL('../workers/simulationWorker.ts', import.meta.url),
          { type: 'module' }
        );

        workerRef.current.onmessage = (e: MessageEvent<SimulationWorkerResponse>) => {
          const { type, results: workerResults, error: workerError, progress: workerProgress } = e.data;

          switch (type) {
            case 'SIMULATION_PROGRESS':
              if (workerProgress !== undefined) {
                throttledProgressUpdate(workerProgress);
              }
              break;
            case 'SIMULATION_COMPLETE':
              setResults(workerResults?.analysisResults?.resultsWithRates || []);
              setIsRunning(false);
              setProgress(0);
              setError(null);
              break;
            case 'SIMULATION_ERROR':
              setError(workerError || 'Unknown error');
              setIsRunning(false);
              setProgress(0);
              break;
          }
        };

        workerRef.current.onerror = (error) => {
          console.error('Worker error:', error);
          setError('Worker failed to initialize');
          setIsRunning(false);
        };
      } catch (error) {
        console.warn('Worker not supported, falling back to main thread');
        workerRef.current = null;
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [throttledProgressUpdate]);

  const runSimulation = useCallback((variables: Variables, marketData: MarketData, nbYear: number) => {
    if (!workerRef.current) {
      setError('Worker not available');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setError(null);
    setResults([]);
    lastProgressUpdateRef.current = 0;

    const message: SimulationWorkerMessage = {
      type: 'RUN_SIMULATIONS',
      variables,
      marketData,
      nbYear,
    };

    workerRef.current.postMessage(message);
  }, []);

  const cancelSimulation = useCallback(() => {
    if (workerRef.current && isRunning) {
      // Terminate and recreate worker to cancel simulation
      workerRef.current.terminate();
      setIsRunning(false);
      setProgress(0);
      
      // Recreate worker for future use
      if (typeof Worker !== 'undefined') {
        try {
          workerRef.current = new Worker(
            new URL('../workers/simulationWorker.ts', import.meta.url),
            { type: 'module' }
          );
          // Re-setup event handlers (same as in useEffect)
          workerRef.current.onmessage = (e: MessageEvent<SimulationWorkerResponse>) => {
            const { type, results: workerResults, error: workerError, progress: workerProgress } = e.data;
            switch (type) {
              case 'SIMULATION_PROGRESS':
                if (workerProgress !== undefined) {
                  throttledProgressUpdate(workerProgress);
                }
                break;
              case 'SIMULATION_COMPLETE':
                setResults(workerResults?.analysisResults?.resultsWithRates || []);
                setIsRunning(false);
                setProgress(0);
                setError(null);
                break;
              case 'SIMULATION_ERROR':
                setError(workerError || 'Unknown error');
                setIsRunning(false);
                setProgress(0);
                break;
            }
          };
        } catch (error) {
          console.warn('Failed to recreate worker');
          workerRef.current = null;
        }
      }
    }
  }, [isRunning, throttledProgressUpdate]);

  return {
    isRunning,
    progress,
    results,
    error,
    runSimulation,
    cancelSimulation,
  };
};
