import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { MarketData } from "./core/models";
import Board from "./components/Board";
import { loadData } from "./core/functions";

const theme = createTheme();

function App() {
  // State for market data
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    loadData(setDataLoading, setMarketData);
  }, []);

  const componentsManager = () => {
    if (marketData && !dataLoading) {
      return <Board marketData={marketData} />;
    } else {
      return <></>;
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
