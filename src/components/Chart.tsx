import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ChartData, MultiSeriesChartData, RebalanceLog, RebalanceType } from "../core/models";

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
  chartType?: "price" | "ratio" | "pullback" | "ratio-pullback";
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

    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 40, bottom: 40, left: 60 }; // Reduced top margin since no legend
    const width = container.clientWidth - margin.left - margin.right;
    const containerHeight: number = container.clientHeight;
    const chartHeight = containerHeight - margin.top - margin.bottom;

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Determine data to use
    let allData: any[] = [];
    let seriesData: { [key: string]: any[] } = {};

    if (multiSeriesData) {
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

    // Create scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(allData, (d) => d.parsedTime) as [Date, Date])
      .range([0, width]);

    const valueExtent = d3.extent(allData, (d) => d.value) as [number, number];

    // Set y-scale domain based on chart type
    let yDomain = valueExtent;
    if (chartType === "ratio") {
      yDomain = [0, 1]; // Fixed domain for ratio chart
    }
    if (chartType === "pullback") {
      yDomain = [-1, 0]; // Fixed domain for pullback chart
    }
    if (chartType === "ratio-pullback") {
      yDomain = [-1, 1]; // Combined domain from -1 to 1 with 0 in center
    }

    const yScale = isLogScale
      ? d3.scaleLog().domain(valueExtent).range([chartHeight, 0])
      : d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

    // Create line generator
    const line = d3
      .line<any>()
      .x((d) => xScale(d.parsedTime))
      .y((d) => yScale(d.value));

    // Create area generator for ratio chart
    const area = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(chartHeight)
      .y1((d) => yScale(d.value));

    // Create area generator for pullback chart (area from top)
    const pullbackArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(0) // Start from top of chart
      .y1((d) => yScale(d.value));

    // Create area generators for combined chart
    const combinedRatioArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(yScale(0)) // Start from center (y=0)
      .y1((d) => yScale(d.value));

    const combinedPullbackArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(yScale(0)) // Start from center (y=0)
      .y1((d) => yScale(d.value));

    // Add center line at y=0 for combined chart
    if (chartType === "ratio-pullback") {
      g.append("line")
        .attr("class", "center-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", "#666")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");
    }
    // Color mapping
    const colors = {
      StrategyTotal: yellow,
      Target: black,
      MockTotalQQQ: blue,
      MockTotalTQQQ: red,
      Ratio: chartType === "ratio-pullback" ? blue : yellow,
      pullback: red,
      default: "#2962FF",
    };
    // Draw lines/areas for each series
    let mainSeries: any = null;
    Object.entries(seriesData).forEach(([seriesName, data], index) => {
      const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;
      const isDashed = seriesName === "Target";
      const isRatioChart = chartType === "ratio";
      const isPullbackChart = chartType === "pullback";
      const isCombinedChart = chartType === "ratio-pullback";

      // Prepare data with parsed time
      const processedData = data.map((d) => ({
        ...d,
        parsedTime: parseTime(d.time),
      }));

      if (isRatioChart && seriesName === "Ratio") {
        // Draw area for ratio chart (area below line)
        g.append("path")
          .datum(processedData)
          .attr("class", `area series-${seriesName}`)
          .attr("fill", seriesColor)
          .attr("fill-opacity", 0.3)
          .attr("d", area);

        // Draw line on top of area
        const linePath = g
          .append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", seriesColor)
          .attr("stroke-width", 2)
          .attr("d", line);

        if (!mainSeries || index === 0) {
          mainSeries = { data: processedData, element: linePath };
        }
      } else if (isPullbackChart && seriesName === "pullback") {
        // Draw line first for pullback chart
        const linePath = g
          .append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", seriesColor)
          .attr("stroke-width", 2)
          .attr("d", line);

        // Draw area from top for pullback chart
        g.append("path")
          .datum(processedData)
          .attr("class", `area series-${seriesName}`)
          .attr("fill", seriesColor)
          .attr("fill-opacity", 0.3)
          .attr("d", pullbackArea);

        if (!mainSeries || index === 0) {
          mainSeries = { data: processedData, element: linePath };
        }
      } else if (isCombinedChart && (seriesName === "Ratio" || seriesName === "pullback")) {
        // Draw area for combined chart (centeblueq at y=0)
        const areaGenerator = seriesName === "Ratio" ? combinedRatioArea : combinedPullbackArea;

        g.append("path")
          .datum(processedData)
          .attr("class", `area series-${seriesName}`)
          .attr("fill", seriesColor)
          .attr("fill-opacity", 0.3)
          .attr("d", areaGenerator);

        // Draw line on top of area
        const linePath = g
          .append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", seriesColor)
          .attr("stroke-width", 2)
          .attr("d", line);

        if (!mainSeries || index === 0) {
          mainSeries = { data: processedData, element: linePath };
        }
      } else if (seriesName === "Target") {
        // Draw points for Target series
        const pointsGroup = g.append("g").attr("class", `points series-${seriesName}`);

        pointsGroup
          .selectAll("circle")
          .data(processedData)
          .enter()
          .append("circle")
          .attr("cx", (d) => xScale(d.parsedTime))
          .attr("cy", (d) => yScale(d.value))
          .attr("r", (d) => {
            let size = 2;
            const dateKey = d3.timeFormat("%Y-%m-%d")(d.parsedTime);
            const rebalanceType = rebalanceLogsMap![dateKey]?.rebalanceType;
            if (rebalanceType === RebalanceType.Excess) {
              size = 2;
            } else if (rebalanceType === RebalanceType.Shortfall) {
              size = 2;
            } else if (rebalanceType === RebalanceType.Drop) {
            } else if (rebalanceType === RebalanceType.Spike) {
              size = 2;
            } else if (rebalanceType === RebalanceType.StillDropping) {
            }
            return size;
          })
          .attr("stroke", (d) => {
            let rebalanceSeriesColor = "none";
            const dateKey = d3.timeFormat("%Y-%m-%d")(d.parsedTime);
            const rebalanceType = rebalanceLogsMap![dateKey]?.rebalanceType;
            if (rebalanceType === RebalanceType.Excess) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.Shortfall) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.Drop) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.Spike) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.StillDropping) {
              rebalanceSeriesColor = seriesColor;
            }
            return rebalanceSeriesColor;
          })
          .attr("fill", (d) => {
            let rebalanceSeriesColor = "none";
            const dateKey = d3.timeFormat("%Y-%m-%d")(d.parsedTime);
            const rebalanceType = rebalanceLogsMap![dateKey]?.rebalanceType;
            if (rebalanceType === RebalanceType.Excess) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.Shortfall) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.Drop) {
            } else if (rebalanceType === RebalanceType.Spike) {
              rebalanceSeriesColor = seriesColor;
            } else if (rebalanceType === RebalanceType.StillDropping) {
            }
            return rebalanceSeriesColor;
          });

        if (!mainSeries || index === 0) {
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
          .attr("d", line);

        if (!mainSeries || index === 0) {
          mainSeries = { data: processedData, element: path };
        }
      }
    });

    // Add crosshair
    const crosshair = g.append("g").attr("class", "crosshair").style("display", "none");

    const crosshairLine = crosshair
      .append("line")
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Add invisible overlay for mouse events
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", chartHeight)
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

        // Snap to closest rebalance date if available
        const rebalanceDates = getRebalanceDates();
        if (rebalanceDates.length > 0) {
          // Find closest rebalance date
          const closestRebalanceDate = rebalanceDates.reduce((closest, current) => {
            return Math.abs(current.getTime() - date.getTime()) < Math.abs(closest.getTime() - date.getTime())
              ? current
              : closest;
          });

          // Snap crosshair to closest rebalance date
          const snapX = xScale(closestRebalanceDate);
          crosshairLine.attr("x1", snapX).attr("x2", snapX);

          // Notify parent for synchronization
          if (onCrosshairMove) {
            onCrosshairMove(d3.timeFormat("%Y-%m-%d")(closestRebalanceDate));
          }
        } else {
          // Fallback to mouse position if no rebalance dates
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
      .attr("transform", `translate(0,${chartHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((domainValue) => {
            return d3.timeFormat("%Y-%m-%d")(domainValue as Date);
          })
      );

    // Configure y-axis with custom formatting for log scale
    const yAxisConfig = isLogScale ? d3.axisLeft(yScale).ticks(4, "~g") : d3.axisLeft(yScale);

    g.append("g").attr("class", "y-axis").call(yAxisConfig);

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
      scales: { x: xScale, y: yScale },
      dimensions: { width, height: chartHeight, margin },
      setCrosshairPosition: (value: number, time: string) => {
        const date = parseTime(time);
        if (date) {
          const x = xScale(date);
          crosshair.style("display", null);
          crosshairLine.attr("x1", x).attr("x2", x);
          // Send legend values to parent component
          sendLegendValues(time);
        }
      },
      clearCrosshairPosition: () => {
        crosshair.style("display", "none");
        sendLegendValuesWithLastRebalance();
      },
      timeScale: () => ({
        subscribeVisibleLogicalRangeChange: (callback: any) => {
          // Mock implementation for compatibility
        },
        unsubscribeVisibleLogicalRangeChange: () => {
          // Mock implementation for compatibility
        },
      }),
      subscribeCrosshairMove: (callback: any) => {
        // Mock implementation for compatibility
      },
      unsubscribeCrosshairMove: () => {
        // Mock implementation for compatibility
      },
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
    const hasData = (chartData && chartData.length > 0) || (multiSeriesData && Object.keys(multiSeriesData).length > 0);

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
