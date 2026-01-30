import { useMemo } from "react";
import { Simulation, PortfolioSnapshot, D3ChartData } from "../core/models";

export const useChartData = (simulation: Simulation, selectedDate: string | null): D3ChartData => {
  // Memoize expensive chart data calculations
  const d3ChartData = useMemo((): D3ChartData => {
    if (!simulation) {
      return {
        priceChart: {},
        ratioChart: {},
        pullbackChart: {},
      };
    }

    // Create portfolio snapshots map for quick lookup
    const portfolioSnapshotsMap: Record<string, PortfolioSnapshot> = {};
    simulation.portfolioSnapshots.forEach((snapshot) => {
      portfolioSnapshotsMap[snapshot.date] = snapshot;
    });

    const priceChart = {
      mockTotalNothing: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalNothing,
      })),
      mockTotalQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalQQQ,
      })),
      mockTotalTQQQ: simulation.portfolioSnapshots.map((snapshot, i) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalTQQQ,
        hasXMarker: snapshot.signal.hasXMarker,
        hasYellowMarker:
          snapshot.signal.hasYellowMarker && !simulation.portfolioSnapshots[i - 1]?.signal.hasYellowMarker,
        hasOrangeMarker:
          snapshot.signal.hasOrangeMarker && !simulation.portfolioSnapshots[i - 1]?.signal.hasOrangeMarker,
        hasRedMarker: snapshot.signal.hasRedMarker && !simulation.portfolioSnapshots[i - 1]?.signal.hasRedMarker,
        hasBlueMarker: snapshot.signal.hasBlueMarker && !simulation.portfolioSnapshots[i - 1]?.signal.hasBlueMarker,
        hasGreenTriangle:
          snapshot.signal.hasGreenTriangle && !simulation.portfolioSnapshots[i - 1]?.signal.hasGreenTriangle,
        hasBlackTriangle:
          snapshot.signal.hasBlackTriangle && !simulation.portfolioSnapshots[i - 1]?.signal.hasBlackTriangle,
        belowSMA:
          snapshot.signal.belowSMA && !simulation.portfolioSnapshots[i - 1]?.signal.belowSMA,
      })),
      strategyTotal: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.total,
      })),
    };

    const ratioChart = {
      ratio: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.ratio,
      })),
    };

    const pullbackChart = {
      pullback: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.pullback,
      })),
    };

    return {
      priceChart,
      ratioChart,
      pullbackChart,
    };
  }, [simulation]);

  return d3ChartData;
};
