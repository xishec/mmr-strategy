import { useMemo } from "react";
import { Simulation, PortfolioSnapshot, D3ChartData, SignalType } from "../core/models";

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
        hasXMarker: snapshot.signal.bigDropLast30Days,
        hasArrowMarker: snapshot.signal.bigPullbackLast30Days,
        hasGreenTriangle: snapshot.signal.signalType === SignalType.Buy,
        hasBlackTriangle: snapshot.signal.isBelowSMA200,
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
