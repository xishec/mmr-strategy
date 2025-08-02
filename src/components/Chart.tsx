import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);

  const createD3Chart = useCallback(() => {
    if (!chartContainerRef.current || !svgRef.current) return null;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

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
    allData.forEach(d => {
      if (typeof d.time === 'string') {
        d.parsedTime = parseTime(d.time);
      }
    });

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(allData, d => d.parsedTime) as [Date, Date])
      .range([0, width]);

    const valueExtent = d3.extent(allData, d => d.value) as [number, number];
    const yScale = useLogScale 
      ? d3.scaleLog().domain(valueExtent).range([height, 0])
      : d3.scaleLinear().domain(valueExtent).range([height, 0]);

    // Create line generator
    const line = d3.line<any>()
      .x(d => xScale(d.parsedTime))
      .y(d => yScale(d.value))
      .curve(d3.curveLinear);

    // Add grid lines
    const xAxis = d3.axisBottom(xScale).tickSize(-height);
    const yAxis = d3.axisLeft(yScale).tickSize(-width);

    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("line")
      .attr("stroke", "#e1e1e1")
      .attr("stroke-width", 1);

    g.append("g")
      .attr("class", "grid")
      .call(yAxis)
      .selectAll("line")
      .attr("stroke", "#e1e1e1")
      .attr("stroke-width", 1);

    // Color mapping
    const colors = {
      Sig9Target: "#E37400",
      Sig9Total: "#FBBC04",
      MockTotalQQQ: "#D2E3FC",
      MockTotalTQQQ: "#FAD2CF",
      Ratio: "#FBBC04",
      pullback: "#EA4335",
      default: "#2962FF"
    };

    // Draw lines for each series
    let mainSeries: any = null;
    Object.entries(seriesData).forEach(([seriesName, data], index) => {
      const seriesColor = colors[seriesName as keyof typeof colors] || colors.default;
      const isDashed = seriesName === "Sig9Target";

      // Prepare data with parsed time
      const processedData = data.map(d => ({
        ...d,
        parsedTime: parseTime(d.time)
      }));

      const path = g.append("path")
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
    });

    // Add rebalance markers
    if (rebalanceLogs && rebalanceLogs.length > 0) {
      rebalanceLogs.forEach(log => {
        const logDate = parseTime(log.date);
        if (!logDate) return;

        const x = xScale(logDate);
        const markerColors = {
          [RebalanceType.Rebalance]: "#E37400",
          [RebalanceType.Reset]: "#34A853",
          [RebalanceType.Skip]: "#EA4335"
        };

        g.append("circle")
          .attr("cx", x)
          .attr("cy", height / 2)
          .attr("r", 3)
          .attr("fill", markerColors[log.rebalanceType] || "#E37400")
          .attr("class", "rebalance-marker");
      });
    }

    // Add crosshair
    const crosshair = g.append("g")
      .attr("class", "crosshair")
      .style("display", "none");

    const crosshairLine = crosshair.append("line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Add invisible overlay for mouse events
    const overlay = g.append("rect")
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
        crosshairLine.attr("x1", mouseX).attr("x2", mouseX);

        // Find closest data point
        if (mainSeries && onPointClick) {
          const bisect = d3.bisector((d: any) => d.parsedTime).left;
          const i = bisect(mainSeries.data, date, 1);
          const d0 = mainSeries.data[i - 1];
          const d1 = mainSeries.data[i];
          
          if (d0 && d1) {
            const closestPoint = date.getTime() - d0.parsedTime.getTime() > 
              d1.parsedTime.getTime() - date.getTime() ? d1 : d0;
            // Update crosshair position to snap to closest point
            const snapX = xScale(closestPoint.parsedTime);
            crosshairLine.attr("x1", snapX).attr("x2", snapX);
          }
        }
      })
      .on("mouseout", () => {
        crosshair.style("display", "none");
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
            const closestPoint = date.getTime() - d0.parsedTime.getTime() > 
              d1.parsedTime.getTime() - date.getTime() ? d1 : d0;
            onPointClick(closestPoint.time, closestPoint.value);
          }
        }
      });

    // Add axes
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((domainValue) => {
        return d3.timeFormat("%Y-%m-%d")(domainValue as Date);
      }));

    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale));

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
        }
      },
      clearCrosshairPosition: () => {
        crosshair.style("display", "none");
      },
      timeScale: () => ({
        subscribeVisibleLogicalRangeChange: (callback: any) => {
          // Mock implementation for compatibility
        },
        unsubscribeVisibleLogicalRangeChange: () => {
          // Mock implementation for compatibility
        }
      }),
      subscribeCrosshairMove: (callback: any) => {
        // Mock implementation for compatibility
      },
      unsubscribeCrosshairMove: () => {
        // Mock implementation for compatibility
      }
    };

    return { chart: chartLikeObject, mainSeries };
  }, [useLogScale, onPointClick, chartData, multiSeriesData, rebalanceLogs]);

  // Effect to handle selectedDate changes
  useEffect(() => {
    if (selectedDate && chartInstanceRef.current) {
      chartInstanceRef.current.chart.setCrosshairPosition(0, selectedDate);
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
  }, [chartData, multiSeriesData, useLogScale, syncId, onChartReady, rebalanceLogs, createD3Chart]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "400px",
        border: "1px solid #e1e1e1",
        borderRadius: "4px",
        backgroundColor: "white",
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      />
    </div>
  );
};

export default Chart;
