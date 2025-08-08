import React, { useEffect, useRef, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, Box, Typography } from "@mui/material";
import * as d3 from "d3";
import { blue, yellow, red, black } from "./Chart";
import { AnalysisResults } from "../core/models";

interface SimulationResultsDialogProps {
  open: boolean;
  onClose: () => void;
  analysisResults: AnalysisResults | null;
  title?: string;
}

const SimulationResultsDialog: React.FC<SimulationResultsDialogProps> = ({
  open,
  onClose,
  analysisResults,
  title = "Simulation Results",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoading = analysisResults === null;

  // Helper function to apply consistent text styling
  const applyTextStyle = (selection: any) => {
    return selection.style("font-size", "11px").style("font-family", "system-ui, -apple-system, sans-serif");
  };

  const createChart = useCallback(() => {
    if (!analysisResults) return;

    if (!svgRef.current || !containerRef.current || analysisResults.resultsWithRates.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const margin = { top: 20, right: 30, bottom: 70, left: 80 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    const g = svg
      .attr("width", container.clientWidth)
      .attr("height", container.clientHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse dates and sort data
    const parsedData = analysisResults.resultsWithRates
      .map((d) => ({
        ...d,
        date: new Date(d.startDate),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(parsedData, (d) => Math.min(d.strategyRate, d.qqqRate, d.tqqqRate)) as number,
        d3.max(parsedData, (d) => Math.max(d.strategyRate, d.qqqRate, d.tqqqRate)) as number,
      ])
      .nice()
      .range([height, 0]);

    // No line generators needed - using scatter plot markers instead

    // Add grid lines
    g.selectAll(".grid-line")
      .data(yScale.ticks())
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Add axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(20)
      .tickFormat(d3.timeFormat("%Y") as any);
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".1%"));

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis as any)
      .selectAll("text")
      .call(applyTextStyle);

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis as any)
      .selectAll("text")
      .call(applyTextStyle);

    // Add axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 5)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#666")
      .call(applyTextStyle)
      .text("Annualized Rate");

    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 20})`)
      .style("text-anchor", "middle")
      .style("fill", "#666")
      .call(applyTextStyle)
      .text("Simulation Start Date");

    // Add scatter plot markers instead of lines
    
    // Strategy rate markers
    g.selectAll(".strategy-dot")
      .data(parsedData)
      .enter()
      .append("circle")
      .attr("class", "strategy-dot")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d.strategyRate))
      .attr("r", 1)
      .attr("fill", yellow)
      .attr("stroke", yellow)
      .attr("stroke-width", 1);

    // QQQ rate markers
    g.selectAll(".qqq-dot")
      .data(parsedData)
      .enter()
      .append("circle")
      .attr("class", "qqq-dot")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d.qqqRate))
      .attr("r", 1)
      .attr("fill", blue)
      .attr("stroke", blue)
      .attr("stroke-width", 1);

    // TQQQ rate markers
    g.selectAll(".tqqq-dot")
      .data(parsedData)
      .enter()
      .append("circle")
      .attr("class", "tqqq-dot")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d.tqqqRate))
      .attr("r", 1)
      .attr("fill", red)
      .attr("stroke", red)
      .attr("stroke-width", 1);

    // Add legend with better styling
    const legend = g.append("g").attr("transform", `translate(20, 20)`);

    legend
      .append("rect")
      .attr("width", 90)
      .attr("height", 75)
      .attr("fill", "white")
      .attr("stroke", "#d7d7d7ff")
      .attr("stroke-width", 1)
      .attr("rx", 3)
      .attr("ry", 3);

    legend
      .append("line")
      .attr("x1", 8)
      .attr("x2", 28)
      .attr("y1", 18)
      .attr("y2", 18)
      .attr("stroke", yellow)
      .attr("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 32)
      .attr("y", 18)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#333")
      .text("Strategy");

    legend
      .append("line")
      .attr("x1", 8)
      .attr("x2", 28)
      .attr("y1", 38)
      .attr("y2", 38)
      .attr("stroke", blue)
      .attr("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 32)
      .attr("y", 38)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#333")
      .text("QQQ");

    legend
      .append("line")
      .attr("x1", 8)
      .attr("x2", 28)
      .attr("y1", 58)
      .attr("y2", 58)
      .attr("stroke", red)
      .attr("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 32)
      .attr("y", 58)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#333")
      .text("TQQQ");

    // Add tooltip with better styling
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "simulation-tooltip")
      .style("position", "absolute")
      .style("background", "#666")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "3px")
      .style("font-size", "11px")
      .style("font-family", "monospace")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.2)");

    // Add interactive crosshair
    const crosshair = g.append("g").attr("class", "crosshair").style("display", "none");

    // Vertical crosshair line
    const crosshairLine = crosshair
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", height)
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
      .attr("stroke-dasharray", "3,3");

    // Value label (right side)
    const valueLabel = crosshair.append("g").attr("class", "value-label").style("display", "none");

    const valueRect = valueLabel.append("rect").attr("fill", "#666").attr("stroke", "#666").attr("rx", 3).attr("ry", 3);

    const valueText = valueLabel
      .append("text")
      .attr("fill", "white")
      .attr("font-size", "11px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .attr("text-anchor", "start")
      .attr("dy", "0.35em");

    // Y-axis value label (right side)
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

    // Add invisible overlay for mouse events
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mouseenter", function (event) {
        // Show crosshair when mouse enters chart area
        crosshair.style("display", "block");
      })
      .on("mouseleave", function (event) {
        // Hide crosshair when mouse leaves chart area
        crosshair.style("display", "none");
        valueLabel.style("display", "none");
        yAxisValueLabel.style("display", "none");
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .on("mousemove", function (event) {
        const [mouseX, mouseY] = d3.pointer(event, this);
        const dateAtMouse = xScale.invert(mouseX);

        // Update crosshair position
        crosshairLine.attr("x1", mouseX).attr("x2", mouseX);
        crosshairHorizontal.attr("y1", mouseY).attr("y2", mouseY);
        crosshair.style("display", "block");

        // Show value at mouse position
        const yValue = yScale.invert(mouseY);
        const displayValue = (yValue * 100).toFixed(1) + "%";

        // Update right-side value label
        valueText.text(displayValue);
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

        // Update y-axis value label
        yAxisValueText.text(displayValue);
        const yAxisTextBBox = (yAxisValueText.node() as SVGTextElement).getBBox();
        const yAxisPadding = 4;
        yAxisValueRect
          .attr("x", -yAxisPadding)
          .attr("y", -yAxisTextBBox.height / 2 - yAxisPadding)
          .attr("width", yAxisTextBBox.width + yAxisPadding * 2)
          .attr("height", yAxisTextBBox.height + yAxisPadding * 2);

        yAxisValueLabel.attr("transform", `translate(10, ${mouseY})`).style("display", "block");

        // Find closest data point for tooltip
        const bisectDate = d3.bisector((d: (typeof parsedData)[0]) => d.date).left;
        const index = bisectDate(parsedData, dateAtMouse, 1);
        const d0 = parsedData[index - 1];
        const d1 = parsedData[index];
        const d = d1 && dateAtMouse.getTime() - d0.date.getTime() > d1.date.getTime() - dateAtMouse.getTime() ? d1 : d0;

        if (d) {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip
            .html(
              `Date: ${d.startDate}<br/>Strategy: ${(d.strategyRate * 100).toFixed(2)}%<br/>QQQ: ${(
                d.qqqRate * 100
              ).toFixed(2)}%<br/>TQQQ: ${(d.tqqqRate * 100).toFixed(2)}%`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 28 + "px");
        }
      });

    // Cleanup tooltip on component unmount
    return () => {
      d3.selectAll(".simulation-tooltip").remove();
    };
  }, [analysisResults]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure the dialog is fully rendered
      const timer = setTimeout(createChart, 100);
      return () => clearTimeout(timer);
    }
  }, [open, createChart]);

  useEffect(() => {
    const handleResize = () => {
      if (open) {
        createChart();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      // Cleanup tooltips
      d3.selectAll(".simulation-tooltip").remove();
    };
  }, [open, createChart]);

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      fullWidth
      maxWidth={false}
      disableEscapeKeyDown={isLoading}
      slotProps={{
        paper: {
          sx: {
            height: "80vh",
            width: "80vw",
          },
        },
      }}
    >
      <DialogTitle sx={{ p: 3 }}>{isLoading ? `Running Simulations...` : title}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "300px",
              height: "100%",
              gap: 10,
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #d3d3d3ff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
              Running multiple independent backtests to validate strategy robustness.
              <br />
              Each simulation starts investing on a different historical date and runs through to today, comparing your
              strategy's annualized returns against the QQQ benchmark.
              <br />
              This comprehensive analysis reveals how your strategy would have performed regardless of market entry
              timing.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Statistics Summary */}
            {analysisResults && (
              <Box sx={{ mx: 2, mb: 2, p: 3, bgcolor: "grey.50", borderRadius: 2 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average QQQ Rate
                    </Typography>
                    <Typography variant="h6" color={blue}>
                      {(analysisResults.averageQQQRate * 100).toFixed(2)}%
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      (σ:{(analysisResults.qqqStandardDeviation * 100).toFixed(2)}%)
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average TQQQ Rate
                    </Typography>
                    <Typography variant="h6" color={red}>
                      {(analysisResults.averageTQQQRate * 100).toFixed(2)}%
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      (σ:{(analysisResults.tqqqStandardDeviation * 100).toFixed(2)}%)
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average Strategy Rate
                    </Typography>
                    <Typography variant="h6" color={yellow}>
                      {(analysisResults.averageStrategyRate * 100).toFixed(2)}%
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      (σ:{(analysisResults.strategyStandardDeviation * 100).toFixed(2)}%)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Improvement on QQQ
                    </Typography>
                    <Typography
                      variant="h6"
                      color={analysisResults.strategyVsQQQImprovement > 0 ? "success.main" : "error.main"}
                    >
                      {analysisResults.strategyVsQQQImprovement.toFixed(2)}%
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Win Rate vs QQQ
                    </Typography>
                    <Typography variant="h6" color={analysisResults.winRateVsQQQ > 50 ? "success.main" : "error.main"}>
                      {analysisResults.winRateVsQQQ.toFixed(2)}%
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Absolute Worst Rate
                    </Typography>
                    <Typography
                      variant="h6"
                      color={black}
                    >
                      {(analysisResults.absoluteWorstStrategyRate * 100).toFixed(2)}%
                      <Typography variant="caption" display="block" color="text.secondary">
                        ({analysisResults.absoluteWorstStrategyRateDate})
                      </Typography>
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Relative Worst Rate
                    </Typography>
                    <Typography
                      variant="h6"
                      color={black}
                    >
                      {(analysisResults.relativeWorstStrategyRate * 100).toFixed(2)}%
                      <Typography variant="caption" display="block" color="text.secondary">
                        ({analysisResults.relativeWorstStrategyRateDate})
                      </Typography>
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            <Box ref={containerRef} sx={{ width: "100%", flex: 1, minHeight: 500 }}>
              <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
            </Box>
          </Box>
        )}
      </DialogContent>
      {/* <DialogActions sx={{ p: 3 }}>
        {!isLoading && (
          <Button onClick={onClose} disabled={isLoading}>
            Close
          </Button>
        )}
      </DialogActions> */}
    </Dialog>
  );
};

export default SimulationResultsDialog;
