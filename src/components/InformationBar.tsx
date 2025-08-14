import React from "react";
import { MarketData, SignalType, Simulation } from "../core/models";
import { Box, Typography, Chip, IconButton, Tooltip } from "@mui/material";
import { Refresh as RefreshIcon, OpenInNew as OpenInNewIcon } from "@mui/icons-material";
import { parseDate } from "../core/date-utils";
import { DataService } from "../core/data-service";
import { getYesterdaySignal } from "../core/core-logic";

interface InformationBarProps {
  marketData: MarketData;
  simulation: Simulation;
  onRefreshData?: () => Promise<void>;
}

const InformationBar: React.FC<InformationBarProps> = ({ marketData, simulation, onRefreshData }) => {
  const lastDate = Object.keys(marketData.QQQ).slice(-1)[0];
  const signal = getYesterdaySignal(lastDate, marketData, Object.keys(marketData.QQQ), simulation);

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Get the last fetch time from DataService
  const getLastDataPullTime = () => {
    const dataService = DataService.getInstance();
    const lastFetchTime = dataService.getLastFetchTime();
    return lastFetchTime > 0 ? new Date(lastFetchTime) : null;
  };

  // Recalculate on every render to ensure it updates after refresh
  const lastDataPullTime = getLastDataPullTime();

  const handleRefresh = async () => {
    if (!onRefreshData || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefreshData();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Box
      display="grid"
      alignItems="center"
      width="100%"
      gridTemplateColumns={{
        sm: "1fr",
        md: "1fr",
        lg: "repeat(5, max-content)",
      }}
      justifyContent={"space-between"}
      gap={1}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h1" fontSize="1.75rem" fontWeight="bold">
          MMR Strategy App
        </Typography>
        <Chip
          sx={{ fontSize: "0.9rem", fontWeight: "bold", border: "2px solid", mt: 0.25, pt: 0.1 }}
          label={process.env.NODE_ENV === "development" ? "DEV" : "PROD"}
          color={process.env.NODE_ENV === "development" ? "warning" : "success"}
          size="small"
          variant="outlined"
        />
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Data pulled :</Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {lastDataPullTime && (
            <strong>
              {lastDataPullTime.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {lastDataPullTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </strong>
          )}
          {onRefreshData && (
            <Tooltip
              title={process.env.NODE_ENV === "development" ? "Refresh local data" : "Refresh market data from GitHub"}
            >
              <IconButton onClick={handleRefresh} disabled={isRefreshing} size="small" color="primary">
                <RefreshIcon className={isRefreshing ? "spin" : ""} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Last market data :</Typography>
        {lastDate && (
          <strong>
            {parseDate(lastDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </strong>
        )}
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Last TQQQ rate :</Typography>
        {lastDate && marketData.TQQQ && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <strong>{marketData.TQQQ[lastDate].rate.toFixed(2)}%</strong>
            <Tooltip title="View TQQQ on TradingView">
              <IconButton
                onClick={() => window.open("https://www.tradingview.com/symbols/NASDAQ-TQQQ/", "_blank")}
                size="small"
                color="primary"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>{" "}
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Current Combined Signal :</Typography>
        {lastDate && (
          <Chip
            sx={{ fontSize: "0.9rem", fontWeight: "bold", border: "2px solid", pt: 0.1, pr: 0.05, width: "75px" }}
            label={signal.signalType}
            color={signal.signalType === SignalType.Sell ? "error" : "success"}
            variant="outlined"
            size="small"
          />
        )}
      </Box>
    </Box>
  );
};

export default InformationBar;
