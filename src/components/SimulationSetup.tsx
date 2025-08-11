import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  CardContent,
  InputAdornment,
  Autocomplete,
  IconButton,
} from "@mui/material";
import {
  AttachMoney,
  Schedule,
  CalendarMonth,
  Analytics,
  Refresh,
  MyLocation,
  RadioButtonChecked,
  Replay,
} from "@mui/icons-material";
import { MarketData } from "../core/models";
import { parseDate } from "../core/date-utils";

interface SimulationSetupProps {
  startDate: Date;
  endDate: Date;
  selectedDate?: string | null;
  initialMoney: number;
  cashYearRate: number;
  upMargin: number;
  dropRate: number;
  monthlyNewCash: number;
  simulationYears: number;
  isLogScale: boolean;
  showSignalMarkers: boolean;
  buyAtOpen: boolean;
  simulationFrequencyDays: number;
  simulationAnalysisMinusYears: number;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onInitialMoneyChange: (value: number) => void;
  onCashYearRateChange: (value: number) => void;
  onSMAUpMarginChange: (value: number) => void;
  onSMADownMarginChange: (value: number) => void;
  onMonthlyNewCashChange: (value: number) => void;
  onSimulationYearsChange: (value: number) => void;
  onLogScaleChange: (checked: boolean) => void;
  onShowSignalMarkersChange: (checked: boolean) => void;
  onBuyAtOpenChange: (checked: boolean) => void;
  onRunMultipleSimulations: () => void;
  onSimulationFrequencyDaysChange: (value: number) => void;
  onSimulationAnalysisMinusYearsChange: (value: number) => void;
  marketData: MarketData;
}

const SimulationSetup: React.FC<SimulationSetupProps> = ({
  startDate,
  endDate,
  selectedDate,
  initialMoney,
  cashYearRate,
  upMargin,
  dropRate,
  monthlyNewCash,
  simulationYears,
  isLogScale,
  showSignalMarkers,
  buyAtOpen,
  simulationFrequencyDays,
  simulationAnalysisMinusYears,
  onStartDateChange,
  onEndDateChange,
  onInitialMoneyChange,
  onCashYearRateChange,
  onSMAUpMarginChange,
  onSMADownMarginChange,
  onMonthlyNewCashChange,
  onSimulationYearsChange,
  onLogScaleChange,
  onShowSignalMarkersChange,
  onBuyAtOpenChange,
  onRunMultipleSimulations,
  onSimulationFrequencyDaysChange,
  onSimulationAnalysisMinusYearsChange,
  marketData,
}) => {
  const [waitingForStartDate, setWaitingForStartDate] = useState(false);
  const [waitingForEndDate, setWaitingForEndDate] = useState(false);
  const [lastSelectedDate, setLastSelectedDate] = useState<string | null>(selectedDate ?? null);

  // Effect to handle new date selections when in waiting mode
  React.useEffect(() => {
    // Only apply if selectedDate has actually changed from the last known value
    if (waitingForStartDate && selectedDate && selectedDate !== lastSelectedDate) {
      try {
        const parsedSelectedDate = parseDate(selectedDate);
        onStartDateChange(parsedSelectedDate);
        setWaitingForStartDate(false);
        setLastSelectedDate(selectedDate);
      } catch {
        // If parsing fails, ignore
      }
    } else if (selectedDate !== lastSelectedDate) {
      // Update last selected date even when not waiting
      setLastSelectedDate(selectedDate ?? null);
    }
  }, [selectedDate, waitingForStartDate, onStartDateChange, lastSelectedDate]);

  React.useEffect(() => {
    // Only apply if selectedDate has actually changed from the last known value
    if (waitingForEndDate && selectedDate && selectedDate !== lastSelectedDate) {
      try {
        const parsedSelectedDate = parseDate(selectedDate);
        onEndDateChange(parsedSelectedDate);
        setWaitingForEndDate(false);
        setLastSelectedDate(selectedDate);
      } catch {
        // If parsing fails, ignore
      }
    } else if (selectedDate !== lastSelectedDate) {
      // Update last selected date even when not waiting
      setLastSelectedDate(selectedDate ?? null);
    }
  }, [selectedDate, waitingForEndDate, onEndDateChange, lastSelectedDate]);
  const getAvailableDates = () => {
    try {
      return Object.keys(marketData.QQQ).sort();
    } catch {
      return [];
    }
  };

  const availableDates = getAvailableDates();

  return (
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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr" }, gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Autocomplete
                size="small"
                options={availableDates}
                value={startDate.toISOString().split("T")[0]}
                onChange={(event, newValue) => {
                  if (newValue) {
                    try {
                      const selectedDate = parseDate(newValue);
                      onStartDateChange(selectedDate);
                    } catch {
                      // If parsing fails, ignore the change
                    }
                  } else {
                    onStartDateChange(null);
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Start Date" variant="outlined" fullWidth />}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => {
                  setWaitingForStartDate(true);
                  setWaitingForEndDate(false); // Cancel waiting for end date if active
                }}
                sx={{
                  mb: 0.125,
                  color: waitingForStartDate ? "primary.main" : "inherit",
                  backgroundColor: waitingForStartDate ? "primary.light" : "transparent",
                  "&:hover": {
                    backgroundColor: waitingForStartDate ? "primary.light" : "action.hover",
                  },
                }}
              >
                {waitingForStartDate ? <RadioButtonChecked fontSize="small" /> : <MyLocation fontSize="small" />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  if (availableDates.length > 0) {
                    try {
                      const firstDate = parseDate(availableDates[0]);
                      onStartDateChange(firstDate);
                    } catch {
                      // If parsing fails, ignore
                    }
                  }
                }}
                sx={{
                  mb: 0.125,
                  color: "inherit",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
                title="Reset to first available date"
              >
                <Replay fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Autocomplete
                size="small"
                options={availableDates}
                value={endDate.toISOString().split("T")[0]}
                onChange={(event, newValue) => {
                  if (newValue) {
                    try {
                      const selectedDate = parseDate(newValue);
                      onEndDateChange(selectedDate);
                    } catch {
                      // If parsing fails, ignore the change
                    }
                  } else {
                    onEndDateChange(null);
                  }
                }}
                renderInput={(params) => <TextField {...params} label="End Date" variant="outlined" fullWidth />}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => {
                  setWaitingForEndDate(true);
                  setWaitingForStartDate(false); // Cancel waiting for start date if active
                }}
                sx={{
                  mb: 0.125,
                  color: waitingForEndDate ? "primary.main" : "inherit",
                  backgroundColor: waitingForEndDate ? "primary.light" : "transparent",
                  "&:hover": {
                    backgroundColor: waitingForEndDate ? "primary.light" : "action.hover",
                  },
                }}
              >
                {waitingForEndDate ? <RadioButtonChecked fontSize="small" /> : <MyLocation fontSize="small" />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  if (availableDates.length > 0) {
                    try {
                      const lastDate = parseDate(availableDates[availableDates.length - 1]);
                      onEndDateChange(lastDate);
                    } catch {
                      // If parsing fails, ignore
                    }
                  }
                }}
                sx={{
                  mb: 0.125,
                  color: "inherit",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
                title="Reset to last available date"
              >
                <Replay fontSize="small" />
              </IconButton>
            </Box>
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
                htmlInput: { step: 0.5 },
              }}
            />
            <TextField
              size="small"
              label="SMA Up Margin"
              type="number"
              value={upMargin.toString()}
              onChange={(e) => onSMAUpMarginChange(e.target.value === "" ? 0 : Number(e.target.value))}
              variant="outlined"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
                htmlInput: { step: 0.5 },
              }}
            />
            <TextField
              size="small"
              label="SMA Down Margin"
              type="number"
              value={dropRate.toString()}
              onChange={(e) => onSMADownMarginChange(e.target.value === "" ? 0 : Number(e.target.value))}
              variant="outlined"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
                htmlInput: { step: 0.5 },
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={buyAtOpen}
                  onChange={(e) => onBuyAtOpenChange(e.target.checked)}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {buyAtOpen ? "Buy at open" : "Buy at close"}
                </Typography>
              }
              sx={{ ml: 0 }}
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
          <FormControlLabel
            control={
              <Switch
                checked={showSignalMarkers}
                onChange={(e) => onShowSignalMarkersChange(e.target.checked)}
                color="primary"
                size="medium"
              />
            }
            label={
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Signals Markers
              </Typography>
            }
            sx={{ ml: 0 }}
          />
        </CardContent>
      </Box>

      {/* Multi Simulation Parameters */}
      <Box sx={{ border: "1px solid #7c7c7c80", borderRadius: 2 }}>
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
            Multi Simulation Parameters
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { sx: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              size="small"
              label="Duration"
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
              label="Sample Frequency"
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
              onChange={(e) => onSimulationAnalysisMinusYearsChange(e.target.value === "" ? 0 : Number(e.target.value))}
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

      {/* Action Button */}
      <Box sx={{ mt: 3 }}>
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
          Run Multiple Simulations
        </Button>
      </Box>
    </Box>
  );
};

export default SimulationSetup;
