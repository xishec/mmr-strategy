import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { MarketData } from "./core/models";
import Dashboard from "./components/Dashboard";
import { loadData, refreshData } from "./core/functions";

const theme = createTheme({
  palette: {
    // primary: {
    //   main: "#ffcb2eff",
    //   light: "#ffe990ff",
    //   dark: "#C79200ff",
    //   contrastText: "#1a1a1aff",
    // },
    primary: {
      main: "#7c7c7cff",
      light: "#edededff",
      dark: "#7d7d7dff",
      contrastText: "#2e2e2eff",
    },
    secondary: {
      main: "#a4a4a4ff",
      light: "#e1e1e1ff",
      dark: "#7d7d7dff",
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

  const handleRefreshData = async () => {
    try {
      await refreshData(setDataLoading, setMarketData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
      // Could show a toast/snackbar here
    }
  };

  const componentsManager = () => {
    if (marketData && !dataLoading) {
      return <Dashboard marketData={marketData} onRefreshData={handleRefreshData} />;
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
