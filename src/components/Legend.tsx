import React from "react";
import { Box, Typography } from "@mui/material";

const yellow = "#FBBC04";
const blue = "#4285F4";
const red = "#EA4335";

interface LegendItem {
  label: string;
  color: string;
  type: "line" | "circle" | "area";
  dashed?: boolean;
  seriesKey: string;
}

interface LegendProps {
  priceSeriesData: { [key: string]: any[] };
  ratioSeriesData: { [key: string]: any[] };
  selectedDate?: string | null;
  priceValues?: { [key: string]: number };
  ratioValues?: { [key: string]: number };
}

const Legend: React.FC<LegendProps> = ({
  priceSeriesData,
  ratioSeriesData,
  selectedDate,
  priceValues = {},
  ratioValues = {},
}) => {
  // Define all legend items in the requested order
  const allLegendItems: LegendItem[] = [
    { label: "Strategy Total", color: yellow, type: "line", seriesKey: "StrategyTotal" },
    { label: "Mock Total QQQ", color: blue, type: "line", seriesKey: "MockTotalQQQ" },
    { label: "Mock Total TQQQ", color: red, type: "line", seriesKey: "MockTotalTQQQ" },
    { label: "TQQQ Ratio", color: blue, type: "area", seriesKey: "Ratio" },
    { label: "Portfolio Pullback", color: red, type: "area", seriesKey: "pullback" },
  ];

  const formatValue = (value: number, seriesKey: string): string => {
    if (typeof value !== "number") return "";

    // Format ratios and pullbacks as percentages
    if (seriesKey === "Ratio" || seriesKey === "pullback") {
      return (value * 100).toFixed(2) + "%";
    }

    // Format currency values
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getValueForSeries = (seriesKey: string): string => {
    if (!selectedDate) return "";

    let value: number | undefined;

    // Check if it's a price series or ratio series
    if (seriesKey === "Ratio" || seriesKey === "pullback") {
      value = ratioValues[seriesKey];
    } else {
      value = priceValues[seriesKey];
    }

    return value !== undefined ? formatValue(value, seriesKey) : "";
  };

  // Filter items to only show those that have data
  const availableItems = allLegendItems.filter((item) => {
    if (item.seriesKey === "Ratio" || item.seriesKey === "pullback") {
      return ratioSeriesData[item.seriesKey] && ratioSeriesData[item.seriesKey].length > 0;
    } else {
      return priceSeriesData[item.seriesKey] && priceSeriesData[item.seriesKey].length > 0;
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
