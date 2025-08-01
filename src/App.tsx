import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { MarketData, Simulation } from "./core/models";
import Lobby from "./components/Lobby";
import Board from "./components/Board";
import { loadData } from "./core/functions";

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
          startingDate: parsedData.startingDate,
          initialMoney: parsedData.initialMoney,
          currentSnapshotIndex: parsedData.currentSnapshotIndex,
          portfolioSnapshots: [],
          variables: parsedData.variables,
        };
        // console.log("Decoded simulation", simulation);
        return simulation;
      } catch (error) {
        console.error("Failed to parse simulation from URL:", error);
        return null;
      }
    }

    return null;
  });

  // State for market data
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    loadData(setDataLoading, setMarketData);
  }, []);

  useEffect(() => {
    // if (marketData) {
    //   console.log("Market data loaded:", marketData);
    // } else {
    //   console.log("Market data is still loading...");
    // }
  }, [marketData]);

  useEffect(() => {
    if (!simulation) return;

    const url = new URL(window.location.href);
    simulation.portfolioSnapshots = [];
    const encodedSimulation = btoa(JSON.stringify(simulation));
    url.searchParams.set("simulation", encodedSimulation);
    window.history.replaceState({}, "", url.toString());
  }, [simulation]);

  const componentsManager = () => {
    if (simulation && simulation.started) {
      if (marketData && !dataLoading) {
        return <Board simulation={simulation} setSimulation={setSimulation} marketData={marketData} />;
      } else {
        return <></>;
      }
    } else {
      return <Lobby setSimulation={setSimulation} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {componentsManager()}
    </ThemeProvider>
  );
}

export default App;
