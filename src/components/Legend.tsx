import React from "react";
import { Box, Typography } from "@mui/material";
import { formatValue } from "../core/functions";
import { blue, red, yellow, grey } from "./Chart";
import { D3ChartData } from "../core/models";

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
  priceValues?: { [key: string]: number };
  ratioValues?: { [key: string]: number };
}

const Legend: React.FC<LegendProps> = ({ d3ChartData, selectedDate, priceValues = {}, ratioValues = {} }) => {
  // Define all legend items in the requested order
  const allLegendItems: LegendItem[] = [
    { label: "Strategy Total", color: yellow, type: "line", seriesKey: "StrategyTotal" },
    { label: "Mock Total QQQ", color: blue, type: "line", seriesKey: "MockTotalQQQ" },
    { label: "Mock Total TQQQ", color: red, type: "line", seriesKey: "MockTotalTQQQ" },
    { label: "TQQQ Ratio", color: grey, type: "area", seriesKey: "Ratio" },
    { label: "Portfolio Pullback", color: red, type: "area", seriesKey: "pullback" },
  ];

  const getValueForSeries = (seriesKey: string): string => {
    if (!selectedDate) return "";

    let value: number | undefined;

    // Check if it's a price series or ratio series
    if (seriesKey === "Ratio" || seriesKey === "pullback") {
      value = ratioValues[seriesKey];
      return formatValue(value, true);
    } else {
      value = priceValues[seriesKey];
      return formatValue(value, false);
    }
  };

  // Filter items to only show those that have data
  const availableItems = allLegendItems.filter((item) => {
    if (item.seriesKey === "Ratio" || item.seriesKey === "pullback") {
      return d3ChartData.ratioChart[item.seriesKey] && d3ChartData.ratioChart[item.seriesKey].length > 0;
    } else {
      return d3ChartData.priceChart[item.seriesKey] && d3ChartData.priceChart[item.seriesKey].length > 0;
    }
  });

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
      {/* Date first */}
      {selectedDate && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: "100px" }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "normal", color: "text.secondary" }}>
            Date
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: "bold" }}>
            {selectedDate}
          </Typography>
        </Box>
      )}

      {/* Legend items */}
      {availableItems.map((item, index) => (
        <Box key={index} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: "120px" }}>
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
                ml: 2.5, // Align with the text above
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
