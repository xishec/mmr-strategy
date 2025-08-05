// Web Worker for running simulations in a separate thread
// This can be implemented if we need even better UI responsiveness

import { runMultipleSimulations } from '../core/functions';
import { Variables, MarketData } from '../core/models';

interface SimulationWorkerMessage {
  type: 'RUN_SIMULATIONS' | 'CANCEL_SIMULATION';
  variables?: Variables;
  marketData?: MarketData;
  nbYear?: number;
}

interface SimulationWorkerResponse {
  type: 'SIMULATION_COMPLETE' | 'SIMULATION_ERROR' | 'SIMULATION_PROGRESS' | 'SIMULATION_CANCELLED';
  results?: any;
  error?: string;
  progress?: number;
}

// Global abort controller for cancellation
let abortController: AbortController | null = null;

// Handle messages from the main thread
addEventListener('message', async (e: MessageEvent<SimulationWorkerMessage>) => {
  const { type, variables, marketData, nbYear } = e.data;
  
  if (type === 'CANCEL_SIMULATION') {
    // Cancel any running simulation
    if (abortController) {
      abortController.abort();
      abortController = null;
      postMessage({
        type: 'SIMULATION_CANCELLED'
      } as SimulationWorkerResponse);
    }
    return;
  }
  
  if (type === 'RUN_SIMULATIONS' && variables && marketData && nbYear) {
    // Cancel any existing simulation first
    if (abortController) {
      abortController.abort();
    }
    
    // Create new abort controller
    abortController = new AbortController();
    
    try {
      // Progress callback to report back to main thread
      const onProgress = (progress: number) => {
        postMessage({
          type: 'SIMULATION_PROGRESS',
          progress
        } as SimulationWorkerResponse);
      };

      const results = await runMultipleSimulations(
        variables, 
        marketData, 
        nbYear, 
        onProgress,
        abortController.signal
      );
      
      // Only send results if not cancelled
      if (!abortController.signal.aborted) {
        postMessage({
          type: 'SIMULATION_COMPLETE',
          results
        } as SimulationWorkerResponse);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Cancelled simulation - send cancellation message
        postMessage({
          type: 'SIMULATION_CANCELLED'
        } as SimulationWorkerResponse);
      } else {
        postMessage({
          type: 'SIMULATION_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as SimulationWorkerResponse);
      }
    } finally {
      abortController = null;
    }
  }
});

export {};
