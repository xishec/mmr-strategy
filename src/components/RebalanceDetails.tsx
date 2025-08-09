import React from "react";
import { Simulation } from "../core/models";
import { Box, Typography, Chip, Stack } from "@mui/material";

interface RebalanceDetailsProps {
  selectedDate: string | null;
  simulation: Simulation;
}

const RebalanceDetails: React.FC<RebalanceDetailsProps> = ({ selectedDate, simulation }) => {
  const currentSnapshot = simulation.portfolioSnapshots.find((snapshot) => snapshot.date === selectedDate);

  if (!currentSnapshot) {
    return (
      <Typography variant="body2" color="text.secondary">
        No rebalance data available for the selected date.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1" fontWeight="medium" mt={0.25}>
          Big Drop Last 30 Days:
        </Typography>
        <Chip
          label={currentSnapshot.signal.bigDropLast30Days ? "TRUE" : "FALSE"}
          color={currentSnapshot.signal.bigDropLast30Days ? "warning" : "success"}
          variant="outlined"
          size="small"
        />
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1" fontWeight="medium" mt={0.25}>
          Is Below SMA200:
        </Typography>
        <Chip
          label={currentSnapshot.signal.isBelowSMA200 ? "TRUE" : "FALSE"}
          color={currentSnapshot.signal.isBelowSMA200 ? "error" : "success"}
          variant="outlined"
          size="small"
        />
      </Box>
    </Stack>
  );
};

export default RebalanceDetails;
