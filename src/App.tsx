import React, { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme, CssBaseline, Box, Typography, Button } from "@mui/material";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDataWithErrorHandling = async () => {
      try {
        console.log("Starting data load...");
        await loadData(setDataLoading, setMarketData);
        console.log("Data loaded successfully");
      } catch (error) {
        console.error("Error in App useEffect:", error);
        setError(error instanceof Error ? error.message : "Unknown error occurred");
        setDataLoading(false);
      }
    };
    
    loadDataWithErrorHandling();
  }, []);

  const handleRefreshData = async () => {
    try {
      setError(null);
      await refreshData(setDataLoading, setMarketData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    }
  };

  const componentsManager = () => {
    if (error) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          padding={3}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Error Loading Data
          </Typography>
          <Typography variant="body1" color="textSecondary" gutterBottom textAlign="center">
            {error}
          </Typography>
          <Button variant="contained" onClick={handleRefreshData} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      );
    }
    
    if (dataLoading) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #d3d3d3ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              "@keyframes spin": {
                "0%": { transform: "rotate(0deg)" },
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading market data...
          </Typography>
        </Box>
      );
    }
    
    if (marketData) {
      return <Dashboard marketData={marketData} onRefreshData={handleRefreshData} />;
    }
    
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <Typography variant="h6">
          No data available
        </Typography>
        <Button variant="contained" onClick={handleRefreshData} sx={{ mt: 2 }}>
          Load Data
        </Button>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {componentsManager()}
    </ThemeProvider>
  );
}

export default App;
