import { useMemo } from "react";
import { Simulation, RebalanceLog, PortfolioSnapshot, D3ChartData } from "../core/models";

export interface LegendValues {
  priceValues: { [key: string]: number };
  ratioValues: { [key: string]: number };
}

export interface UseChartDataReturn {
  d3ChartData: D3ChartData;
  legendValues: LegendValues;
}

export const useChartData = (simulation: Simulation, selectedDate: string | null): UseChartDataReturn => {
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
      MockTotalQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalQQQ,
      })),
      MockTotalTQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalTQQQ,
      })),
      MockTotalNothing: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalNothing,
      })),
      StrategyTotalAll: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.total,
      })),
      StrategyTotal: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: rebalanceLog.before.investments.total,
      })),
      // Target: simulation.rebalanceLogs.map((rebalanceLog) => ({
      //   time: rebalanceLog.date,
      //   value: rebalanceLog.before.nextTarget,
      // })),
    };

    const ratioChart = {
      Ratio: simulation.portfolioSnapshots.map((snapshot) => ({
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

  // Calculate legend values for the selected date
  const legendValues = useMemo((): LegendValues => {
    if (!selectedDate || !d3ChartData) {
      return { priceValues: {}, ratioValues: {} };
    }

    const priceValues: { [key: string]: number } = {};
    const ratioValues: { [key: string]: number } = {};

    // Get values for each series at the selected date
    Object.entries({
      ...d3ChartData.priceChart,
      ...d3ChartData.ratioChart,
      ...d3ChartData.pullbackChart,
    }).forEach(([seriesName, data]) => {
      const dataPoint = data.find((dp: any) => dp.time === selectedDate);
      if (dataPoint) {
        if (["StrategyTotal", "Target", "MockTotalQQQ", "MockTotalTQQQ"].includes(seriesName)) {
          priceValues[seriesName] = dataPoint.value;
        } else {
          ratioValues[seriesName] = dataPoint.value;
        }
      }
    });

    return { priceValues, ratioValues };
  }, [selectedDate, d3ChartData]);

  return {
    d3ChartData,
    legendValues,
  };
};
