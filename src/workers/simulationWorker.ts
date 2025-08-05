// Web Worker for running simulations in a separate thread
// This can be implemented if we need even better UI responsiveness

import { runMultipleSimulations } from '../core/functions';
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

// Declare the worker context with proper typing
declare const self: Worker & {
  addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  postMessage: (message: any) => void;
};

// Handle messages from the main thread
self.addEventListener('message', async (e: MessageEvent<SimulationWorkerMessage>) => {
  const { type, variables, marketData, nbYear } = e.data;
  
  if (type === 'RUN_SIMULATIONS') {
    try {
      // Progress callback to report back to main thread
      const onProgress = (progress: number) => {
        self.postMessage({
          type: 'SIMULATION_PROGRESS',
          progress
        } as SimulationWorkerResponse);
      };

      const results = await runMultipleSimulations(
        variables, 
        marketData, 
        nbYear, 
        onProgress,
        undefined // No abort signal in worker for now
      );
      
      self.postMessage({
        type: 'SIMULATION_COMPLETE',
        results
      } as SimulationWorkerResponse);
    } catch (error) {
      self.postMessage({
        type: 'SIMULATION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      } as SimulationWorkerResponse);
    }
  }
});

export {};
