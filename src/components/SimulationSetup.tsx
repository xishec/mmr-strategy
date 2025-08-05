import React from "react";
import { Box, Typography, TextField, FormControlLabel, Switch, Button } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { MarketData } from "../core/models";

interface SimulationSetupProps {
  startDate: Date;
  endDate: Date;
  initialMoney: number;
  rebalanceDays: number;
  targetRate: number;
  cashYearRate: number;
  targetRatio: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationYears: number;
  isLogScale: boolean;
  marketData: MarketData;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onInitialMoneyChange: (value: number) => void;
  onRebalanceDaysChange: (value: number) => void;
  onTargetRateChange: (value: number) => void;
  onCashYearRateChange: (value: number) => void;
  onTargetRatioChange: (value: number) => void;
  onDropRateChange: (value: number) => void;
  onMonthlyNewCashChange: (value: number) => void;
  onSimulationYearsChange: (value: number) => void;
  onLogScaleChange: (checked: boolean) => void;
  onRunMultipleSimulations: () => void;
}

const SimulationSetup: React.FC<SimulationSetupProps> = ({
  startDate,
  endDate,
  initialMoney,
  rebalanceDays,
  targetRate,
  cashYearRate,
  targetRatio,
  dropRate,
  monthlyNewCash,
  simulationYears,
  isLogScale,
  marketData,
  onStartDateChange,
  onEndDateChange,
  onInitialMoneyChange,
  onRebalanceDaysChange,
  onTargetRateChange,
  onCashYearRateChange,
  onTargetRatioChange,
  onDropRateChange,
  onMonthlyNewCashChange,
  onSimulationYearsChange,
  onLogScaleChange,
  onRunMultipleSimulations,
}) => {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 2,
        overflow: "auto",
        minWidth: 0, // Allow shrinking
        maxWidth: "100%", // Prevent expansion
      }}
    >
      <Typography variant="h5" component="h2">
        Simulation Setup
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={onStartDateChange}
            format="yyyy-MM-dd"
          />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={onEndDateChange}
            format="yyyy-MM-dd"
          />
        </LocalizationProvider>

        <TextField
          size="small"
          label="Initial Money ($)"
          type="number"
          value={initialMoney}
          onChange={(e) => onInitialMoneyChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 1 },
          }}
        />

        <TextField
          size="small"
          label="Rebalance Days"
          type="number"
          value={rebalanceDays}
          onChange={(e) => onRebalanceDaysChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 1 },
          }}
        />

        <TextField
          size="small"
          label="Target Rate"
          type="number"
          value={targetRate}
          onChange={(e) => onTargetRateChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 0.01 },
          }}
        />

        <TextField
          size="small"
          label="Cash Year Rate"
          type="number"
          value={cashYearRate}
          onChange={(e) => onCashYearRateChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 0.01 },
          }}
        />

        <TextField
          size="small"
          label="Target Ratio"
          type="number"
          value={targetRatio}
          onChange={(e) => onTargetRatioChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 0.1 },
          }}
        />

        <TextField
          size="small"
          label="Drop Rate"
          type="number"
          value={dropRate}
          onChange={(e) => onDropRateChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 0.01 },
          }}
        />

        <TextField
          size="small"
          label="Monthly new cash"
          type="number"
          value={monthlyNewCash}
          onChange={(e) => onMonthlyNewCashChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 500 },
          }}
        />

        <TextField
          size="small"
          label="Simulation Years (for Multiple Simulations)"
          type="number"
          value={simulationYears}
          onChange={(e) => onSimulationYearsChange(Number(e.target.value))}
          variant="outlined"
          slotProps={{
            htmlInput: { step: 1, min: 1, max: 25 },
          }}
        />
      </Box>

      <Box sx={{ display: "grid", gap: 2 }}>
        <FormControlLabel
          control={<Switch checked={isLogScale} onChange={(e) => onLogScaleChange(e.target.checked)} color="primary" />}
          label="Log Scale"
        />

        <Button
          variant="contained"
          color="primary"
          onClick={onRunMultipleSimulations}
          disabled={!marketData}
          fullWidth
        >
          Simulation everyday
        </Button>
      </Box>
    </Box>
  );
};

export default SimulationSetup;
