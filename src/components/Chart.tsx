import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ChartData, MultiSeriesChartData, RebalanceLog, RebalanceType } from "../core/models";

const black = "#202124";
const yellow = "#FBBC04";
const blue = "#4285F4";
const red = "#EA4335";
const green = "#34A853";

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
  isLogScale?: boolean;
  height: string | number;
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
  isLogScale = false,
  height,
  onLegendValuesChange,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  const createD3Chart = useCallback(() => {
    if (!chartContainerRef.current || !svgRef.current) return null;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Setup dimensions and data
    const margin = { top: 30, left: 65, right: 20 };
    const width = container.clientWidth - margin.left - margin.right;
    const totalChartHeight = container.clientHeight;
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

    // Chart layout - always combined view with 3 sections
    const spaceBetweenCharts = 20; // Smart spacing between sections
    const totalSpacing = spaceBetweenCharts * 2; // Two gaps: price-ratio and ratio-timeline
    const rebalanceTimelineHeight = 40; // Height for rebalance timeline

    const availableHeight = totalChartHeight - totalSpacing - rebalanceTimelineHeight;
    const priceHeight = availableHeight * 0.65;
    const ratioHeight = availableHeight * 0.25;
    const ratioTop = priceHeight + spaceBetweenCharts;
    const timelineTop = ratioTop + ratioHeight + spaceBetweenCharts;

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

    const priceSeriesData = getSeriesByType("price");
    const ratioSeriesData = getSeriesByType("ratio");

    // Create time scale
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.parsedTime) as [Date, Date])
      .range([0, width]);

    // Create Y scales
    const priceData = Object.values(priceSeriesData).flat();
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
          .attr("r", 2.5)
          .attr("fill", black);
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
          .attr("d", line);
      }

      return { data: processedData, name: seriesName };
    };

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

    // Render all series
    let mainSeries: any = null;

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

    // Render rebalance timeline
    if (rebalanceLogsMap) {
      const rebalanceDates = Object.keys(rebalanceLogsMap);
      const timelineY = timelineTop + rebalanceTimelineHeight / 2;

      // Add timeline base line
      g.append("line")
        .attr("class", "timeline-base")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", timelineY)
        .attr("y2", timelineY)
        .attr("stroke", "#666")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

      // Add rebalance markers
      rebalanceDates.forEach((dateStr) => {
        const date = parseTime(dateStr);
        if (date) {
          const x = xScale(date);
          const rebalanceLog = rebalanceLogsMap[dateStr];

          const strokeColor =
            rebalanceLog?.rebalanceType === RebalanceType.BigDrop
              ? red
              : rebalanceLog?.rebalanceType === RebalanceType.Drop
              ? red
              : rebalanceLog?.rebalanceType === RebalanceType.Spike
              ? green
              : rebalanceLog?.rebalanceType === RebalanceType.Excess
              ? yellow
              : rebalanceLog?.rebalanceType === RebalanceType.Shortfall
              ? yellow
              : black;

          const fillColor =
            rebalanceLog?.rebalanceType === RebalanceType.BigDrop
              ? red
              : rebalanceLog?.rebalanceType === RebalanceType.Drop
              ? red
              : rebalanceLog?.rebalanceType === RebalanceType.Spike
              ? green
              : rebalanceLog?.rebalanceType === RebalanceType.Excess
              ? yellow
              : rebalanceLog?.rebalanceType === RebalanceType.Shortfall
              ? yellow
              : black;

          const markerY =
            rebalanceLog?.rebalanceType === RebalanceType.BigDrop
              ? timelineY + 16
              : rebalanceLog?.rebalanceType === RebalanceType.Drop
              ? timelineY + 8
              : rebalanceLog?.rebalanceType === RebalanceType.Spike
              ? timelineY - 8
              : rebalanceLog?.rebalanceType === RebalanceType.Excess
              ? timelineY
              : rebalanceLog?.rebalanceType === RebalanceType.Shortfall
              ? timelineY
              : black;

          g.append("circle")
            .attr("class", "rebalance-marker")
            .attr("cx", x)
            .attr("cy", markerY)
            .attr("r", 2.5)
            .attr("fill", fillColor)
            .attr("stroke", strokeColor);
        }
      });
    }

    // Add crosshair
    const crosshair = g.append("g").attr("class", "crosshair").style("display", "none");
    const crosshairHeight = timelineTop + rebalanceTimelineHeight;
    const crosshairLine = crosshair
      .append("line")
      .attr("y1", 0)
      .attr("y2", crosshairHeight)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Add overlay for mouse events
    const overlayHeight = timelineTop + rebalanceTimelineHeight;
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", overlayHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    // Pre-compute rebalance dates for performance
    const precomputedRebalanceDates = rebalanceLogsMap
      ? Object.keys(rebalanceLogsMap)
          .map(parseTime)
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime())
      : [];

    // Memoize date formatter to avoid recreating on every mousemove
    const dateFormatter = d3.timeFormat("%Y-%m-%d");

    // Throttling variables
    let lastMouseMoveTime = 0;
    const throttleDelay = 16; // ~60fps

    // Mouse event handlers with optimizations
    overlay
      .on("mousemove", (event: any) => {
        const now = Date.now();
        if (now - lastMouseMoveTime < throttleDelay) return;
        lastMouseMoveTime = now;

        // Cancel previous animation frame if pending
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          // Get pointer relative to the SVG element, then adjust for margin
          const [mouseX] = d3.pointer(event, svg.node());
          const adjustedMouseX = mouseX - margin.left;
          const date = xScale.invert(adjustedMouseX);
          crosshair.style("display", null);

          let finalX = adjustedMouseX;
          let finalDate = date;

          if (precomputedRebalanceDates.length > 0) {
            // Use binary search for better performance
            const targetTime = date.getTime();
            let left = 0;
            let right = precomputedRebalanceDates.length - 1;
            let closestIndex = 0;
            let minDistance = Infinity;

            while (left <= right) {
              const mid = Math.floor((left + right) / 2);
              const distance = Math.abs(precomputedRebalanceDates[mid].getTime() - targetTime);

              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = mid;
              }

              if (precomputedRebalanceDates[mid].getTime() < targetTime) {
                left = mid + 1;
              } else {
                right = mid - 1;
              }
            }

            // Check adjacent dates for the closest match
            if (closestIndex > 0) {
              const prevDistance = Math.abs(precomputedRebalanceDates[closestIndex - 1].getTime() - targetTime);
              if (prevDistance < minDistance) {
                closestIndex = closestIndex - 1;
              }
            }
            if (closestIndex < precomputedRebalanceDates.length - 1) {
              const nextDistance = Math.abs(precomputedRebalanceDates[closestIndex + 1].getTime() - targetTime);
              if (nextDistance < minDistance) {
                closestIndex = closestIndex + 1;
              }
            }

            const closestRebalanceDate = precomputedRebalanceDates[closestIndex];
            finalX = xScale(closestRebalanceDate);
            finalDate = closestRebalanceDate;
          }

          // Batch DOM updates
          crosshairLine.attr("x1", finalX).attr("x2", finalX);

          if (onCrosshairMove) {
            onCrosshairMove(dateFormatter(finalDate));
          }

          animationFrameRef.current = null;
        });
      })
      .on("mouseout", () => {
        // Cancel any pending animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        crosshair.style("display", "none");
        if (onCrosshairLeave) onCrosshairLeave();
      })
      .on("click", (event: any) => {
        if (onPointClick && mainSeries) {
          // Get pointer relative to the SVG element, then adjust for margin
          const [mouseX] = d3.pointer(event, svg.node());
          const adjustedMouseX = mouseX - margin.left;
          const date = xScale.invert(adjustedMouseX);
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
      .attr("transform", `translate(0,${timelineTop - 25})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((domainValue) => {
            return d3.timeFormat("%Y-%m-%d")(domainValue as Date);
          })
      );

    // Add Y-axes
    const yAxisConfig = isLogScale ? d3.axisLeft(priceYScale).ticks(4, "~g") : d3.axisLeft(priceYScale);
    g.append("g").attr("class", "y-axis-price").call(yAxisConfig);

    g.append("g").attr("class", "y-axis-ratio").call(d3.axisLeft(ratioYScale).ticks(3));

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
      // Cancel any pending animation frame before creating new chart
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      const newInstance = createD3Chart();
      chartInstanceRef.current = newInstance;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      // Cleanup animation frame and event listener
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [
    chartData,
    multiSeriesData,
    isLogScale,
    syncId,
    onChartReady,
    rebalanceLogsMap,
    createD3Chart,
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
        // Cancel any pending animation frame when mouse leaves the chart
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
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
