import React, { useState } from "react";
import { Typography, Container, Button, Box, TextField } from "@mui/material";
import { Simulation } from "../core/models";

interface LobbyProps {
  setSimulation: (simulation: Simulation) => void;
}

const Lobby: React.FC<LobbyProps> = ({ setSimulation }) => {
  const [startingDate, setStartingDate] = useState<Date>(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  });
  const [initialMoney, setInitialMoney] = useState<number>(100);

  const handleStart = () => {
    const date = startingDate.toISOString().split("T")[0];
    const newSimulation: Simulation = {
      started: true,
      startingDate: date,
      initialMoney: initialMoney,
      currentSnapshotIndex: 0,
      portfolioSnapshots: [],
      variables: {},
    };
    setSimulation(newSimulation);
  };

  return (
    <Container maxWidth="md">
      <Box
        display="grid"
        alignItems="center"
        justifyContent="center"
        sx={{ height: "90vh" }}
      >
        <Box display="grid" gap={3}>
          <Box
            display="flex"
            alignItems="end"
            justifyContent="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h4" component="h4" sx={{ mr: 2 }}>
              Today is
            </Typography>

            <TextField
              variant="standard"
              type="date"
              size="medium"
              value={startingDate.toISOString().split("T")[0]}
              onChange={(e) => setStartingDate(new Date(e.target.value))}
              sx={{ mr: 1, width: "12rem" }}
              slotProps={{
                input: {
                  style: { fontSize: "1.5rem" },
                },
              }}
            />

            <Typography variant="h4" component="h4" sx={{ mr: 2 }}>
              , and I have
            </Typography>

            <TextField
              variant="standard"
              type="number"
              value={initialMoney}
              onChange={(e) => setInitialMoney(Number(e.target.value))}
              sx={{ mr: 1, width: "10rem" }}
              slotProps={{
                input: {
                  style: { fontSize: "1.5rem" },
                },
              }}
            />

            <Typography variant="h4" component="h4" sx={{ mr: 2 }}>
              $.
            </Typography>
          </Box>
          <Box
            display="grid"
            alignItems="center"
            justifyContent="center"
            gridTemplateColumns="50%"
          >
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleStart}
              className="start-button"
              disableElevation
            >
              <Box fontSize="1.5rem" fontWeight="medium">
                Start
              </Box>
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Lobby;
