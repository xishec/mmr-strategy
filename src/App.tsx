import React, { useState } from "react";
import "./App.css";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Typography,
  Container,
  Button,
  Box,
  TextField,
} from "@mui/material";
import { Simulation } from "./models/models";

const theme = createTheme();

function App() {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [startingDate, setStartingDate] = useState<Date>(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  });
  const [initialMoney, setInitialMoney] = useState<number>(100);

  const handleStart = () => {
    // Handle start logic here
    console.log("Starting simulation with:", { startingDate, initialMoney });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md">
        <Box
          display="grid"
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100vh" }}
        >
          <Box display="grid" gap={2}>
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
            <Box display="grid" alignItems="center" justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleStart}
                sx={{ mr: 2 }}
              >
                Start
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
