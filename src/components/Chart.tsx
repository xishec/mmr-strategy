import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ChartData, MultiSeriesChartData, RebalanceLog } from "../core/models";

const black = "#202124";
const yellow = "#FBBC04";
const blue = "#4285F4";
const red = "#EA4335";
// const green = "#34A853";

interface ChartProps {
  chartData?: ChartData;
  multiSeriesData?: MultiSeriesChartData;
  onPointClick?: (date: string, value: number) => void;
  syncId?: string;
  onChartReady?: (chartId: string, chart: any, mainSeries: any) => void;
  rebalanceLogsMap?: Record<string, RebalanceLog>;
  selectedDate: string | null;
  onCrosshairMove?: (date: string | null) => void;
  onCrosshairLeave?: () => void;
  chartType?: "price" | "ratio" | "pullback" | "ratio-pullback" | "combined";
  isLogScale?: boolean;
  height?: string | number;
  onLegendValuesChange?: (values: { [key: string]: number }) => void;
}

const Chart: React.FC<ChartProps> = ({
  chartData,
  multiSeriesData,
  onPointClick,
  syncId,
  onChartReady,
  rebalanceLogsMap,
  selectedDate,
  onCrosshairMove,
  onCrosshairLeave,
  chartType = "price",
  isLogScale = false,
  height = "400px",
  onLegendValuesChange,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);

  const createD3Chart = useCallback(() => {
    if (!chartContainerRef.current || !svgRef.current) return null;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Setup dimensions and data
    const margin = { top: 20, right: 20, bottom: 40, left: 100 }; // More left margin for dual y-axes, less right margin
    const width = container.clientWidth - margin.left - margin.right;
    const totalChartHeight = container.clientHeight - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data
    const seriesData = multiSeriesData || (chartData ? { default: chartData } : {});
    const allData = Object.values(seriesData).flat();
    if (allData.length === 0) return null;

    // Parse dates
    const parseTime = d3.timeParse("%Y-%m-%d");
    const parsedData = allData.map((d) => ({
      ...d,
      parsedTime: parseTime(d.time),
    }));

    // Chart layout for combined view
    const isCombined = chartType === "combined";
    const spaceBetweenCharts = 20; // Smart spacing between price and ratio charts
    const priceHeight = isCombined ? (totalChartHeight - spaceBetweenCharts) * 0.75 : totalChartHeight;
    const ratioHeight = isCombined ? (totalChartHeight - spaceBetweenCharts) * 0.25 : 0;
    const ratioTop = isCombined ? priceHeight + spaceBetweenCharts : 0;

    // Separate series by type
    const priceKeys = ["StrategyTotal", "Target", "MockTotalQQQ", "MockTotalTQQQ"];
    const ratioKeys = ["Ratio", "pullback"];

    const getSeriesByType = (type: "price" | "ratio") => {
      const keys = type === "price" ? priceKeys : ratioKeys;
      const result: { [key: string]: any[] } = {};
      Object.entries(seriesData).forEach(([key, data]) => {
        if (keys.includes(key)) result[key] = data;
      });
      return result;
    };

    const priceSeriesData = isCombined ? getSeriesByType("price") : seriesData;
    const ratioSeriesData = isCombined ? getSeriesByType("ratio") : {};

    // Create time scale
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.parsedTime) as [Date, Date])
      .range([0, width]);

    // Create Y scales
    const priceData = isCombined ? Object.values(priceSeriesData).flat() : allData;
    const priceExtent = d3.extent(priceData, (d) => d.value) as [number, number];

    const priceYScale = isLogScale
      ? d3.scaleLog().domain(priceExtent).range([priceHeight, 0])
      : d3.scaleLinear().domain(priceExtent).range([priceHeight, 0]);

    const ratioYScale = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([ratioTop + ratioHeight, ratioTop]);

    // Color mapping
    const colorMap = {
      StrategyTotal: yellow,
      Target: black,
      MockTotalQQQ: blue,
      MockTotalTQQQ: red,
      Ratio: blue,
      pullback: red,
      default: "#2962FF",
    };

    // Helper function to render a series
    const renderSeries = (seriesName: string, data: any[], yScale: any, isArea = false) => {
      const color = colorMap[seriesName as keyof typeof colorMap] || colorMap.default;
      const processedData = data.map((d) => ({ ...d, parsedTime: parseTime(d.time) }));

      if (seriesName === "Target") {
        // Render as points
        g.append("g")
          .attr("class", `points series-${seriesName}`)
          .selectAll("circle")
          .data(processedData)
          .enter()
          .append("circle")
          .attr("cx", (d) => xScale(d.parsedTime))
          .attr("cy", (d) => yScale(d.value))
          .attr("r", 2)
          .attr("stroke", color)
          .attr("fill", color);
      } else {
        // Render as line/area
        const line = d3
          .line<any>()
          .x((d) => xScale(d.parsedTime))
          .y((d) => yScale(d.value));

        if (isArea) {
          const area = d3
            .area<any>()
            .x((d) => xScale(d.parsedTime))
            .y0(yScale(0))
            .y1((d) => yScale(d.value));

          g.append("path")
            .datum(processedData)
            .attr("class", `area series-${seriesName}`)
            .attr("fill", color)
            .attr("fill-opacity", 0.3)
            .attr("d", area);
        }

        g.append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", seriesName === "Target" ? "5,5" : "none")
          .attr("d", line);
      }

      return { data: processedData, name: seriesName };
    };

    // Add layout elements
    if (isCombined) {
      // Add center line at y=0 for ratio section
      g.append("line")
        .attr("class", "center-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", ratioYScale(0))
        .attr("y2", ratioYScale(0))
        .attr("stroke", "#666")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    }

    // Add center line for standalone ratio charts
    if ((chartType === "ratio" || chartType === "pullback" || chartType === "ratio-pullback") && !isCombined) {
      g.append("line")
        .attr("class", "center-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", priceYScale(0))
        .attr("y2", priceYScale(0))
        .attr("stroke", "#666")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    }

    // Render all series
    let mainSeries: any = null;

    if (isCombined) {
      // Render price series
      Object.entries(priceSeriesData).forEach(([name, data]) => {
        const series = renderSeries(name, data, priceYScale);
        if (!mainSeries) mainSeries = series;
      });

      // Render ratio series with areas
      Object.entries(ratioSeriesData).forEach(([name, data]) => {
        const series = renderSeries(name, data, ratioYScale, true);
        if (!mainSeries) mainSeries = series;
      });
    } else {
      // Single chart mode
      Object.entries(seriesData).forEach(([name, data]) => {
        const yScale = priceYScale;
        const isAreaChart = ["Ratio", "pullback"].includes(name);
        const series = renderSeries(name, data, yScale, isAreaChart);
        if (!mainSeries) mainSeries = series;
      });
    }

    // Add crosshair
    const crosshair = g.append("g").attr("class", "crosshair").style("display", "none");
    const crosshairLine = crosshair
      .append("line")
      .attr("y1", 0)
      .attr("y2", totalChartHeight)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Add overlay for mouse events
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", totalChartHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    // Mouse event handlers
    overlay
      .on("mousemove", (event: any) => {
        const [mouseX] = d3.pointer(event);
        const date = xScale.invert(mouseX);
        crosshair.style("display", null);

        if (rebalanceLogsMap) {
          const rebalanceDates = Object.keys(rebalanceLogsMap)
            .map(parseTime)
            .filter((d): d is Date => d !== null);

          if (rebalanceDates.length > 0) {
            const closestRebalanceDate = rebalanceDates.reduce((closest, current) => {
              return Math.abs(current.getTime() - date.getTime()) < Math.abs(closest.getTime() - date.getTime())
                ? current
                : closest;
            });
            const snapX = xScale(closestRebalanceDate);
            crosshairLine.attr("x1", snapX).attr("x2", snapX);
            if (onCrosshairMove) {
              onCrosshairMove(d3.timeFormat("%Y-%m-%d")(closestRebalanceDate));
            }
          } else {
            crosshairLine.attr("x1", mouseX).attr("x2", mouseX);
            if (onCrosshairMove) {
              onCrosshairMove(d3.timeFormat("%Y-%m-%d")(date));
            }
          }
        }
      })
      .on("mouseout", () => {
        crosshair.style("display", "none");
        if (onCrosshairLeave) onCrosshairLeave();
      })
      .on("click", (event: any) => {
        if (onPointClick && mainSeries) {
          const [mouseX] = d3.pointer(event);
          const date = xScale.invert(mouseX);
          const bisect = d3.bisector((d: any) => d.parsedTime).left;
          const i = bisect(mainSeries.data, date, 1);
          const d0 = mainSeries.data[i - 1];
          const d1 = mainSeries.data[i];
          if (d0 && d1) {
            const isD1Closer = date.getTime() - d0.parsedTime.getTime() > d1.parsedTime.getTime() - date.getTime();
            const closestPoint = isD1Closer ? d1 : d0;
            onPointClick(closestPoint.time, closestPoint.value);
          }
        }
      });

    // Add axes
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${totalChartHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((domainValue) => {
            return d3.timeFormat("%Y-%m-%d")(domainValue as Date);
          })
      );

    // Add Y-axes
    if (isCombined || chartType === "price") {
      const yAxisConfig = isLogScale ? d3.axisLeft(priceYScale).ticks(4, "~g") : d3.axisLeft(priceYScale);
      g.append("g").attr("class", "y-axis-price").call(yAxisConfig);
    }

    if (isCombined) {
      g.append("g").attr("class", "y-axis-ratio").call(d3.axisLeft(ratioYScale).ticks(3));
    }

    // Add y-axis for standalone ratio/pullback charts
    if ((chartType === "ratio" || chartType === "pullback" || chartType === "ratio-pullback") && !isCombined) {
      g.append("g").attr("class", "y-axis-ratio").call(d3.axisLeft(priceYScale).ticks(4));
    }

    // Legend value functions
    const sendLegendValues = (selectedDate: string | null) => {
      if (!onLegendValuesChange || !selectedDate) return;
      const values: { [key: string]: number } = {};
      Object.entries(seriesData).forEach(([seriesName, data]) => {
        const dataPoint = data.find((dp: any) => dp.time === selectedDate);
        if (dataPoint) values[seriesName] = dataPoint.value;
      });
      onLegendValuesChange(values);
    };

    const sendLegendValuesWithLastRebalance = () => {
      if (rebalanceLogsMap) {
        const lastRebalanceDate = Object.keys(rebalanceLogsMap).pop() || null;
        sendLegendValues(lastRebalanceDate);
      }
    };

    sendLegendValuesWithLastRebalance();

    // Chart object for compatibility
    const chartLikeObject = {
      svg: svgRef.current,
      scales: { x: xScale, y: priceYScale },
      dimensions: { width, height: totalChartHeight, margin },
      setCrosshairPosition: (value: number, time: string) => {
        const date = parseTime(time);
        if (date) {
          const x = xScale(date);
          crosshair.style("display", null);
          crosshairLine.attr("x1", x).attr("x2", x);
          sendLegendValues(time);
        }
      },
      clearCrosshairPosition: () => {
        crosshair.style("display", "none");
        sendLegendValuesWithLastRebalance();
      },
      timeScale: () => ({
        subscribeVisibleLogicalRangeChange: () => {},
        unsubscribeVisibleLogicalRangeChange: () => {},
      }),
      subscribeCrosshairMove: () => {},
      unsubscribeCrosshairMove: () => {},
    };

    return { chart: chartLikeObject, mainSeries };
  }, [
    isLogScale,
    onPointClick,
    chartData,
    multiSeriesData,
    rebalanceLogsMap,
    onCrosshairMove,
    onCrosshairLeave,
    chartType,
    onLegendValuesChange,
  ]);

  // Handle selectedDate changes
  useEffect(() => {
    if (selectedDate && chartInstanceRef.current) {
      chartInstanceRef.current.chart.setCrosshairPosition(0, selectedDate);
    } else if (!selectedDate && chartInstanceRef.current) {
      chartInstanceRef.current.chart.clearCrosshairPosition();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const hasData = (chartData && chartData.length > 0) || (multiSeriesData && Object.keys(multiSeriesData).length > 0);

    if (!hasData) return;

    const chartInstance = createD3Chart();
    chartInstanceRef.current = chartInstance;

    if (onChartReady && syncId && chartInstance) {
      onChartReady(syncId, chartInstance.chart, chartInstance.mainSeries);
    }

    if (selectedDate && chartInstance) {
      chartInstance.chart.setCrosshairPosition(0, selectedDate);
    }

    const handleResize = () => {
      const newInstance = createD3Chart();
      chartInstanceRef.current = newInstance;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [
    chartData,
    multiSeriesData,
    isLogScale,
    syncId,
    onChartReady,
    rebalanceLogsMap,
    createD3Chart,
    chartType,
    selectedDate,
    onLegendValuesChange,
  ]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: height,
        backgroundColor: "white",
      }}
      onMouseLeave={() => {
        if (onCrosshairLeave) onCrosshairLeave();
        if (chartInstanceRef.current) {
          chartInstanceRef.current.chart.clearCrosshairPosition();
        }
      }}
    >
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }} />
    </div>
  );
};

export default Chart;
