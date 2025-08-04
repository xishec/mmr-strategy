import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { MarketData } from "./core/models";
import Board from "./components/Board";
import { loadData } from "./core/functions";

const theme = createTheme({
  palette: {
    secondary: {
      main: "#fabb00ff",
      light: "#ffe990ff",
      dark: "#C79200ff",
      contrastText: "#1a1a1aff",
    },
  },
});

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
