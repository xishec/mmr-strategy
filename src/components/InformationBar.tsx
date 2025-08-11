import React from "react";
import { MarketData, Simulation } from "../core/models";
import { Box, Typography, Chip, IconButton, Tooltip } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { parseDate } from "../core/date-utils";

interface InformationBarProps {
  marketData: MarketData;
  simulation: Simulation;
  onRefreshData?: () => Promise<void>;
}

const InformationBar: React.FC<InformationBarProps> = ({ marketData, simulation, onRefreshData }) => {
  const lastSnapshot = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];

  const testVariable = true;

  const [isRefreshing, setIsRefreshing] = React.useState(false);

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
        lg: "repeat(6, max-content)",
      }}
      justifyContent={"space-between"}
      gap={1}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h1" fontSize="1.75rem" fontWeight="bold">
          MMR Strategy App
        </Typography>
        <Chip 
          label={process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD'}
          color={process.env.NODE_ENV === 'development' ? 'warning' : 'success'}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
        />
        {onRefreshData && (
          <Tooltip title={process.env.NODE_ENV === 'development' ? 'Refresh local data' : 'Refresh market data from GitHub'}>
            <IconButton 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              size="small"
              color="primary"
            >
              <RefreshIcon className={isRefreshing ? 'spin' : ''} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Today is :</Typography>
        <strong>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </strong>
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Updated on :</Typography>
        {lastSnapshot && (
          <strong>
            {parseDate(lastSnapshot.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </strong>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">TQQQ rate :</Typography>
        {lastSnapshot && marketData.TQQQ[lastSnapshot.date] && (
          <strong>{marketData.TQQQ[lastSnapshot.date].rate.toFixed(2)}%</strong>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body1">Current Combined Signal :</Typography>
        {lastSnapshot && (
          <Chip
            sx={{ fontWeight: "bolder", border: "2px solid" }}
            label={testVariable ? "ALL-IN" : "PANIC"}
            color={testVariable ? "success" : "error"}
            variant="filled"
            size="small"
          />
        )}
      </Box>
    </Box>
  );
};

export default InformationBar;
