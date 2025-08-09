import React from "react";
import { MarketData, Simulation } from "../core/models";
import { Box, Typography, Chip } from "@mui/material";
import { parseDate } from "../core/date-utils";

interface InformationBarProps {
  marketData: MarketData;
  simulation: Simulation;
}

const InformationBar: React.FC<InformationBarProps> = ({ marketData, simulation }) => {
  const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];

  const testVariable = true;

  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" sx={{}}>
      <Typography variant="h6" fontWeight="bold">
        MMR Strategy App
      </Typography>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Today is :</Typography>
        <strong>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </strong>
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Updated on :</Typography>
        {lastSnapshot && (
          <strong>
            {parseDate(lastSnapshot.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </strong>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">TQQQ rate :</Typography>
        {lastSnapshot && <strong>{marketData.TQQQ[lastSnapshot.date].rate.toFixed(2)}%</strong>}
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Current Combined Signal :</Typography>
        {lastSnapshot && (
          <Chip
            sx={{ fontWeight: "bolder", border: "2px solid" }}
            label={testVariable ? "ALL-IN" : "PANIC"}
            color={testVariable ? "success" : "error"}
            variant="outlined"
            size="medium"
          />
        )}
      </Box>
    </Box>
  );
};

export default InformationBar;
