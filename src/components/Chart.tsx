import React, { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries } from "lightweight-charts";
import { ChartData } from "../core/models";

interface ChartProps {
  chartData: ChartData;
  onPointClick?: (date: string, value: number) => void;
}

function Chart({ chartData, onPointClick }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return;

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
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Add line series for portfolio total
    const lineSeries = chart.addSeries(LineSeries, {
      color: "#2962FF",
      lineWidth: 2,
    });

    // Set data to the series
    lineSeries.setData(chartData);

    // Add click event handler
    if (onPointClick) {
      chart.subscribeClick((param) => {
        if (param.time) {
          const clickedPoint = chartData.find(point => point.time === param.time);
          if (clickedPoint) {
            onPointClick(clickedPoint.time, clickedPoint.value);
          }
        }
      });
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
  }, [chartData, onPointClick]);

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
}

export default Chart;
