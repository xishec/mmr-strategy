import React, { useEffect, useState } from "react";
import { Button, Container, Box, Typography, TextField } from "@mui/material";
import { startSimulation } from "../core/functions";
import { MarketData, Simulation } from "../core/models";

interface BoardProps {
  simulation: Simulation;
  setSimulation: (simulation: Simulation | null) => void;
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({ simulation, setSimulation, marketData }) => {
  // useState variables for each simulation variable
  const [rebalanceDays, setRebalanceDays] = useState<number>(simulation.variables.rebalanceDays);
  const [targetRate, setTargetRate] = useState<number>(simulation.variables.targetRate);
  const [cashDayRate, setCashDayRate] = useState<number>(simulation.variables.CashDayRate);
  const [targetRatio, setTargetRatio] = useState<number>(simulation.variables.TargetRatio);
  const [spikeRate, setSpikeRate] = useState<number>(simulation.variables.SpikeRate);
  const [dropRate, setDropRate] = useState<number>(simulation.variables.DropRate);
  const [doubleDropRate, setDoubleDropRate] = useState<number>(simulation.variables.DoubleDropRate);

  const handleStopSimulation = () => {
    setSimulation({
      ...simulation,
      started: false,
    });
  };

  const handleUpdateVariables = () => {
    const updatedSimulation = {
      ...simulation,
      variables: {
        rebalanceDays,
        targetRate,
        CashDayRate: cashDayRate,
        TargetRatio: targetRatio,
        SpikeRate: spikeRate,
        DropRate: dropRate,
        DoubleDropRate: doubleDropRate,
      }
    };
    setSimulation(updatedSimulation);
  };

  useEffect(() => {
    startSimulation(simulation, setSimulation, marketData);
  }, [simulation, setSimulation, marketData]);

  return (
    <Container maxWidth="md">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Simulation Board
        </Typography>
        
        <Button variant="outlined" color="secondary" onClick={handleStopSimulation} sx={{ mb: 4 }}>
          Stop Simulation
        </Button>

        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Simulation Variables
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
          <TextField
            label="Rebalance Days"
            type="number"
            value={rebalanceDays}
            onChange={(e) => setRebalanceDays(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 1 }
            }}
          />
          
          <TextField
            label="Target Rate"
            type="number"
            value={targetRate}
            onChange={(e) => setTargetRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 }
            }}
          />

          <TextField
            label="Cash Day Rate"
            type="number"
            value={cashDayRate}
            onChange={(e) => setCashDayRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.0001 }
            }}
          />

          <TextField
            label="Target Ratio"
            type="number"
            value={targetRatio}
            onChange={(e) => setTargetRatio(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 }
            }}
          />

          <TextField
            label="Spike Rate"
            type="number"
            value={spikeRate}
            onChange={(e) => setSpikeRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 }
            }}
          />

          <TextField
            label="Drop Rate"
            type="number"
            value={dropRate}
            onChange={(e) => setDropRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 }
            }}
          />

          <TextField
            label="Double Drop Rate"
            type="number"
            value={doubleDropRate}
            onChange={(e) => setDoubleDropRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 }
            }}
          />
        </Box>

        <Button variant="contained" color="primary" onClick={handleUpdateVariables}>
          Update Variables & Restart Simulation
        </Button>
      </Box>
    </Container>
  );
};

export default Board;
