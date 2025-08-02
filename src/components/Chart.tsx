import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ChartData, MultiSeriesChartData, RebalanceLog } from "../core/models";

interface ChartProps {
  chartData?: ChartData;
  multiSeriesData?: MultiSeriesChartData;
  onPointClick?: (date: string, value: number) => void;
  useLogScale?: boolean;
  syncId?: string;
  onChartReady?: (chartId: string, chart: any, mainSeries: any) => void;
  rebalanceLogs?: RebalanceLog[];
  selectedDate: string | null;
  onCrosshairMove?: (date: string | null) => void;
  onCrosshairLeave?: () => void;
  chartType?: "price" | "ratio" | "pullback";
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
  onCrosshairMove,
  onCrosshairLeave,
  chartType = "price",
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Legend data configuration
  const getLegendData = useCallback((chartType: string, seriesData: { [key: string]: any[] }) => {
    const legendItems: Array<{
      label: string;
      color: string;
      type: "line" | "circle";
      dashed?: boolean;
    }> = [];

    if (chartType === "price") {
      if (seriesData.Sig9Total) {
        legendItems.push({ label: "Sig9 Total", color: "#FBBC04", type: "line" });
      }
      if (seriesData.Sig9Target) {
        legendItems.push({ label: "Sig9 Target", color: "#202124", type: "line", dashed: true });
      }
      if (seriesData.MockTotalQQQ) {
        legendItems.push({ label: "Mock Total QQQ", color: "#4285F4", type: "line" });
      }
      if (seriesData.MockTotalTQQQ) {
        legendItems.push({ label: "Mock Total TQQQ", color: "#EA4335", type: "line" });
      }
    } else if (chartType === "ratio") {
      if (seriesData.Ratio) {
        legendItems.push({ label: "TQQQ Ratio", color: "#FBBC04", type: "line" });
      }
    } else if (chartType === "pullback") {
      if (seriesData.pullback) {
        legendItems.push({ label: "Portfolio Pullback", color: "#EA4335", type: "line" });
      }
    }
    return legendItems;
  }, []);

  const createD3Chart = useCallback(() => {
    if (!chartContainerRef.current || !svgRef.current) return null;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);

    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 60, right: 40, bottom: 40, left: 60 }; // Increased top margin for legend
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

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

    const yScale = useLogScale
      ? d3.scaleLog().domain(valueExtent).range([height, 0])
      : d3.scaleLinear().domain(yDomain).range([height, 0]);

    // Create line generator
    const line = d3
      .line<any>()
      .x((d) => xScale(d.parsedTime))
      .y((d) => yScale(d.value))
      .curve(d3.curveLinear);

    // Create area generator for ratio chart
    const area = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(height)
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear);

    // Create area generator for pullback chart (area from top)
    const pullbackArea = d3
      .area<any>()
      .x((d) => xScale(d.parsedTime))
      .y0(0) // Start from top of chart
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear);

    // Add grid lines
    const xAxis = d3.axisBottom(xScale).tickSize(-height);

    // Configure y-axis grid with same tick settings as the actual axis
    const yAxis = useLogScale
      ? d3.axisLeft(yScale).tickSize(-width).ticks(5, "~g")
      : d3.axisLeft(yScale).tickSize(-width);

    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("line")
      .attr("stroke", "#e1e1e1")
      .attr("stroke-width", 1);

    // Remove grid text labels to avoid duplication with axis labels
    g.selectAll(".grid text").remove();

    g.append("g").attr("class", "grid").call(yAxis).selectAll("line").attr("stroke", "#e1e1e1").attr("stroke-width", 1);

    // Remove grid text labels for y-axis too
    g.selectAll(".grid text").remove();

    // Color mapping
    const colors = {
      Sig9Target: "#202124",
      Sig9Total: "#FBBC04",
      MockTotalQQQ: "#4285F4",
      MockTotalTQQQ: "#EA4335",
      Ratio: "#FBBC04",
      pullback: "#EA4335",
      default: "#2962FF",
    };

    // Draw lines/areas for each series
    let mainSeries: any = null;
    Object.entries(seriesData).forEach(([seriesName, data], index) => {
      const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;
      const isDashed = seriesName === "Sig9Target";
      const isRatioChart = chartType === "ratio";
      const isPullbackChart = chartType === "pullback";

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
      .attr("y2", height)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Function to format value based on chart type
    const formatValue = (value: number, chartType: string, useLogScale: boolean) => {
      if (typeof value !== "number") return String(value);

      if (chartType === "ratio") {
        return (value * 100).toFixed(2) + "%";
      } else if (chartType === "pullback") {
        return (value * 100).toFixed(2) + "%";
      }

      return value.toFixed(2);
    };

    // Function to update legend with selected date values
    const updateLegendWithValues = (selectedDate: string | null) => {
      const legend = svg.select(".legend");
      if (legend.empty()) return;

      legend.selectAll(".legend-item").each(function (d: any, i: number) {
        const item = d3.select(this);
        const label = d.label;

        // Map legend labels to data series keys
        let seriesKey = label;
        if (chartType === "price") {
          // Direct mapping for price chart
          if (label === "Sig9 Total") seriesKey = "Sig9Total";
          else if (label === "Sig9 Target") seriesKey = "Sig9Target";
          else if (label === "Mock Total QQQ") seriesKey = "MockTotalQQQ";
          else if (label === "Mock Total TQQQ") seriesKey = "MockTotalTQQQ";
        } else if (chartType === "ratio") {
          if (label === "TQQQ Ratio") seriesKey = "Ratio";
        } else if (chartType === "pullback") {
          if (label === "Portfolio Pullback") seriesKey = "pullback";
        }

        // Remove existing value text
        item.select(".value-text").remove();

        if (selectedDate) {
          // Find the data point for this series and date
          const data = seriesData[seriesKey];
          if (data) {
            const dataPoint = data.find((dp: any) => dp.time === selectedDate);
            if (dataPoint) {
              const formattedValue = formatValue(dataPoint.value, chartType, useLogScale);

              // Add value text to the legend item
              item
                .append("text")
                .attr("class", "value-text")
                .attr("x", 20)
                .attr("y", 25)
                .attr("dy", "0.35em")
                .style("font-size", "11px")
                .style("font-family", "Arial, sans-serif")
                .style("fill", d.color)
                .style("font-weight", "bold")
                .text(formattedValue);
            }
          }
        }
      });

      // Update date display in legend
      const dateDisplay = legend.select(".legend-date .date-text");
      if (!dateDisplay.empty()) {
        if (selectedDate) {
          dateDisplay.text(selectedDate);
        } else {
          dateDisplay.text("");
        }
      }
    };

    // Add invisible overlay for mouse events
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    // Mouse event handlers
    overlay
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event);
        const date = xScale.invert(mouseX);

        crosshair.style("display", null);

        // Snap to closest rebalance date if rebalanceLogs exist
        if (rebalanceLogs && rebalanceLogs.length > 0) {
          const rebalanceDates = rebalanceLogs.map((log) => parseTime(log.date)).filter((d) => d !== null) as Date[];

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
        } else {
          // Fallback to mouse position if no rebalance logs
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
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickFormat((domainValue) => {
          return d3.timeFormat("%Y-%m-%d")(domainValue as Date);
        })
      );

    // Configure y-axis with custom formatting for log scale
    const yAxisConfig = useLogScale
      ? d3.axisLeft(yScale).ticks(5, "~g") // Use D3's log scale tick generation with clean formatting
      : d3.axisLeft(yScale);

    g.append("g").attr("class", "y-axis").call(yAxisConfig);

    // Add legend
    const legendData = getLegendData(chartType, seriesData);
    if (legendData.length > 0) {
      const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${margin.left}, 10)`);

      const legendItemWidth = 140;
      const legendItems = legend
        .selectAll(".legend-item")
        .data(legendData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * legendItemWidth}, 0)`);

      // Add legend symbols
      legendItems.each(function (d: any) {
        const item = d3.select(this);

        if (d.type === "line") {
          // Line legend
          item
            .append("line")
            .attr("x1", 0)
            .attr("y1", 8)
            .attr("x2", 16)
            .attr("y2", 8)
            .attr("stroke", d.color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", d.dashed ? "3,3" : "none");
        } else {
          // Circle legend
          item.append("circle").attr("cx", 8).attr("cy", 8).attr("r", 4).attr("fill", d.color);
        }

        // Add legend text
        item
          .append("text")
          .attr("x", 20)
          .attr("y", 8)
          .attr("dy", "0.35em")
          .style("font-size", "12px")
          .style("font-family", "Arial, sans-serif")
          .text(d.label);
      });

      // Add date display to legend (positioned at the end of the chart)
      const dateDisplay = legend.append("g").attr("class", "legend-date").attr("transform", `translate(${width}, 0)`);

      // Add "Date" label (aligned with other legend labels)
      dateDisplay
        .append("text")
        .attr("class", "date-label")
        .attr("x", 0)
        .attr("y", 8)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .style("font-family", "Arial, sans-serif")
        .style("font-weight", "normal")
        .style("fill", "black")
        .text("Rebalance date");

      // Add date value (below the label)
      dateDisplay
        .append("text")
        .attr("class", "date-text")
        .attr("x", 0)
        .attr("y", 25)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("font-family", "Arial, sans-serif")
        .style("font-weight", "bold")
        .style("fill", "black")
        .text("");
    }

    const updateLegendWithValuesWithLastRebalance = () => {
      if (rebalanceLogs) {
        const lastRebalanceDate = rebalanceLogs[rebalanceLogs.length - 1].date;
        updateLegendWithValues(lastRebalanceDate);
      } else {
        updateLegendWithValues(null);
      }
    };

    updateLegendWithValuesWithLastRebalance();

    // Create chart-like object for compatibility
    const chartLikeObject = {
      svg: svgRef.current,
      scales: { x: xScale, y: yScale },
      dimensions: { width, height, margin },
      setCrosshairPosition: (value: number, time: string) => {
        const date = parseTime(time);
        if (date) {
          const x = xScale(date);
          crosshair.style("display", null);
          crosshairLine.attr("x1", x).attr("x2", x);
          // Update legend with selected date values
          updateLegendWithValues(time);
        }
      },
      clearCrosshairPosition: () => {
        crosshair.style("display", "none");
        updateLegendWithValuesWithLastRebalance();
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
    useLogScale,
    onPointClick,
    chartData,
    multiSeriesData,
    rebalanceLogs,
    onCrosshairMove,
    onCrosshairLeave,
    chartType,
    getLegendData,
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

    // Handle resize
    const handleResize = () => {
      createD3Chart();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [chartData, multiSeriesData, useLogScale, syncId, onChartReady, rebalanceLogs, createD3Chart, chartType]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "400px",
        backgroundColor: "white",
      }}
    >
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }} />
    </div>
  );
};

export default Chart;
