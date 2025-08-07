import React, { useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { getRebalanceTypeColor } from "../core/functions";
import { D3ChartData } from "../core/models";
import { CHART_LAYOUT } from "../core/constants";

export const black = "#202124";
export const yellow = "#FBBC04";
export const lightYellow = "#ffe599ff";
export const blue = "#4285F4";
export const red = "#EA4335";
export const green = "#34A853";
export const grey = "#848484ff";

interface ChartProps {
  d3ChartData: D3ChartData;
  selectedDate: string | null;
  isLogScale?: boolean;
  height: string | number;
  onDateChange?: (date: string) => void;
}

const Chart: React.FC<ChartProps> = ({
  d3ChartData,
  selectedDate,
  isLogScale = false,
  height,
  onDateChange,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Memoize expensive data processing to prevent unnecessary re-computations
  const chartDataMemo = useMemo(() => {
    if (!d3ChartData) return { rebalanceLogsMap: {} };

    // Combine all chart data into a single object for easier processing
    return {
      ...d3ChartData.priceChart,
      ...d3ChartData.ratioChart,
      ...d3ChartData.pullbackChart,
      rebalanceLogsMap: d3ChartData.rebalanceLogsMap,
    };
  }, [d3ChartData]);

  const createD3Chart = useCallback(() => {
    if (!chartContainerRef.current || !svgRef.current) return null;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);

    // Clean up any existing D3 selections and event listeners
    svg.selectAll("*").remove();
    svg.on(".zoom", null);
    svg.on(".drag", null);

    // Setup dimensions and data
    const margin = { top: 5, left: 35, right: 5, bottom: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const totalChartHeight = container.clientHeight - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data
    const seriesData = chartDataMemo;
    const allData: any[] = [];

    // Collect all data points from all series
    Object.values(seriesData).forEach((data) => {
      if (Array.isArray(data)) {
        allData.push(...data);
      }
    });

    if (allData.length === 0) return null;

    // Parse dates
    const parseTime = d3.timeParse("%Y-%m-%d");
    const parsedData = allData.map((d: any) => ({
      ...d,
      parsedTime: parseTime(d.time),
    }));

    // Chart layout - combined view with 2 sections (price and ratio)
    const spaceBetweenCharts = CHART_LAYOUT.SPACE_BETWEEN_CHARTS; // Smart spacing between sections
    const availableHeight = totalChartHeight - spaceBetweenCharts;
    const priceHeight = availableHeight * CHART_LAYOUT.PRICE_HEIGHT_RATIO;
    const ratioHeight = availableHeight * CHART_LAYOUT.RATIO_HEIGHT_RATIO;
    const priceTop = 0;
    const ratioTop = priceTop + priceHeight + spaceBetweenCharts;

    // Separate series by type
    const priceKeys = [
      "strategyTotal",
      "strategyTotalAll",
      "target",
      "mockTotalQQQ",
      "mockTotalTQQQ",
      "mockTotalNothing",
    ];
    const ratioKeys = ["ratio", "pullback"];

    const getSeriesByType = (type: "price" | "ratio") => {
      const keys = type === "price" ? priceKeys : ratioKeys;
      const result: { [key: string]: any[] } = {};
      Object.entries(seriesData).forEach(([key, data]) => {
        if (keys.includes(key) && Array.isArray(data)) {
          result[key] = data;
        }
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
      ? d3
          .scaleLog()
          .domain(priceExtent)
          .range([priceTop + priceHeight, priceTop])
      : d3
          .scaleLinear()
          .domain(priceExtent)
          .range([priceTop + priceHeight, priceTop]);

    const ratioYScale = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([ratioTop + ratioHeight, ratioTop]);

    // Color mapping
    const colorMap = {
      strategyTotal: yellow,
      strategyTotalAll: lightYellow,
      target: black,
      mockTotalQQQ: green,
      mockTotalTQQQ: red,
      mockTotalNothing: "#ecececff",
      ratio: "#d0d0d0ff",
      pullback: red,
      default: "#2962FF",
    };

    // Helper function to render a series
    const renderSeries = (seriesName: string, data: any[], yScale: any, isArea = false, isStepLine = false) => {
      const color = colorMap[seriesName as keyof typeof colorMap] || colorMap.default;
      const processedData = data.map((d) => ({ ...d, parsedTime: parseTime(d.time) }));

      // Filter data to only include rebalance dates for points
      const rebalanceData = processedData.filter(
        (d) => seriesData.rebalanceLogsMap && seriesData.rebalanceLogsMap[d.time]
      );

      if (seriesName === "Target") {
        // // Render as points (only for rebalance dates)
        // g.append("g")
        //   .attr("class", `points series-${seriesName}`)
        //   .selectAll("circle")
        //   .data(rebalanceData)
        //   .enter()
        //   .append("circle")
        //   .attr("cx", (d) => xScale(d.parsedTime))
        //   .attr("cy", (d) => yScale(d.value))
        //   .attr("r", 2.5)
        //   .attr("stroke", black)
        //   .attr("fill", "none");
      } else {
        // Render as line/area with optional step interpolation
        const line = d3
          .line<any>()
          .x((d) => xScale(d.parsedTime))
          .y((d) => yScale(d.value));

        // Use step interpolation for ratio charts
        if (isStepLine) {
          line.curve(d3.curveStepAfter);
        }

        g.append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("d", line);

        if (isArea) {
          if (seriesName === "ratio") {
            const area = d3
              .area<any>()
              .x((d) => xScale(d.parsedTime))
              .y0(yScale(0))
              .y1((d) => yScale(d.value));

            // Use step interpolation for ratio areas
            if (isStepLine) {
              area.curve(d3.curveStepAfter);
            }

            g.append("path")
              .datum(processedData)
              .attr("class", `area series-${seriesName}`)
              .attr("fill", "#ecececff")
              .attr("d", area);

            g.append("g")
              .attr("class", `points series-${seriesName}`)
              .selectAll("circle")
              .data(rebalanceData)
              .enter()
              .append("circle")
              .attr("cx", (d) => xScale(d.parsedTime))
              .attr("cy", (d) => yScale(d.value))
              .attr("r", 2.5)
              .attr("fill", (d) => getRebalanceTypeColor(seriesData.rebalanceLogsMap![d.time]))
              .attr("stroke", black)
              .attr("stroke-width", 0);
          } else {
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
        }
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
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    g.append("line")
      .attr("class", "center-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", ratioYScale(-1))
      .attr("y2", ratioYScale(-1))
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    g.append("line")
      .attr("class", "center-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", ratioYScale(1))
      .attr("y2", ratioYScale(1))
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Render all series
    let mainSeries: any = null;

    // Render price series
    Object.entries(priceSeriesData).forEach(([name, data]) => {
      const series = renderSeries(name, data, priceYScale, false, false);
      if (!mainSeries) mainSeries = series;
    });

    // Render ratio series with areas and step lines
    Object.entries(ratioSeriesData).forEach(([name, data]) => {
      const series = renderSeries(name, data, ratioYScale, true, false);
      if (!mainSeries) mainSeries = series;
    });

    // Add interactive crosshair with dragging
    const crosshair = g
      .append("g")
      .attr("class", "crosshair")
      .style("display", selectedDate ? "block" : "none");
    const crosshairHeight = ratioTop + ratioHeight + spaceBetweenCharts / 2;

    // Vertical crosshair line
    const crosshairLine = crosshair
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", priceTop)
      .attr("y2", crosshairHeight)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Horizontal crosshair line
    const crosshairHorizontal = crosshair
      .append("line")
      .attr("class", "crosshair-horizontal")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .style("display", "none");

    // Value label
    const valueLabel = crosshair.append("g").attr("class", "value-label").style("display", "none");

    const valueRect = valueLabel.append("rect").attr("fill", "#666").attr("stroke", "#666").attr("rx", 3).attr("ry", 3);

    const valueText = valueLabel
      .append("text")
      .attr("fill", "white")
      .attr("font-size", "11px")
      .attr("font-family", "monospace")
      .attr("text-anchor", "start")
      .attr("dy", "0.35em");

    // Y-axis value label (left side)
    const yAxisValueLabel = crosshair.append("g").attr("class", "y-axis-value-label").style("display", "none");

    const yAxisValueRect = yAxisValueLabel
      .append("rect")
      .attr("fill", "#666")
      .attr("stroke", "#666")
      .attr("rx", 3)
      .attr("ry", 3);

    const yAxisValueText = yAxisValueLabel
      .append("text")
      .attr("fill", "white")
      .attr("font-size", "11px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .attr("text-anchor", "start")
      .attr("dy", "0.35em");

    // Add persistent selected date crosshair
    const selectedCrosshair = g.append("g").attr("class", "selected-crosshair").style("display", "none");

    const selectedCrosshairLine = selectedCrosshair
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", priceTop)
      .attr("y2", crosshairHeight)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3");

    // Function to update selected crosshair
    const updateSelectedCrosshair = (date: string | null) => {
      if (!date) {
        selectedCrosshair.style("display", "none");
        return;
      }

      const dateObj = parseTime(date);
      if (dateObj) {
        const x = xScale(dateObj);
        const color = getRebalanceTypeColor(seriesData.rebalanceLogsMap![date]);

        selectedCrosshairLine.attr("x1", x).attr("x2", x).attr("stroke", color);

        selectedCrosshair.style("display", "block");
      }
    };

    // Initialize selected crosshair if we have a selected date
    if (selectedDate) {
      updateSelectedCrosshair(selectedDate);
    }

    // Dragging state
    let isDragging = false;

    // Helper function to find nearest date
    const findNearestDate = (xPosition: number): string | null => {
      if (!seriesData.rebalanceLogsMap) return null;

      const dates = Object.keys(seriesData.rebalanceLogsMap).sort();
      if (dates.length === 0) return null;

      const parseTime = d3.timeParse("%Y-%m-%d");
      let nearestDate = dates[0];
      let minDistance = Math.abs(xScale(parseTime(dates[0])!) - xPosition);

      dates.forEach((date) => {
        const dateObj = parseTime(date);
        if (dateObj) {
          const distance = Math.abs(xScale(dateObj) - xPosition);
          if (distance < minDistance) {
            minDistance = distance;
            nearestDate = date;
          }
        }
      });

      return nearestDate;
    };

    // Helper function to update crosshair position
    const updateCrosshairPosition = (xPosition: number, mouseY?: number) => {
      const constrainedX = Math.max(0, Math.min(width, xPosition));
      crosshairLine.attr("x1", constrainedX).attr("x2", constrainedX);
      crosshair.style("display", "block");

      // Show horizontal crosshair line at cursor position
      if (mouseY !== undefined) {
        crosshairHorizontal.attr("y1", mouseY).attr("y2", mouseY).style("display", "block");

        // Determine which section we're in and show appropriate value
        let displayValue = "";
        if (mouseY >= priceTop && mouseY <= priceTop + priceHeight) {
          // Price section
          const priceValue = priceYScale.invert(mouseY);
          displayValue = priceValue.toFixed(1);
        } else if (mouseY >= ratioTop && mouseY <= ratioTop + ratioHeight) {
          // Ratio section
          const ratioValue = ratioYScale.invert(mouseY);
          displayValue = (ratioValue * 100).toFixed(1) + "%";
        }

        if (displayValue) {
          valueText.text(displayValue);

          // Calculate text dimensions for background rect
          const textBBox = (valueText.node() as SVGTextElement).getBBox();
          const padding = 4;
          valueRect
            .attr("x", width - textBBox.width - padding * 2 - 5)
            .attr("y", mouseY - textBBox.height / 2 - padding)
            .attr("width", textBBox.width + padding * 2)
            .attr("height", textBBox.height + padding * 2);

          valueLabel
            .attr("transform", `translate(${width - textBBox.width - padding - 5}, ${mouseY})`)
            .style("display", "block");

          // Y-axis label (right side)
          yAxisValueText.text(displayValue);

          // Calculate text dimensions for Y-axis label
          const yAxisTextBBox = (yAxisValueText.node() as SVGTextElement).getBBox();
          const yAxisPadding = 4;
          yAxisValueRect
            .attr("x", -yAxisPadding)
            .attr("y", -yAxisTextBBox.height / 2 - yAxisPadding)
            .attr("width", yAxisTextBBox.width + yAxisPadding * 2)
            .attr("height", yAxisTextBBox.height + yAxisPadding * 2);

          yAxisValueLabel.attr("transform", `translate(15, ${mouseY})`).style("display", "block");
        } else {
          valueLabel.style("display", "none");
          yAxisValueLabel.style("display", "none");
        }
      } else {
        crosshairHorizontal.style("display", "none");
        valueLabel.style("display", "none");
        yAxisValueLabel.style("display", "none");
      }
    };

    // Add invisible overlay for better mouse interaction
    const overlay = g
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", crosshairHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .style("cursor", "crosshair");

    // Add interaction behavior to the overlay
    overlay
      .on("mouseenter", function (event) {
        // Show crosshair when mouse enters chart area
        crosshair.style("display", "block");
      })
      .on("mouseleave", function (event) {
        // Hide crosshair when mouse leaves chart area (unless we have a selected date)
        if (!isDragging) {
          crosshair.style("display", selectedDate ? "block" : "none");
          // Hide horizontal line and labels when mouse leaves
          crosshairHorizontal.style("display", "none");
          valueLabel.style("display", "none");
          yAxisValueLabel.style("display", "none");
        }
      })
      .on("mousemove", function (event) {
        const [mouseX, mouseY] = d3.pointer(event, this);

        // Always update crosshair position to follow cursor
        updateCrosshairPosition(mouseX, mouseY);

        if (isDragging) {
          // Find and set the nearest date when dragging
          const nearestDate = findNearestDate(mouseX);
          if (nearestDate && onDateChange) {
            onDateChange(nearestDate);
          }
          event.preventDefault();
        }
      })
      .on("mousedown", function (event) {
        event.preventDefault();
        event.stopPropagation();
        const [mouseX] = d3.pointer(event, this);

        isDragging = true;
        d3.select(this).style("cursor", "grabbing");

        // Snap to nearest date immediately on mousedown
        const nearestDate = findNearestDate(mouseX);
        if (nearestDate && onDateChange) {
          onDateChange(nearestDate);
        }
      })
      .on("mouseup", function (event) {
        isDragging = false;
        d3.select(this).style("cursor", "crosshair");
      });

    // Add global mouse up and mouse move handlers for better tracking
    d3.select("body")
      .on("mouseup.chart", function (event) {
        if (isDragging) {
          isDragging = false;
          overlay.style("cursor", "crosshair");
        }
      })
      .on("mousemove.chart", function (event) {
        if (isDragging) {
          // Get mouse position relative to the overlay
          const overlayNode = overlay.node();
          if (overlayNode) {
            const [mouseX, mouseY] = d3.pointer(event, overlayNode);

            // Update crosshair position in real-time
            updateCrosshairPosition(mouseX, mouseY);

            // Find and set the nearest date
            const nearestDate = findNearestDate(mouseX);
            if (nearestDate && onDateChange) {
              onDateChange(nearestDate);
            }
          }
        }
      });

    // Add axes
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${ratioTop + ratioHeight + 10})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(20)
          .tickFormat((domainValue) => {
            return d3.timeFormat("%Y")(domainValue as Date);
          })
      );

    // Add Y-axes with custom formatting for price values
    const formatPriceValue = (domainValue: d3.NumberValue): string => {
      const value = Number(domainValue);
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(0)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}k`;
      } else {
        return value.toFixed(0);
      }
    };

    const yAxisConfig = isLogScale 
      ? d3.axisLeft(priceYScale).ticks(4).tickFormat(formatPriceValue)
      : d3.axisLeft(priceYScale).tickFormat(formatPriceValue);
    g.append("g").attr("class", "y-axis-price").attr("transform", `translate(0,0)`).call(yAxisConfig);
    // Add grid lines
    g.selectAll(".grid-line")
      .data(priceYScale.ticks(4))
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", (d) => priceYScale(d))
      .attr("y2", (d) => priceYScale(d))
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    g.append("g").attr("class", "y-axis-ratio").call(d3.axisLeft(ratioYScale).ticks(3));

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

          // Also update the persistent selected crosshair
          updateSelectedCrosshair(time);
        }
      },
      clearCrosshairPosition: () => {
        crosshair.style("display", "none");
      },
      timeScale: () => ({
        subscribeVisibleLogicalRangeChange: () => {},
        unsubscribeVisibleLogicalRangeChange: () => {},
      }),
      subscribeCrosshairMove: () => {},
      unsubscribeCrosshairMove: () => {},
    };

    return { chart: chartLikeObject, mainSeries };
  }, [isLogScale, chartDataMemo, onDateChange, selectedDate]);

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

    const hasData = d3ChartData && Object.keys(d3ChartData).length > 0;

    if (!hasData) return;

    const chartInstance = createD3Chart();
    chartInstanceRef.current = chartInstance;

    if (selectedDate && chartInstance) {
      chartInstance.chart.setCrosshairPosition(0, selectedDate);
    }

    const handleResize = () => {
      // Cleanup existing chart before creating new one
      if (chartInstanceRef.current && svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
      }
      const newInstance = createD3Chart();
      chartInstanceRef.current = newInstance;
    };

    // Capture ref values for cleanup
    const currentSvgRef = svgRef.current;

    // Cleanup function with more thorough removal
    const cleanup = () => {
      // Remove global event listeners
      d3.select("body").on("mouseup.chart", null).on("mousemove.chart", null);

      if (currentSvgRef) {
        const svg = d3.select(currentSvgRef);
        // Remove all elements
        svg.selectAll("*").remove();
      }
      chartInstanceRef.current = null;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      // Proper cleanup to prevent memory leaks
      window.removeEventListener("resize", handleResize);
      cleanup();
    };
  }, [createD3Chart, d3ChartData, selectedDate]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: height,
        backgroundColor: "white",
      }}
    >
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }} />
    </div>
  );
};

export default Chart;
