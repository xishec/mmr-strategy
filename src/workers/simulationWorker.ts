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
  type: 'SIMULATION_COMPLETE' | 'SIMULATION_ERROR';
  results?: any;
  error?: string;
}

self.onmessage = async function(e: MessageEvent<SimulationWorkerMessage>) {
  const { type, variables, marketData, nbYear } = e.data;
  
  if (type === 'RUN_SIMULATIONS') {
    try {
      const results = await runMultipleSimulations(variables, marketData, nbYear);
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
};

export {};
