import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { Simulation } from "./core/models";
import Lobby from "./components/Lobby";
import Board from "./components/Board";

const theme = createTheme();

function App() {
  const [simulation, setSimulation] = useState<Simulation | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const simulationParam = urlParams.get("simulation");

    if (simulationParam) {
      try {
        // Decode from base64 first, then parse JSON
        const decodedString = atob(simulationParam);
        const parsedData = JSON.parse(decodedString);

        // Create a proper Simulation object
        const simulation: Simulation = {
          started: parsedData.started,
          startingDate: new Date(parsedData.startingDate),
          initialMoney: parsedData.initialMoney,
        };
        console.log("Decoded simulation", simulation);
        return simulation;
      } catch (error) {
        console.error("Failed to parse simulation from URL:", error);
        return null;
      }
    }

    return null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    // Encode JSON string to base64 before setting URL parameter
    const encodedSimulation = btoa(JSON.stringify(simulation));
    url.searchParams.set("simulation", encodedSimulation);
    window.history.replaceState({}, "", url.toString());
  }, [simulation]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {simulation && simulation.started ? (
        <Board simulation={simulation} setSimulation={setSimulation} />
      ) : (
        <Lobby setSimulation={setSimulation} />
      )}
    </ThemeProvider>
  );
}

export default App;
