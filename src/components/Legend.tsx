import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import { formatValue } from "../core/functions";
import { blue, red, yellow, green } from "./Chart";
import { D3ChartData, MarketData, SignalType, Simulation } from "../core/models";
import { getYesterdaySignal } from "../core/core-logic";

interface LegendItem {
  label: string;
  color: string;
  type: "line" | "circle" | "area";
  dashed?: boolean;
  seriesKey: string;
}

interface LegendProps {
  d3ChartData: D3ChartData;
  selectedDate?: string | null;
  marketData: MarketData;
  simulation: Simulation;
}

const Legend: React.FC<LegendProps> = ({ d3ChartData, selectedDate, marketData, simulation }) => {
  // Define all legend items in the requested order
  const allLegendItems: LegendItem[] = [
    { label: "Strategy Total", color: yellow, type: "line", seriesKey: "strategyTotal" },
    { label: "QQQ Total", color: blue, type: "line", seriesKey: "mockTotalQQQ" },
    { label: "TQQQ Total", color: red, type: "line", seriesKey: "mockTotalTQQQ" },
    { label: "TQQQ vs Cash ratio", color: green, type: "area", seriesKey: "ratio" },
    { label: "Strategy Pullback", color: red, type: "area", seriesKey: "pullback" },
  ];

  const getValueForSeries = (seriesKey: string): string => {
    if (!selectedDate) return "";

    let value: number | undefined;

    // Check if it's a ratio or pullback series
    if (seriesKey === "ratio") {
      const ratioData = d3ChartData.ratioChart[seriesKey];
      if (ratioData) {
        const dataPoint = ratioData.find((point) => point.time === selectedDate);
        value = dataPoint?.value;
      }
      return value !== undefined ? formatValue(value, true) : "";
    } else if (seriesKey === "pullback") {
      const pullbackData = d3ChartData.pullbackChart[seriesKey];
      if (pullbackData) {
        const dataPoint = pullbackData.find((point) => point.time === selectedDate);
        value = dataPoint?.value;
      }
      return value !== undefined ? formatValue(value, true) : "";
    } else {
      // Price series
      const priceData = d3ChartData.priceChart[seriesKey];
      if (priceData) {
        const dataPoint = priceData.find((point) => point.time === selectedDate);
        value = dataPoint?.value;
      }
      return value !== undefined ? formatValue(value, false) : "";
    }
  };

  // Filter items to only show those that have data
  const availableItems = allLegendItems.filter((item) => {
    if (item.seriesKey === "ratio") {
      return d3ChartData.ratioChart[item.seriesKey] && d3ChartData.ratioChart[item.seriesKey].length > 0;
    } else if (item.seriesKey === "pullback") {
      return d3ChartData.pullbackChart[item.seriesKey] && d3ChartData.pullbackChart[item.seriesKey].length > 0;
    } else {
      return d3ChartData.priceChart[item.seriesKey] && d3ChartData.priceChart[item.seriesKey].length > 0;
    }
  });

  return (
    <Box
      sx={{
        display: "grid",
        alignItems: "center",
        gap: 2,
        gridTemplateColumns: {
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
          lg: "repeat(7, 1fr)",
        },
        justifyContent: "space-between",
      }}
    >
      {/* Date first */}
      {selectedDate && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "normal", color: "text.secondary", mb: 0.5 }}>
            Selected Date
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "bold" }}>
            {selectedDate}
          </Typography>
        </Box>
      )}

      {/* Signal */}
      {selectedDate &&
        (() => {
          const signal = getYesterdaySignal(selectedDate, marketData, Object.keys(marketData.QQQ), simulation);
          return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <Typography
                variant="body2"
                sx={{ fontSize: "1rem", fontWeight: "normal", color: "text.secondary", mb: 0.5 }}
              >
                Combined Signal :
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "bold" }}>
                <Chip
                  sx={{
                    position: "relative",
                    top: "-0.15rem",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    border: "2px solid",
                    pt: 0.1,
                    pr: 0.05,
                    width: "75px",
                  }}
                  label={signal.signalType}
                  color={signal.signalType === SignalType.Sell ? "error" : "success"}
                  variant="outlined"
                  size="small"
                />
              </Typography>
            </Box>
          );
        })()}

      {/* Legend items */}
      {availableItems.map((item, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            {item.type === "line" ? (
              <Box
                sx={{
                  width: 16,
                  height: 2,
                  backgroundColor: item.color,
                  borderStyle: item.dashed ? "dashed" : "solid",
                  borderWidth: item.dashed ? "1px 0" : 0,
                }}
              />
            ) : item.type === "area" ? (
              <Box
                sx={{
                  width: 16,
                  height: 8,
                  backgroundColor: item.color,
                  opacity: 0.3,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: item.color,
                }}
              />
            )}
            <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "normal" }}>
              {item.label}
            </Typography>
          </Box>
          {selectedDate && (
            <Typography
              variant="body2"
              sx={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: item.color,
                ml: 3,
              }}
            >
              {getValueForSeries(item.seriesKey)}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default Legend;
