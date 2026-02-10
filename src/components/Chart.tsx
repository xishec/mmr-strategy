import React, { useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { D3ChartData } from "../core/models";
import { CHART_LAYOUT } from "../core/constants";

// Color constants
const COLORS = {
  black: "#202124",
  yellow: "#FBBC04",
  lightYellow: "#ffe599ff",
  blue: "#4285F4",
  red: "#EA4335",
  green: "#34A853",
  grey: "#848484ff",
  lightGrey: "#d7d7d7ff",
  default: "#2962FF",
} as const;

// Export individual colors for backward compatibility
export const black = COLORS.black;
export const yellow = COLORS.yellow;
export const lightYellow = COLORS.lightYellow;
export const blue = COLORS.blue;
export const red = COLORS.red;
export const green = COLORS.green;
export const grey = COLORS.grey;

// Color mapping for different chart series
const COLOR_MAP = {
  strategyTotal: COLORS.yellow,
  sma200: COLORS.blue,
  mockTotalQQQ: COLORS.blue,
  mockTotalTQQQ: COLORS.black,
  mockTotalNothing: "#dadadaff",
  ratio: COLORS.green,
  pullback: COLORS.red,
  default: COLORS.default,
} as const;

interface ChartProps {
  d3ChartData: D3ChartData;
  selectedDate: string | null;
  isLogScale?: boolean;
  showSignalMarkers?: boolean;
  height: string | number;
  onDateChange?: (date: string) => void;
  startDate?: string;
  endDate?: string;
}

const Chart: React.FC<ChartProps> = ({
  d3ChartData,
  selectedDate,
  isLogScale = false,
  showSignalMarkers = false,
  height,
  onDateChange,
  startDate,
  endDate,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Store stable dimensions to prevent layout jumping during data changes
  const stableDimensionsRef = useRef<{ width: number; height: number; margin: any } | null>(null);

  // Use refs to capture start/end dates without triggering chart recreation
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);

  // Update refs when props change, but don't trigger chart recreation
  useEffect(() => {
    startDateRef.current = startDate;
    endDateRef.current = endDate;
  }, [startDate, endDate]);

  // Use ref to avoid recreating createD3Chart when onDateChange changes
  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  // Use ref for selectedDate to avoid recreating createD3Chart
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  // Memoize expensive data processing to prevent unnecessary re-computations
  const chartDataMemo = useMemo(() => {
    if (!d3ChartData) return { rebalanceLogsMap: {} };

    // Combine all chart data into a single object for easier processing
    return {
      ...d3ChartData.priceChart,
      ...d3ChartData.ratioChart,
      ...d3ChartData.pullbackChart,
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

    // Setup dimensions and data with stability during data changes
    const margin = { top: 5, left: 35, right: 40, bottom: 60 }; // Increased bottom margin for x-axis

    let width: number, totalChartHeight: number;

    // Use stable dimensions if available to prevent layout jumping during data updates
    if (stableDimensionsRef.current) {
      width = stableDimensionsRef.current.width;
      totalChartHeight = stableDimensionsRef.current.height;
    } else {
      // Calculate fresh dimensions and store them
      width = container.clientWidth - margin.left - margin.right;
      totalChartHeight = container.clientHeight - margin.top - margin.bottom;

      // Store dimensions for stability
      if (width > 0 && totalChartHeight > 0) {
        stableDimensionsRef.current = { width, height: totalChartHeight, margin };
      }
    }
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
    const xAxisSpace = 30; // Reserve space for x-axis at bottom
    const availableHeight = totalChartHeight - spaceBetweenCharts - xAxisSpace;
    const priceHeight = availableHeight * CHART_LAYOUT.PRICE_HEIGHT_RATIO;
    const ratioHeight = availableHeight * CHART_LAYOUT.RATIO_HEIGHT_RATIO;
    const priceTop = 0;
    const ratioTop = priceTop + priceHeight + spaceBetweenCharts;
    const crosshairHeight = ratioTop + ratioHeight + spaceBetweenCharts / 2;

    // Separate series by type
    const priceKeys = [
      "strategyTotal",
      "strategyTotalAll",
      "sma200",
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

    // Create time scale using FIXED date range to prevent zoom issues
    let xScaleDomain: [Date, Date];

    if (startDateRef.current && endDateRef.current) {
      // Always use the FULL original date range to prevent zoom when data changes
      const startDateObj = parseTime(startDateRef.current);
      const endDateObj = parseTime(endDateRef.current);
      xScaleDomain =
        startDateObj && endDateObj
          ? [startDateObj, endDateObj]
          : (d3.extent(parsedData, (d) => d.parsedTime) as [Date, Date]);
    } else {
      // Fallback to data extent if no fixed dates provided
      xScaleDomain = d3.extent(parsedData, (d) => d.parsedTime) as [Date, Date];
    }

    const xScale = d3.scaleTime().domain(xScaleDomain).range([0, width]);

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

    // Helper function to format price values
    const formatPriceValue = (domainValue: d3.NumberValue): string => {
      const value = Number(domainValue);
      if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(0)}B`;
      } else if (value >= 1000000) {
        return `${(value / 1000000).toFixed(0)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}k`;
      } else {
        return value.toFixed(0);
      }
    };

    // Helper function to render a series
    const renderSeries = (seriesName: string, data: any[], yScale: any, isArea = false, isStepLine = false) => {
      const color = COLOR_MAP[seriesName as keyof typeof COLOR_MAP] || COLOR_MAP.default;
      const processedData = data.map((d) => ({ ...d, parsedTime: parseTime(d.time) }));

      // Render as line/area with optional step interpolation
      const line = d3
        .line<any>()
        .x((d) => xScale(d.parsedTime))
        .y((d) => yScale(d.value));

      // Use step interpolation for ratio charts
      if (isStepLine) {
        line.curve(d3.curveStepAfter);
      }

      // Render area if needed
      if (isArea) {
        const area = d3
          .area<any>()
          .x((d) => xScale(d.parsedTime))
          .y0(yScale(0))
          .y1((d) => yScale(d.value));

        if (isStepLine) {
          area.curve(d3.curveStepAfter);
        }

        g.append("path")
          .datum(processedData)
          .attr("class", `area series-${seriesName}`)
          .attr("fill", color)
          .attr("fill-opacity", 0.3)
          .attr("d", area);

        const strokeWidth = seriesName === "ratio" ? 0 : 1;
        g.append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", strokeWidth)
          .attr("d", line);
      } else {
        const strokeWidth = seriesName === "strategyTotal" ? 2 : 1;
        g.append("path")
          .datum(processedData)
          .attr("class", `line series-${seriesName}`)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", strokeWidth)
          .attr("d", line);
      }

      // Store marker data for later rendering (markers will be rendered after all series)
      if (seriesName === "mockTotalTQQQ" && showSignalMarkers) {
        return { data: processedData, name: seriesName, hasMarkers: true, yScale };
      }

      return { data: processedData, name: seriesName };
    };

    // Helper function to add grid lines
    const addGridLines = () => {
      const gridLines = [
        { y: ratioYScale(-1), className: "ratio-line-neg1" },
        { y: ratioYScale(0), className: "ratio-line-zero" },
        { y: ratioYScale(1), className: "ratio-line-pos1" },
      ];

      gridLines.forEach(({ y, className }) => {
        g.append("line")
          .attr("class", className)
          .attr("x1", 0)
          .attr("x2", width)
          .attr("y1", y)
          .attr("y2", y)
          .attr("stroke", COLORS.lightGrey)
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,3");
      });
    };

    addGridLines();

    // Render all series
    let mainSeries: any = null;
    let markerSeriesInfo: any = null;

    // Render price series
    Object.entries(priceSeriesData).forEach(([name, data]) => {
      const series = renderSeries(name, data, priceYScale, false, false);
      if (!mainSeries) mainSeries = series;
      if (series.hasMarkers) markerSeriesInfo = series;
    });

    // Render ratio series with areas and step lines
    Object.entries(ratioSeriesData).forEach(([name, data]) => {
      const series = renderSeries(name, data, ratioYScale, true, true);
      if (!mainSeries) mainSeries = series;
    });

    // Render markers above everything else
    if (markerSeriesInfo && showSignalMarkers) {
      const { data: processedData, name: seriesName, yScale } = markerSeriesInfo;

      // Render X marker points for mockTotalTQQQ when hasXMarker is true
      const markerData = processedData.filter((d: any) => d.hasXMarker);

      g.selectAll(`.marker-${seriesName}`)
        .data(markerData)
        .enter()
        .append("g")
        .attr("class", `marker-${seriesName}`)
        .attr("transform", (d: any) => `translate(${xScale(d.parsedTime)}, ${yScale(d.value)})`)
        .selectAll("line")
        .data([
          { x1: -1, y1: -1, x2: 1, y2: 1 }, // \ diagonal
          { x1: -1, y1: 1, x2: 1, y2: -1 }, // / diagonal
        ])
        .enter()
        .append("line")
        .attr("x1", (d: any) => d.x1)
        .attr("y1", (d: any) => d.y1)
        .attr("x2", (d: any) => d.x2)
        .attr("y2", (d: any) => d.y2)
        .attr("stroke", COLORS.red)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");

      // Render green triangles for isAboveSMA200
      const greenTriangleData = processedData.filter((d: any) => d.hasGreenTriangle);
      g.selectAll(`.green-triangle-${seriesName}`)
        .data(greenTriangleData)
        .enter()
        .append("polygon")
        .attr("class", `green-triangle-${seriesName}`)
        .attr("points", (d: any) => {
          const x = xScale(d.parsedTime);
          const y = yScale(d.value) + 10; // 10 pixels below the line
          const size = 4;
          return `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`;
        })
        .attr("fill", COLORS.green);

      // Render red triangles for isBelowSMA200
      const redTriangleData = processedData.filter((d: any) => d.hasBlackTriangle);
      g.selectAll(`.black-triangle-${seriesName}`)
        .data(redTriangleData)
        .enter()
        .append("polygon")
        .attr("class", `black-triangle-${seriesName}`)
        .attr("points", (d: any) => {
          const x = xScale(d.parsedTime);
          const y = yScale(d.value) - 10; // 10 pixels above the line
          const size = 4;
          // Downward pointing triangle
          return `${x},${y + size} ${x - size},${y - size} ${x + size},${y - size}`;
        })
        .attr("fill", COLORS.red);

      // Generic helper to draw circular markers with color & vertical offset
      const drawColoredMarkers = (flagName: string, classPrefix: string, color: string, dy: number, radius = 4) => {
        const data = processedData.filter((d: any) => d[flagName]);
        if (!data.length) return;
        g.selectAll(`.${classPrefix}-${seriesName}`)
          .data(data)
          .enter()
          .append("circle")
          .attr("class", `${classPrefix}-${seriesName}`)
          .attr("cx", (d: any) => xScale(d.parsedTime))
          .attr("cy", (d: any) => yScale(d.value) + dy)
          .attr("r", radius)
          .attr("fill", color)
          .attr("opacity", 1);
      };

      // Render new colored markers (stacked vertically below the line)
      drawColoredMarkers("hasYellowMarker", "yellow-marker", "#fff700ff", 5, 4);
      drawColoredMarkers("hasOrangeMarker", "orange-marker", "#ffa600ff", 10, 4);
      drawColoredMarkers("hasRedMarker", "red-marker", COLORS.red, 15, 4);
      drawColoredMarkers("hasBlueMarker", "blue-marker", COLORS.blue, 20, 4);
      drawColoredMarkers("belowSMA", "belowSMA-marker", "#888888", 10, 2);
    }

    // Helper function to create crosshair elements
    const createCrosshair = () => {
      const crosshair = g
        .append("g")
        .attr("class", "crosshair")
        .style("display", selectedDateRef.current ? "block" : "none");

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

      return { crosshair, crosshairLine, crosshairHorizontal };
    };

    // Helper function to create value labels
    const createValueLabels = (crosshair: any) => {
      // Value label (floating)
      const valueLabel = crosshair.append("g").attr("class", "value-label").style("display", "none");
      const valueRect = valueLabel
        .append("rect")
        .attr("fill", "#666")
        .attr("stroke", "#666")
        .attr("rx", 3)
        .attr("ry", 3);
      const valueText = valueLabel
        .append("text")
        .attr("fill", "white")
        .attr("font-size", "11px")
        .attr("font-family", "monospace")
        .attr("text-anchor", "start")
        .attr("dy", "0.35em");

      // Y-axis value label
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

      // X-axis value label
      const xAxisValueLabel = crosshair.append("g").attr("class", "x-axis-value-label").style("display", "none");
      const xAxisValueRect = xAxisValueLabel
        .append("rect")
        .attr("fill", "#666")
        .attr("stroke", "#666")
        .attr("rx", 3)
        .attr("ry", 3);
      const xAxisValueText = xAxisValueLabel
        .append("text")
        .attr("fill", "white")
        .attr("font-size", "11px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em");

      return {
        valueLabel,
        valueRect,
        valueText,
        yAxisValueLabel,
        yAxisValueRect,
        yAxisValueText,
        xAxisValueLabel,
        xAxisValueRect,
        xAxisValueText,
      };
    };

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

    // Add persistent date label for selected crosshair
    const selectedDateLabel = selectedCrosshair.append("g").attr("class", "selected-date-label");
    const selectedDateRect = selectedDateLabel
      .append("rect")
      .attr("fill", "#666")
      .attr("stroke", "#666")
      .attr("rx", 3)
      .attr("ry", 3);
    const selectedDateText = selectedDateLabel
      .append("text")
      .attr("fill", "white")
      .attr("font-size", "11px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em");

    // Function to update selected crosshair
    const updateSelectedCrosshair = (date: string | null) => {
      if (!date) {
        selectedCrosshair.style("display", "none");
        return;
      }

      const dateObj = parseTime(date);
      if (dateObj) {
        const x = xScale(dateObj);

        selectedCrosshairLine.attr("x1", x).attr("x2", x).attr("stroke", "black");

        // Update the date label
        selectedDateText.text(date);

        // Calculate text dimensions for the date label
        const dateTextBBox = (selectedDateText.node() as SVGTextElement).getBBox();
        const datePadding = 4;
        selectedDateRect
          .attr("x", -dateTextBBox.width / 2 - datePadding)
          .attr("y", -dateTextBBox.height / 2 - datePadding)
          .attr("width", dateTextBBox.width + datePadding * 2)
          .attr("height", dateTextBBox.height + datePadding * 2);

        selectedDateLabel.attr("transform", `translate(${x}, ${ratioTop + ratioHeight - 15})`);

        selectedCrosshair.style("display", "block");
      }
    };

    // Create hover crosshair after selected crosshair so it renders on top
    const { crosshair, crosshairLine, crosshairHorizontal } = createCrosshair();

    // Create value labels for the hover crosshair
    const {
      valueLabel,
      valueRect,
      valueText,
      yAxisValueLabel,
      yAxisValueRect,
      yAxisValueText,
      xAxisValueLabel,
      xAxisValueRect,
      xAxisValueText,
    } = createValueLabels(crosshair);

    // Initialize selected crosshair if we have a selected date
    if (selectedDateRef.current) {
      updateSelectedCrosshair(selectedDateRef.current);
    }

    // Dragging state
    let isDragging = false;

    // Helper function to find nearest date
    const findNearestDate = (xPosition: number): string | null => {
      // Get dates from any available series data (they all have the same dates)
      let dates: string[] = [];

      // Try to get dates from any available series
      const allSeries = Object.values(seriesData);
      for (const series of allSeries) {
        if (Array.isArray(series) && series.length > 0) {
          dates = series.map((point: any) => point.time);
          break;
        }
      }

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

      // Show x-axis date label
      const dateAtPosition = xScale.invert(constrainedX);
      const dateString = d3.timeFormat("%Y-%m-%d")(dateAtPosition);

      xAxisValueText.text(dateString);

      // Calculate text dimensions for X-axis label
      const xAxisTextBBox = (xAxisValueText.node() as SVGTextElement).getBBox();
      const xAxisPadding = 4;
      xAxisValueRect
        .attr("x", -xAxisTextBBox.width / 2 - xAxisPadding)
        .attr("y", -xAxisTextBBox.height / 2 - xAxisPadding)
        .attr("width", xAxisTextBBox.width + xAxisPadding * 2)
        .attr("height", xAxisTextBBox.height + xAxisPadding * 2);

      xAxisValueLabel
        .attr("transform", `translate(${constrainedX}, ${ratioTop + ratioHeight - 15})`)
        .style("display", "block");

      // Show horizontal crosshair line at cursor position
      if (mouseY !== undefined) {
        crosshairHorizontal.attr("y1", mouseY).attr("y2", mouseY).style("display", "block");

        // Determine which section we're in and show appropriate value
        let displayValue = "";
        if (mouseY >= priceTop && mouseY <= priceTop + priceHeight) {
          // Price section
          const priceValue = priceYScale.invert(mouseY);
          displayValue = formatPriceValue(priceValue);
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
        // Keep x-axis label visible even without mouseY
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
        // Hide crosshair when mouse leaves chart area
        if (!isDragging) {
          crosshair.style("display", "none");
          // Hide horizontal line and labels when mouse leaves
          crosshairHorizontal.style("display", "none");
          valueLabel.style("display", "none");
          yAxisValueLabel.style("display", "none");
          xAxisValueLabel.style("display", "none");
        }
      })
      .on("mousemove", function (event) {
        const [mouseX, mouseY] = d3.pointer(event, this);

        // Always update crosshair position to follow cursor
        updateCrosshairPosition(mouseX, mouseY);

        if (isDragging) {
          // Find and set the nearest date when dragging
          const nearestDate = findNearestDate(mouseX);
          if (nearestDate && onDateChangeRef.current) {
            onDateChangeRef.current(nearestDate);
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
        if (nearestDate && onDateChangeRef.current) {
          onDateChangeRef.current(nearestDate);
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
            if (nearestDate && onDateChangeRef.current) {
              onDateChangeRef.current(nearestDate);
            }
          }
        }
      });
    // Note: Keyboard navigation is handled by the global useDateNavigation hook
    // so we don't need to handle keydown events here to avoid conflicts

    // Helper function to add axes and grid
    const addAxesAndGrid = () => {
      // X-axis - always 5 ticks
      g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${ratioTop + ratioHeight + 10})`)
        .call(
          d3
            .axisBottom(xScale)
            .ticks(5)
            .tickFormat((domainValue) => d3.timeFormat("%Y")(domainValue as Date))
        );

      // Y-axes - fewer ticks for log scale to reduce clutter
      const yAxisConfig = isLogScale
        ? d3.axisLeft(priceYScale).ticks(3).tickFormat(formatPriceValue)
        : d3.axisLeft(priceYScale).ticks(5).tickFormat(formatPriceValue);

      g.append("g").attr("class", "y-axis-price").attr("transform", "translate(0,0)").call(yAxisConfig);

      g.append("g").attr("class", "y-axis-ratio").call(d3.axisLeft(ratioYScale).ticks(5));

      // Price grid lines - fewer grid lines for log scale
      const gridTicks = isLogScale ? 3 : 5;
      g.selectAll(".grid-line")
        .data(priceYScale.ticks(gridTicks))
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", (d) => priceYScale(d))
        .attr("y2", (d) => priceYScale(d))
        .attr("stroke", COLORS.lightGrey)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    };

    addAxesAndGrid();

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
  }, [isLogScale, chartDataMemo, showSignalMarkers]);

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

    const handleResize = () => {
      // Reset stable dimensions on resize to allow adaptation
      stableDimensionsRef.current = null;

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
      d3.select("body").on("mouseup.chart", null).on("mousemove.chart", null).on("keydown.chart", null);

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
  }, [createD3Chart, d3ChartData]);

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
