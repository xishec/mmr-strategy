import { useMemo } from "react";
import { Simulation, RebalanceLog, PortfolioSnapshot, D3ChartData } from "../core/models";

export const useChartData = (simulation: Simulation, selectedDate: string | null): D3ChartData => {
  // Memoize expensive chart data calculations
  const d3ChartData = useMemo((): D3ChartData => {
    if (!simulation || simulation.rebalanceLogs.length === 0) {
      return {
        priceChart: {},
        ratioChart: {},
        pullbackChart: {},
        rebalanceLogsMap: {},
      };
    }

    // Create portfolio snapshots map for quick lookup
    const portfolioSnapshotsMap: Record<string, PortfolioSnapshot> = {};
    simulation.portfolioSnapshots.forEach((snapshot) => {
      portfolioSnapshotsMap[snapshot.date] = snapshot;
    });

    // Create rebalance logs map for quick lookup by date
    const newRebalanceLogsMap: Record<string, RebalanceLog> = {};
    simulation.rebalanceLogs.forEach((log) => {
      newRebalanceLogsMap[log.date] = log;
    });

    const priceChart = {
      mockTotalQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalQQQ,
      })),
      mockTotalTQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalTQQQ,
      })),
      mockTotalNothing: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalNothing,
      })),
      strategyTotalAll: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.total,
      })),
      strategyTotal: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: rebalanceLog.before.investments.total,
      })),
      sma200: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.sma200,
      })),
      // Target: simulation.rebalanceLogs.map((rebalanceLog) => ({
      //   time: rebalanceLog.date,
      //   value: rebalanceLog.before.nextTarget,
      // })),
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
      rebalanceLogsMap: newRebalanceLogsMap,
    };
  }, [simulation]);

  return d3ChartData;
};
