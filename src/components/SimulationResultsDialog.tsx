import React, { useEffect, useRef, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography } from "@mui/material";
import * as d3 from "d3";
import { blue, green, yellow } from "./Chart";

interface SimulationResult {
  startDate: string;
  strategyRate: number;
  qqqRate: number;
  tqqqRate: number;
}

interface SimulationResultsDialogProps {
  open: boolean;
  onClose: () => void;
  results: SimulationResult[];
  title?: string;
}

const SimulationResultsDialog: React.FC<SimulationResultsDialogProps> = ({
  open,
  onClose,
  results,
  title = "Simulation Results",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate statistics
  const calculateStatistics = useCallback(() => {
    if (results.length === 0) return null;

    const strategyRates = results.map((r) => r.strategyRate);
    const qqqRates = results.map((r) => r.qqqRate);

    const averageStrategyRate = strategyRates.reduce((sum, rate) => sum + rate, 0) / strategyRates.length;
    const averageQQQRate = qqqRates.reduce((sum, rate) => sum + rate, 0) / qqqRates.length;

    const strategyVsQQQImprovement = (averageStrategyRate / averageQQQRate - 1) * 100;

    const strategyWinsOverQQQ = results.filter((r) => r.strategyRate > r.qqqRate).length;
    const winRateVsQQQ = (strategyWinsOverQQQ / results.length) * 100;

    const sortedByStrategy = [...results].sort((a, b) => a.strategyRate - b.strategyRate);
    const absoluteWorst = sortedByStrategy[0];

    const sortedByRelative = [...results].sort((a, b) => a.strategyRate - a.qqqRate - (b.strategyRate - b.qqqRate));
    const relativeWorst = sortedByRelative[0];

    return {
      averageStrategyRate,
      averageQQQRate,
      strategyVsQQQImprovement,
      winRateVsQQQ,
      absoluteWorst,
      relativeWorst,
    };
  }, [results]);

  const statistics = calculateStatistics();

  const createChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current || results.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const g = svg
      .attr("width", container.clientWidth)
      .attr("height", 400)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse dates and sort data
    const parsedData = results
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
        d3.min(parsedData, (d) => Math.min(d.strategyRate, d.qqqRate)) as number,
        d3.max(parsedData, (d) => Math.max(d.strategyRate, d.qqqRate)) as number,
      ])
      .nice()
      .range([height, 0]);

    // Line generators
    const strategyLine = d3
      .line<(typeof parsedData)[0]>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.strategyRate))
      .curve(d3.curveMonotoneX);

    const qqqLine = d3
      .line<(typeof parsedData)[0]>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.qqqRate))
      .curve(d3.curveMonotoneX);

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
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5);

    // Add axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat("%Y-%m") as any);
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".1%"));

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis as any)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    g.append("g").call(yAxis as any);

    // Add axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Annualized Rate");

    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Simulation Start Date");

    // Add lines
    g.append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", yellow) // for strategy
      .attr("stroke-width", 1)
      .attr("d", strategyLine);

    g.append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", blue) // for QQQ
      .attr("stroke-width", 1)
      .attr("d", qqqLine);

    // Add legend
    const legend = g.append("g").attr("transform", `translate(20, 20)`);

    legend
      .append("rect")
      .attr("width", 100)
      .attr("height", 50)
      .attr("fill", "white")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);

    legend
      .append("line")
      .attr("x1", 5)
      .attr("x2", 25)
      .attr("y1", 15)
      .attr("y2", 15)
      .attr("stroke", green)
      .attr("stroke-width", 2);

    legend.append("text").attr("x", 30).attr("y", 15).attr("dy", "0.35em").style("font-size", "12px").text("Strategy");

    legend
      .append("line")
      .attr("x1", 5)
      .attr("x2", 25)
      .attr("y1", 35)
      .attr("y2", 35)
      .attr("stroke", yellow)
      .attr("stroke-width", 2);

    legend.append("text").attr("x", 30).attr("y", 35).attr("dy", "0.35em").style("font-size", "12px").text("QQQ");

    // Add tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "simulation-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Add invisible overlay for mouse events
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event);
        const dateAtMouse = xScale.invert(mouseX);

        // Find closest data point
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
              ).toFixed(2)}%`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 28 + "px");
        }
      })
      .on("mouseout", function () {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    // Cleanup tooltip on component unmount
    return () => {
      d3.selectAll(".simulation-tooltip").remove();
    };
  }, [results]);

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
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: "80vh",
          maxHeight: "800px",
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Comparison of strategy performance vs QQQ benchmark across different simulation start dates. Each point
            represents a {results.length > 0 ? "multi-year" : ""} simulation starting on that date.
          </Typography>

          {/* Statistics Summary */}
          {statistics && (
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Performance Summary
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Average Strategy Rate
                  </Typography>
                  <Typography variant="h6" color={yellow}>
                    {(statistics.averageStrategyRate * 100).toFixed(2)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Strategy vs QQQ
                  </Typography>
                  <Typography
                    variant="h6"
                    color={statistics.strategyVsQQQImprovement > 0 ? "success.main" : "error.main"}
                  >
                    {statistics.strategyVsQQQImprovement.toFixed(2)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Win Rate vs QQQ
                  </Typography>
                  <Typography variant="h6" color={statistics.winRateVsQQQ > 50 ? "success.main" : "error.main"}>
                    {statistics.winRateVsQQQ.toFixed(2)}%
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Average QQQ Rate
                  </Typography>
                  <Typography variant="h6" color={blue}>
                    {(statistics.averageQQQRate * 100).toFixed(2)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Absolute Worst
                  </Typography>
                  <Typography
                    variant="h6"
                    color={statistics.absoluteWorst.strategyRate > 0 ? "success.main" : "error.main"}
                  >
                    {(statistics.absoluteWorst.strategyRate * 100).toFixed(2)}%
                    <Typography variant="caption" display="block" color="text.secondary">
                      ({statistics.absoluteWorst.startDate})
                    </Typography>
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Relative Worst
                  </Typography>
                  <Typography
                    variant="h6"
                    color={statistics.relativeWorst.strategyRate > 0 ? "success.main" : "error.main"}
                  >
                    {(statistics.relativeWorst.strategyRate * 100).toFixed(2)}%
                    <Typography variant="caption" display="block" color="text.secondary">
                      ({statistics.relativeWorst.startDate})
                    </Typography>
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Box ref={containerRef} sx={{ width: "100%", height: 400 }}>
            <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SimulationResultsDialog;
