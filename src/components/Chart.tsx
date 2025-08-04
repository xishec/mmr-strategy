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
  priceData?: MultiSeriesChartData;
  ratioData?: MultiSeriesChartData;
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
  priceData,
  ratioData,
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

    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 40, bottom: 40, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const containerHeight: number = container.clientHeight;
    const totalChartHeight = containerHeight - margin.top - margin.bottom;

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // For combined chart, split the height between price (top 75%) and ratio (bottom 25%)
    const isCombined = chartType === "combined";
    const priceHeight = isCombined ? totalChartHeight * 0.75 : totalChartHeight;
    const ratioHeight = isCombined ? totalChartHeight * 0.25 : 0;
    const ratioTop = isCombined ? priceHeight : 0;

    // Determine data to use
    let allData: any[] = [];
    let seriesData: { [key: string]: any[] } = {};
    let priceSeriesData: { [key: string]: any[] } = {};
    let ratioSeriesData: { [key: string]: any[] } = {};

    if (isCombined && priceData && ratioData) {
      // Combined chart with separate price and ratio data
      priceSeriesData = priceData;
      ratioSeriesData = ratioData;
      seriesData = { ...priceData, ...ratioData };
      allData = [...Object.values(priceData).flat(), ...Object.values(ratioData).flat()];
    } else if (multiSeriesData) {
      seriesData = multiSeriesData;
      allData = Object.values(multiSeriesData).flat();
    } else if (chartData) {
      seriesData = { default: chartData };
      allData = chartData;
    }

    if (allData.length === 0) return null;

    // Parse dates and values
    const parseTime = d3.timeParse("%Y-%m-%d");
    allData.forEach((d) => {
      if (typeof d.time === "string") {
        d.parsedTime = parseTime(d.time);
      }
    });

    // Create time scale (shared)
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(allData, (d) => d.parsedTime) as [Date, Date])
      .range([0, width]);

    // Create scales for price chart
    let priceYScale: any;
    if (isCombined || chartType === "price") {
      const priceAllData = isCombined ? Object.values(priceSeriesData).flat() : allData;
      const priceValueExtent = d3.extent(priceAllData, (d) => d.value) as [number, number];
      
      priceYScale = isLogScale
        ? d3.scaleLog().domain(priceValueExtent).range([priceHeight, 0])
        : d3.scaleLinear().domain(priceValueExtent).range([priceHeight, 0]);
    }

    // Create scales for ratio chart
    let ratioYScale: any;
    if (isCombined || chartType === "ratio" || chartType === "ratio-pullback") {
      const ratioDomain = chartType === "ratio-pullback" || isCombined ? [-1, 1] : [0, 1];
      ratioYScale = d3.scaleLinear()
        .domain(ratioDomain)
        .range([ratioTop + ratioHeight, ratioTop]);
    }

    // Create line generators
    const priceLine = d3
      .line<any>()
      .x((d) => xScale(d.parsedTime))
      .y((d) => priceYScale(d.value));

    const ratioLine = d3
      .line<any>()
      .x((d) => xScale(d.parsedTime))
      .y((d) => ratioYScale(d.value));

    // Create area generators
    const ratioArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(isCombined ? ratioYScale(0) : ratioTop + ratioHeight)
      .y1((d) => ratioYScale(d.value));

    const pullbackArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(ratioYScale(0))
      .y1((d) => ratioYScale(d.value));

    // Add center line at y=0 for ratio section
    if (isCombined || chartType === "ratio-pullback") {
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

    // Add separator line between price and ratio charts
    if (isCombined) {
      g.append("line")
        .attr("class", "separator-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", priceHeight)
        .attr("y2", priceHeight)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);
    }

    // Color mapping
    const colors = {
      StrategyTotal: yellow,
      Target: black,
      MockTotalQQQ: blue,
      MockTotalTQQQ: red,
      Ratio: blue,
      pullback: red,
      default: "#2962FF",
    };

    // Draw series
    let mainSeries: any = null;

    // Draw price series (top section)
    if (isCombined) {
      Object.entries(priceSeriesData).forEach(([seriesName, data], index) => {
        const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;
        const isDashed = seriesName === "Target";

        const processedData = data.map((d) => ({
          ...d,
          parsedTime: parseTime(d.time),
        }));

        if (seriesName === "Target") {
          // Draw points for Target series
          const pointsGroup = g.append("g").attr("class", `points series-${seriesName}`);

          pointsGroup
            .selectAll("circle")
            .data(processedData)
            .enter()
            .append("circle")
            .attr("cx", (d) => xScale(d.parsedTime))
            .attr("cy", (d) => priceYScale(d.value))
            .attr("r", 2)
            .attr("stroke", seriesColor)
            .attr("fill", seriesColor);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: pointsGroup };
          }
        } else {
          // Draw regular line
          const path = g
            .append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", isDashed ? "5,5" : "none")
            .attr("d", priceLine);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: path };
          }
        }
      });

      // Draw ratio series (bottom section)
      Object.entries(ratioSeriesData).forEach(([seriesName, data]) => {
        const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;

        const processedData = data.map((d) => ({
          ...d,
          parsedTime: parseTime(d.time),
        }));

        if (seriesName === "Ratio") {
          // Draw area for ratio
          g.append("path")
            .datum(processedData)
            .attr("class", `area series-${seriesName}`)
            .attr("fill", seriesColor)
            .attr("fill-opacity", 0.3)
            .attr("d", ratioArea);

          // Draw line on top of area
          g.append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("d", ratioLine);
        } else if (seriesName === "pullback") {
          // Draw area for pullback
          g.append("path")
            .datum(processedData)
            .attr("class", `area series-${seriesName}`)
            .attr("fill", seriesColor)
            .attr("fill-opacity", 0.3)
            .attr("d", pullbackArea);

          // Draw line on top of area
          g.append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("d", ratioLine);
        }
      });
    } else {
      // Original single chart logic
      const valueExtent = d3.extent(allData, (d) => d.value) as [number, number];

      // Set y-scale domain based on chart type
      let yDomain = valueExtent;
      if (chartType === "ratio") {
        yDomain = [0, 1];
      }
      if (chartType === "pullback") {
        yDomain = [-1, 0];
      }
      if (chartType === "ratio-pullback") {
        yDomain = [-1, 1];
      }

      const yScale = isLogScale
        ? d3.scaleLog().domain(valueExtent).range([totalChartHeight, 0])
        : d3.scaleLinear().domain(yDomain).range([totalChartHeight, 0]);

      const line = d3
        .line<any>()
        .x((d) => xScale(d.parsedTime))
        .y((d) => yScale(d.value));

      const area = d3
        .area<any>()
        .x((d) => xScale(d.parsedTime))
        .y0(totalChartHeight)
        .y1((d) => yScale(d.value));

      const combinedRatioArea = d3
        .area<any>()
        .x((d) => xScale(d.parsedTime))
        .y0(yScale(0))
        .y1((d) => yScale(d.value));

      // Draw series with original logic
      Object.entries(seriesData).forEach(([seriesName, data], index) => {
        const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;
        const isDashed = seriesName === "Target";
        const isRatioChart = chartType === "ratio";
        const isCombinedRatioChart = chartType === "ratio-pullback";

        const processedData = data.map((d) => ({
          ...d,
          parsedTime: parseTime(d.time),
        }));

        if (isRatioChart && seriesName === "Ratio") {
          g.append("path")
            .datum(processedData)
            .attr("class", `area series-${seriesName}`)
            .attr("fill", seriesColor)
            .attr("fill-opacity", 0.3)
            .attr("d", area);

          const linePath = g
            .append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("d", line);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: linePath };
          }
        } else if (isCombinedRatioChart && (seriesName === "Ratio" || seriesName === "pullback")) {
          g.append("path")
            .datum(processedData)
            .attr("class", `area series-${seriesName}`)
            .attr("fill", seriesColor)
            .attr("fill-opacity", 0.3)
            .attr("d", combinedRatioArea);

          const linePath = g
            .append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("d", line);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: linePath };
          }
        } else if (seriesName === "Target") {
          const pointsGroup = g.append("g").attr("class", `points series-${seriesName}`);

          pointsGroup
            .selectAll("circle")
            .data(processedData)
            .enter()
            .append("circle")
            .attr("cx", (d) => xScale(d.parsedTime))
            .attr("cy", (d) => yScale(d.value))
            .attr("r", 2)
            .attr("stroke", seriesColor)
            .attr("fill", seriesColor);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: pointsGroup };
          }
        } else {
          const path = g
            .append("path")
            .datum(processedData)
            .attr("class", `line series-${seriesName}`)
            .attr("fill", "none")
            .attr("stroke", seriesColor)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", isDashed ? "5,5" : "none")
            .attr("d", line);

          if (!mainSeries) {
            mainSeries = { data: processedData, element: path };
          }
        }
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

    // Add invisible overlay for mouse events
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", totalChartHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    // Helper function to get valid rebalance dates
    const getRebalanceDates = (): Date[] => {
      if (!rebalanceLogsMap) return [];
      return Object.keys(rebalanceLogsMap)
        .map(parseTime)
        .filter((d): d is Date => d !== null);
    };

    // Mouse event handlers
    overlay
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event);
        const date = xScale.invert(mouseX);

        crosshair.style("display", null);

        const rebalanceDates = getRebalanceDates();
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
      })
      .on("mouseout", () => {
        crosshair.style("display", "none");
        if (onCrosshairLeave) {
          onCrosshairLeave();
        }
      })
      .on("mouseleave", () => {
        crosshair.style("display", "none");
        if (onCrosshairLeave) {
          onCrosshairLeave();
        }
      })
      .on("click", (event) => {
        if (onPointClick && mainSeries) {
          const [mouseX] = d3.pointer(event);
          const date = xScale.invert(mouseX);

          const bisect = d3.bisector((d: any) => d.parsedTime).left;
          const i = bisect(mainSeries.data, date, 1);
          const d0 = mainSeries.data[i - 1];
          const d1 = mainSeries.data[i];

          if (d0 && d1) {
            const closestPoint =
              date.getTime() - d0.parsedTime.getTime() > d1.parsedTime.getTime() - date.getTime() ? d1 : d0;
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

    // Add price Y-axis (left side)
    if (isCombined || chartType === "price") {
      const yAxisConfig = isLogScale ? d3.axisLeft(priceYScale).ticks(4, "~g") : d3.axisLeft(priceYScale);
      g.append("g").attr("class", "y-axis-price").call(yAxisConfig);
    }

    // Add ratio Y-axis (right side for combined chart)
    if (isCombined) {
      g.append("g")
        .attr("class", "y-axis-ratio")
        .attr("transform", `translate(${width}, 0)`)
        .call(d3.axisRight(ratioYScale).ticks(3));
    } else if (chartType === "ratio" || chartType === "ratio-pullback") {
      const singleYScale = isLogScale 
        ? d3.scaleLog().domain(d3.extent(allData, (d) => d.value) as [number, number]).range([totalChartHeight, 0])
        : d3.scaleLinear().domain(chartType === "ratio-pullback" ? [-1, 1] : [0, 1]).range([totalChartHeight, 0]);
      g.append("g").attr("class", "y-axis").call(d3.axisLeft(singleYScale));
    }

    // Function to send legend values to parent component
    const sendLegendValues = (selectedDate: string | null) => {
      if (!onLegendValuesChange || !selectedDate) return;
      
      const values: { [key: string]: number } = {};
      Object.entries(seriesData).forEach(([seriesName, data]) => {
        const dataPoint = data.find((dp: any) => dp.time === selectedDate);
        if (dataPoint) {
          values[seriesName] = dataPoint.value;
        }
      });
      
      onLegendValuesChange(values);
    };

    const sendLegendValuesWithLastRebalance = () => {
      if (rebalanceLogsMap) {
        const lastRebalanceDate = Object.keys(rebalanceLogsMap).pop() || null;
        sendLegendValues(lastRebalanceDate);
      } else {
        sendLegendValues(null);
      }
    };

    sendLegendValuesWithLastRebalance();

    // Create chart-like object for compatibility
    const chartLikeObject = {
      svg: svgRef.current,
      scales: { x: xScale, y: isCombined ? priceYScale : (priceYScale || ratioYScale) },
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
        subscribeVisibleLogicalRangeChange: (callback: any) => {},
        unsubscribeVisibleLogicalRangeChange: () => {},
      }),
      subscribeCrosshairMove: (callback: any) => {},
      unsubscribeCrosshairMove: () => {},
    };

    return { chart: chartLikeObject, mainSeries };
  }, [
    isLogScale,
    onPointClick,
    chartData,
    multiSeriesData,
    priceData,
    ratioData,
    rebalanceLogsMap,
    onCrosshairMove,
    onCrosshairLeave,
    chartType,
    onLegendValuesChange,
  ]);

  // Effect to handle selectedDate changes
  useEffect(() => {
    if (selectedDate && chartInstanceRef.current) {
      chartInstanceRef.current.chart.setCrosshairPosition(0, selectedDate);
    } else if (!selectedDate && chartInstanceRef.current) {
      chartInstanceRef.current.chart.clearCrosshairPosition();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Determine if we have data to display
    const hasData = 
      (chartData && chartData.length > 0) || 
      (multiSeriesData && Object.keys(multiSeriesData).length > 0) ||
      (priceData && Object.keys(priceData).length > 0) ||
      (ratioData && Object.keys(ratioData).length > 0);

    if (!hasData) return;

    const chartInstance = createD3Chart();
    chartInstanceRef.current = chartInstance;

    // Notify parent component that chart is ready
    if (onChartReady && syncId && chartInstance) {
      onChartReady(syncId, chartInstance.chart, chartInstance.mainSeries);
    }

    // Sync crosshair position if selectedDate exists
    if (selectedDate && chartInstance) {
      chartInstance.chart.setCrosshairPosition(0, selectedDate);
    }

    // Handle resize
    const handleResize = () => {
      createD3Chart();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [
    chartData,
    multiSeriesData,
    priceData,
    ratioData,
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
        if (onCrosshairLeave) {
          onCrosshairLeave();
        }
        // Also hide crosshair on this chart instance
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
