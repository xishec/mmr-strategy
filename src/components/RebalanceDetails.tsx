import React from "react";
import { Simulation } from "../core/models";
import { Box } from "@mui/material";

interface RebalanceDetailsProps {
  selectedDate: string | null;
  simulation: Simulation;
}

const RebalanceDetails: React.FC<RebalanceDetailsProps> = ({ selectedDate, simulation }) => {
  const currentSnapshot = simulation.portfolioSnapshots.find((snapshot) => snapshot.date === selectedDate);
  return (
    <Box>
      {currentSnapshot ? (
        <div>
          <h3>Rebalance Details for {currentSnapshot.date}</h3>
          <p>Big Drop Last 30 Days: {currentSnapshot.signal.bigDropLast30Days ? "TRUE" : "FALSE"}</p>
          <p>Is Below SMA200: {currentSnapshot.signal.isBelowSMA200 ? "TRUE" : "FALSE"}</p>
        </div>
      ) : (
        <p>No rebalance data available for the selected date.</p>
      )}
    </Box>
  );
};

export default RebalanceDetails;
