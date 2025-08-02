import React, { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, createSeriesMarkers } from "lightweight-charts";
import { ChartData, MultiSeriesChartData, RebalanceLog, RebalanceType } from "../core/models";

interface ChartProps {
  chartData?: ChartData;
  multiSeriesData?: MultiSeriesChartData;
  onPointClick?: (date: string, value: number) => void;
  useLogScale?: boolean;
  syncId?: string;
  onChartReady?: (chartId: string, chart: any, mainSeries: any) => void;
  rebalanceLogs?: RebalanceLog[];
  selectedDate: string | null;
}

const Chart: React.FC<ChartProps> = ({
  chartData,
  multiSeriesData,
  onPointClick,
  useLogScale = false,
  syncId,
  onChartReady,
  rebalanceLogs,
  selectedDate,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Determine if we have data to display
    const hasData = (chartData && chartData.length > 0) || (multiSeriesData && Object.keys(multiSeriesData).length > 0);

    if (!hasData) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "black",
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: "#e1e1e1" },
        horzLines: { color: "#e1e1e1" },
      },
      rightPriceScale: {
        borderColor: "#cccccc",
        mode: useLogScale ? 1 : 0, // 1 = logarithmic, 0 = normal
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 2, // 0 = normal, 1 = magnet, 2 = hidden
      },
      localization: {
        timeFormatter: (date: string) => date,
      },
    });

    const colors = {
      Sig9Target: "#E37400",
      Sig9Total: "#FBBC04",
      MockTotalQQQ: "#D2E3FC",
      MockTotalTQQQ: "#FAD2CF",
      Ratio: "#FBBC04",
      pullback: "#EA4335",
    };

    // Handle multi-series data
    if (multiSeriesData) {
      const seriesMap: { [key: string]: any } = {};
      let mainSeries: any = null;

      Object.entries(multiSeriesData).forEach(([seriesName, data]) => {
        const lineSeries = chart.addSeries(LineSeries, {
          color: colors[seriesName as keyof typeof colors] || "#2962FF",
          lineWidth: 2,
          lineStyle: seriesName === "Sig9Target" ? 1 : 0, // 1 = dashed, 0 = solid
          priceLineVisible: false, // Hide price line
          lastValueVisible: false, // Hide last value label
        });

        lineSeries.setData(data);
        seriesMap[seriesName] = { series: lineSeries, data };

        // Use the first series as main series for synchronization
        if (!mainSeries) {
          mainSeries = lineSeries;
        }
      });

      // Notify parent component that chart is ready
      if (onChartReady && syncId) {
        onChartReady(syncId, chart, mainSeries);
      }

      // Add rebalance markers if provided
      if (rebalanceLogs && rebalanceLogs.length > 0 && mainSeries) {
        const markers = rebalanceLogs.map((rebalanceLog) => {
          if (rebalanceLog.rebalanceType === RebalanceType.Rebalance) {
            return {
              time: rebalanceLog.date,
              position: "inBar" as const,
              color: "#E37400",
              shape: "circle" as const,
              size: 1,
            };
          } else if (rebalanceLog.rebalanceType === RebalanceType.Reset) {
            return {
              time: rebalanceLog.date,
              position: "inBar" as const,
              color: "#34A853",
              shape: "circle" as const,
              size: 1,
            };
          } else if (rebalanceLog.rebalanceType === RebalanceType.Skip) {
            return {
              time: rebalanceLog.date,
              position: "inBar" as const,
              color: "#EA4335",
              shape: "circle" as const,
              size: 1,
            };
          }
          return {
            time: rebalanceLog.date,
            position: "inBar" as const,
            color: "#E37400",
            shape: "circle" as const,
            size: 1,
          };
        });
        createSeriesMarkers(mainSeries, markers);
      }

      // Add click event handler for multi-series
      if (onPointClick) {
        chart.subscribeClick((param) => {
          if (param.time) {
            // Find the closest point from any series
            const allData = Object.values(multiSeriesData).flat();
            const clickedPoint = allData.find((point) => point.time === param.time);
            if (clickedPoint) {
              onPointClick(clickedPoint.time, clickedPoint.value);
            }
          }
        });
      }
    }

    // Fit content to the chart
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current?.clientWidth || 0,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [chartData, multiSeriesData, onPointClick, useLogScale, syncId, onChartReady, rebalanceLogs]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "400px",
        border: "1px solid #e1e1e1",
        borderRadius: "4px",
      }}
    />
  );
};

export default Chart;
