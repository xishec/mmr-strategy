import React from "react";
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  CardContent,
  Paper,
  InputAdornment,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { AttachMoney, Schedule, CalendarMonth, Analytics, Refresh } from "@mui/icons-material";

interface SimulationSetupProps {
  startDate: Date;
  endDate: Date;
  initialMoney: number;
  cashYearRate: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationYears: number;
  isLogScale: boolean;
  simulationFrequencyDays: number;
  simulationAnalysisMinusYears: number;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onInitialMoneyChange: (value: number) => void;
  onCashYearRateChange: (value: number) => void;
  onDropRateChange: (value: number) => void;
  onMonthlyNewCashChange: (value: number) => void;
  onSimulationYearsChange: (value: number) => void;
  onLogScaleChange: (checked: boolean) => void;
  onRunMultipleSimulations: () => void;
  onSimulationFrequencyDaysChange: (value: number) => void;
  onSimulationAnalysisMinusYearsChange: (value: number) => void;
}

const SimulationSetup: React.FC<SimulationSetupProps> = ({
  startDate,
  endDate,
  initialMoney,
  cashYearRate,
  dropRate,
  monthlyNewCash,
  simulationYears,
  isLogScale,
  simulationFrequencyDays,
  simulationAnalysisMinusYears,
  onStartDateChange,
  onEndDateChange,
  onInitialMoneyChange,
  onCashYearRateChange,
  onDropRateChange,
  onMonthlyNewCashChange,
  onSimulationYearsChange,
  onLogScaleChange,
  onRunMultipleSimulations,
  onSimulationFrequencyDaysChange,
  onSimulationAnalysisMinusYearsChange,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: 600,
            color: "primary.main",
            mb: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Analytics />
          Simulation Setup
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your investment simulation parameters
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {/* Date Range Section */}
        <Box sx={{ mb: 3, border: "1px solid #7c7c7c80", borderRadius: 2 }}>
          <CardContent sx={{ pb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "1rem",
              }}
            >
              <CalendarMonth fontSize="small" />
              Date Range
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={onStartDateChange}
                  format="yyyy-MM-dd"
                  sx={{ width: "100%" }}
                  slotProps={{ textField: { size: "small" } }}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={onEndDateChange}
                  format="yyyy-MM-dd"
                  sx={{ width: "100%" }}
                  slotProps={{ textField: { size: "small" } }}
                />
              </LocalizationProvider>
            </Box>
          </CardContent>
        </Box>

        {/* Financial Parameters */}
        <Box sx={{ mb: 3, border: "1px solid #7c7c7c80", borderRadius: 2 }}>
          <CardContent sx={{ pb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "1rem",
              }}
            >
              <AttachMoney fontSize="small" />
              Financial Parameters
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                size="small"
                label="Initial Money"
                type="number"
                value={initialMoney.toString()}
                onChange={(e) => onInitialMoneyChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  },
                  htmlInput: { step: 1 },
                }}
              />
              <TextField
                size="small"
                label="Monthly New Cash"
                type="number"
                value={monthlyNewCash.toString()}
                onChange={(e) => onMonthlyNewCashChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  },
                  htmlInput: { step: 500 },
                }}
              />
              <TextField
                size="small"
                label="Cash Year Rate"
                type="number"
                value={cashYearRate.toString()}
                onChange={(e) => onCashYearRateChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  },
                  htmlInput: { step: 0.01 },
                }}
              />
              <TextField
                size="small"
                label="Drop Rate"
                type="number"
                value={dropRate.toString()}
                onChange={(e) => onDropRateChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  },
                  htmlInput: { step: 0.01 },
                }}
              />
            </Box>
          </CardContent>
        </Box>

        {/* Simulation Parameters */}
        <Box sx={{ mb: 3, border: "1px solid #7c7c7c80", borderRadius: 2 }}>
          <CardContent sx={{ pb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "1rem",
              }}
            >
              <Schedule fontSize="small" />
              Simulation Parameters
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                size="small"
                label="Simulation Years"
                type="number"
                value={simulationYears.toString()}
                onChange={(e) => onSimulationYearsChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">years</InputAdornment>,
                  },
                  htmlInput: { step: 1, min: 1, max: 25 },
                }}
              />
              <TextField
                size="small"
                label="Frequency"
                type="number"
                value={simulationFrequencyDays.toString()}
                onChange={(e) => onSimulationFrequencyDaysChange(e.target.value === "" ? 0 : Number(e.target.value))}
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">days</InputAdornment>,
                  },
                  htmlInput: { step: 1, min: 1 },
                }}
              />
              <TextField
                size="small"
                label="Analysis Minus Years"
                type="number"
                value={simulationAnalysisMinusYears.toString()}
                onChange={(e) =>
                  onSimulationAnalysisMinusYearsChange(e.target.value === "" ? 0 : Number(e.target.value))
                }
                variant="outlined"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">years</InputAdornment>,
                  },
                  htmlInput: { step: 1, min: 0 },
                }}
              />
            </Box>
          </CardContent>
        </Box>

        {/* Display Options */}
        <Box sx={{ mb: 3, border: "1px solid #7c7c7c80", borderRadius: 2 }}>
          <CardContent sx={{ pb: 2 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "1rem",
              }}
            >
              <Analytics fontSize="small" />
              Display Options
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={isLogScale}
                  onChange={(e) => onLogScaleChange(e.target.checked)}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Logarithmic Scale
                </Typography>
              }
              sx={{ ml: 0 }}
            />
          </CardContent>
        </Box>
      </Box>

      {/* Action Button */}
      <Box sx={{ mt: 2, pt: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={onRunMultipleSimulations}
          fullWidth
          size="large"
          startIcon={<Refresh />}
          sx={{
            fontWeight: 600,
            textTransform: "none",
            borderRadius: 2,
          }}
        >
          Run Daily Simulations
        </Button>
      </Box>
    </Paper>
  );
};

export default SimulationSetup;
