import React from "react";
import { Button, Container, Box, Typography } from "@mui/material";
import { Simulation } from "../models/models";

interface BoardProps {
  simulation: Simulation;
  setSimulation: (simulation: Simulation | null) => void;
}

const Board: React.FC<BoardProps> = ({ simulation, setSimulation }) => {
  const handleStopSimulation = () => {
    setSimulation({
      ...simulation,
      started: false
    });
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Simulation Board
        </Typography>
        
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={handleStopSimulation}
          sx={{ mb: 2 }}
        >
          Stop Simulation
        </Button>
        
        {/* Board content goes here */}
      </Box>
    </Container>
  );
};

export default Board;
