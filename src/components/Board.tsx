import React, { useEffect } from "react";
import { Button, Container, Box, Typography } from "@mui/material";
import { startSimulation } from "../core/functions";
import { MarketData, Simulation } from "../core/models";

interface BoardProps {
  simulation: Simulation;
  setSimulation: (simulation: Simulation | null) => void;
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({
  simulation,
  setSimulation,
  marketData,
}) => {
  const handleStopSimulation = () => {
    setSimulation({
      ...simulation,
      started: false,
    });
  };

  useEffect(() => {
    startSimulation(simulation, setSimulation, marketData);
  }, [simulation, setSimulation, marketData]);

  return (
    <Container maxWidth="md">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Simulation Board
        </Typography>{" "}
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleStopSimulation}
          sx={{ mb: 2 }}
        >
          Stop Simulation
        </Button>
      </Box>
    </Container>
  );
};

export default Board;
