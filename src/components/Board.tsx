import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Box, Typography, TextField, FormControlLabel, Switch, Button, Slider, IconButton } from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { convertAnnualRateToDaily, formatValue, runMultipleSimulations, startSimulation } from "../core/functions";
import {
  MarketData,
  Simulation,
  RebalanceLog,
  PortfolioSnapshot,
  RebalanceType,
  RebalanceTypeExplanation,
} from "../core/models";
import Chart, { green, red, yellow } from "./Chart";
import Legend from "./Legend";

// Helper function to format date as YYYY-MM-DD in local timezone
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface BoardProps {
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({ marketData }) => {
  const [simulationYears, setSimulationYears] = useState<number>(5);
  const [startDate, setStartDate] = useState<Date>(new Date(2000, 0, 1)); // Year, Month (0-based), Day
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [initialMoney, setInitialMoney] = useState<number>(100);
  const [rebalanceDays, setRebalanceDays] = useState<number>(90);
  const [targetRate, setTargetRate] = useState<number>(0.2);
  const [cashYearRate, setCashYearRate] = useState<number>(0.0);
  const [targetRatio, setTargetRatio] = useState<number>(0.5);
  const [dropRate, setDropRate] = useState<number>(-0.2);
  const [isLogScale, setIsLogScale] = useState<boolean>(true);
  const [monthlyNewCash, setMonthlyNewCash] = useState<number>(2);

  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);

  const [simulation, setSimulation] = useState<Simulation>({
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: {
      initialMoney: initialMoney,
      startDate: formatDateToString(startDate),
      endDate: formatDateToString(endDate),
      rebalanceDays,
      targetRate,
      cashDayRate: convertAnnualRateToDaily(cashYearRate),
      targetRatio: targetRatio,
      dropRate: dropRate,
      monthlyNewCash: monthlyNewCash,
    },
  });

  // Available dates for slider navigation
  const availableDates = useMemo(() => {
    if (!simulation || simulation.rebalanceLogs.length === 0) return [];
    return simulation.rebalanceLogs.map((log) => log.date).sort();
  }, [simulation]);

  // Current selected date string
  const selectedDate = useMemo(() => {
    if (availableDates.length === 0 || selectedDateIndex >= availableDates.length) return null;
    return availableDates[selectedDateIndex];
  }, [availableDates, selectedDateIndex]);

  // Handle slider-controlled date selection
  const handleSliderChange = useCallback((_: Event, value: number | number[]) => {
    const index = Array.isArray(value) ? value[0] : value;
    setSelectedDateIndex(Math.round(index));
  }, []);

  // Handle keyboard navigation
  const handlePreviousDate = useCallback(() => {
    setSelectedDateIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextDate = useCallback(() => {
    setSelectedDateIndex((prev) => Math.min(availableDates.length - 1, prev + 1));
  }, [availableDates.length]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if no input elements are focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "ArrowLeft" && !event.repeat) {
        event.preventDefault();
        handlePreviousDate();
      } else if (event.key === "ArrowRight" && !event.repeat) {
        event.preventDefault();
        handleNextDate();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handlePreviousDate, handleNextDate]);

  // Handle multiple simulations button click
  const handleRunMultipleSimulations = useCallback(() => {
    if (marketData && simulation.variables) {
      console.log(`Starting multiple simulations for ${simulationYears} years each...`);
      runMultipleSimulations(simulation.variables, marketData, simulationYears);
    }
  }, [marketData, simulation.variables, simulationYears]);

  // Auto-update simulation when variables change
  useEffect(() => {
    setSimulation((prevSimulation) => ({
      ...prevSimulation,
      variables: {
        initialMoney: initialMoney,
        startDate: formatDateToString(startDate),
        endDate: formatDateToString(endDate),
        rebalanceDays,
        targetRate,
        cashDayRate: convertAnnualRateToDaily(cashYearRate),
        targetRatio: targetRatio,
        dropRate: dropRate,
        monthlyNewCash: monthlyNewCash,
      },
    }));
  }, [
    startDate,
    endDate,
    initialMoney,
    rebalanceDays,
    targetRate,
    cashYearRate,
    targetRatio,
    dropRate,
    monthlyNewCash,
  ]);

  // Track when simulation needs to be run
  const lastSimulationParams = useRef<string>("");

  useEffect(() => {
    if (marketData && simulation) {
      // Create a key from the simulation parameters that affect the calculation
      const currentParams = JSON.stringify(simulation.variables);

      // Only run simulation if parameters have changed
      if (currentParams !== lastSimulationParams.current) {
        lastSimulationParams.current = currentParams;
        startSimulation(simulation, setSimulation, marketData);
      }
    }
  }, [marketData, simulation, setSimulation]);

  // Memoize expensive chart data calculations
  const chartData = useMemo(() => {
    if (!simulation || simulation.rebalanceLogs.length === 0) {
      return {
        priceChart: {},
        ratioChart: {},
        pullbackChart: {},
        rebalanceLogsMap: {},
      };
    }

    // Create portfolio snapshots map for quick lookup
    const portfolioSnapshotsMap: Record<string, PortfolioSnapshot> = {};
    simulation.portfolioSnapshots.forEach((snapshot) => {
      portfolioSnapshotsMap[snapshot.date] = snapshot;
    });

    // Create rebalance logs map for quick lookup by date
    const newRebalanceLogsMap: Record<string, RebalanceLog> = {};
    simulation.rebalanceLogs.forEach((log) => {
      newRebalanceLogsMap[log.date] = log;
    });

    const priceChart = {
      MockTotalQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalQQQ,
      })),
      MockTotalTQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.mockTotalTQQQ,
      })),
      StrategyTotal: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.total,
      })),
      Target: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: rebalanceLog.before.nextTarget,
      })),
    };

    const ratioChart = {
      Ratio: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.ratio,
      })),
    };

    const pullbackChart = {
      pullback: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.pullback,
      })),
    };

    return {
      priceChart,
      ratioChart,
      pullbackChart,
      rebalanceLogsMap: newRebalanceLogsMap,
    };
  }, [simulation]);

  // Calculate legend values for the selected date
  const legendValues = useMemo(() => {
    if (!selectedDate || !chartData) {
      return { priceValues: {}, ratioValues: {} };
    }

    const priceValues: { [key: string]: number } = {};
    const ratioValues: { [key: string]: number } = {};

    // Get values for each series at the selected date
    Object.entries({
      ...chartData.priceChart,
      ...chartData.ratioChart,
      ...chartData.pullbackChart,
    }).forEach(([seriesName, data]) => {
      const dataPoint = data.find((dp: any) => dp.time === selectedDate);
      if (dataPoint) {
        if (["StrategyTotal", "Target", "MockTotalQQQ", "MockTotalTQQQ"].includes(seriesName)) {
          priceValues[seriesName] = dataPoint.value;
        } else {
          ratioValues[seriesName] = dataPoint.value;
        }
      }
    });

    return { priceValues, ratioValues };
  }, [selectedDate, chartData]);

  // Get current rebalance log safely
  const currentRebalanceLog = useMemo(() => {
    if (!selectedDate || !chartData.rebalanceLogsMap || typeof chartData.rebalanceLogsMap !== "object") {
      return null;
    }
    return (chartData.rebalanceLogsMap as Record<string, RebalanceLog>)[selectedDate] || null;
  }, [selectedDate, chartData.rebalanceLogsMap]);

  // Get rebalance color based on rebalance type
  const getRebalanceColor = useMemo(() => {
    if (!currentRebalanceLog) return "grey.300";
    const { rebalanceType } = currentRebalanceLog;
    if (rebalanceType === RebalanceType.BigSpike || rebalanceType === RebalanceType.Spike) {
      return green;
    } else if (rebalanceType === RebalanceType.Excess || rebalanceType === RebalanceType.Shortfall) {
      return yellow;
    } else if (rebalanceType === RebalanceType.Drop || rebalanceType === RebalanceType.BigDrop) {
      return red;
    } else {
      return "grey.800"; // black/dark grey
    }
  }, [currentRebalanceLog]);

  // Update selected date index when simulation data changes
  useEffect(() => {
    if (simulation.rebalanceLogs.length > 0) {
      setSelectedDateIndex(simulation.rebalanceLogs.length - 1);
    }
  }, [simulation.rebalanceLogs]);

  const generateRatioBox = (ratio: number) => (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "grey.300",
        borderRadius: "0.25rem",
        height: "100%",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Cash section */}
      <Box
        sx={{
          backgroundColor: "grey.400",
          flex: 1 - ratio,
        }}
      />
      {/* TQQQ section */}
      <Box
        sx={{
          backgroundColor: getRebalanceColor,
          flex: ratio,
        }}
      />
      {/* Ratio percentage overlay */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          fontWeight: "bold",
          fontSize: "1rem",
        }}
      >
        {(ratio * 100).toFixed(1)}%
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "300px 1fr", // Flexible sidebar with constraints
        gridTemplateRows: "1fr",
        gap: 2,
        p: 4,
        overflow: "hidden",
        minWidth: 0, // Critical: allows grid items to shrink
      }}
    >
      {/* Variables */}
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
              onChange={(newValue: Date | null) => {
                if (newValue) {
                  setStartDate(newValue);
                }
              }}
              format="yyyy-MM-dd"
            />
          </LocalizationProvider>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue: Date | null) => {
                if (newValue) {
                  setEndDate(newValue);
                }
              }}
              format="yyyy-MM-dd"
            />
          </LocalizationProvider>

          <TextField
            size="small"
            label="Initial Money ($)"
            type="number"
            value={initialMoney}
            onChange={(e) => setInitialMoney(Number(e.target.value))}
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
            onChange={(e) => setRebalanceDays(Number(e.target.value))}
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
            onChange={(e) => setTargetRate(Number(e.target.value))}
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
            onChange={(e) => setCashYearRate(Number(e.target.value))}
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
            onChange={(e) => setTargetRatio(Number(e.target.value))}
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
            onChange={(e) => setDropRate(Number(e.target.value))}
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
            onChange={(e) => setMonthlyNewCash(Number(e.target.value))}
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
            onChange={(e) => setSimulationYears(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 1, min: 1, max: 25 },
            }}
          />
        </Box>

        <Box sx={{ display: "grid", gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)} color="primary" />}
            label="Log Scale"
          />

          <Button
            variant="contained"
            color="primary"
            onClick={handleRunMultipleSimulations}
            disabled={!marketData}
            fullWidth
          >
            Simulation everyday
          </Button>
        </Box>
      </Box>

      {/* Chart and Details Section */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "min-content min-content 1fr 200px",
          overflow: "hidden",
          minWidth: 0, // Critical: allows shrinking
          maxWidth: "100%", // Prevents expansion
        }}
      >
        {/* Legend */}
        <Box sx={{ px: 2, ml: 6 }}>
          <Legend
            priceSeriesData={chartData.priceChart}
            ratioSeriesData={{ ...chartData.ratioChart, ...chartData.pullbackChart }}
            selectedDate={selectedDate}
            priceValues={legendValues.priceValues}
            ratioValues={legendValues.ratioValues}
          />
        </Box>

        {/* Date Navigation Slider */}
        {availableDates.length > 0 && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 2,
              px: 2,
            }}
          >
            <IconButton onClick={handlePreviousDate} disabled={selectedDateIndex === 0} size="small">
              <KeyboardArrowLeft />
            </IconButton>

            <Slider
              color="primary"
              value={selectedDateIndex}
              onChange={handleSliderChange}
              size="small"
              min={0}
              max={availableDates.length - 1}
              step={1}
              valueLabelDisplay="off"
            />

            <IconButton
              onClick={handleNextDate}
              disabled={selectedDateIndex === availableDates.length - 1}
              size="small"
            >
              <KeyboardArrowRight />
            </IconButton>
          </Box>
        )}

        {/* Chart Section - Uses available space */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box
            sx={{
              minHeight: 0, // Critical: allows grid item to shrink
              minWidth: 0, // Critical: allows grid item to shrink
              overflow: "hidden", // Prevents content overflow
              contain: "layout", // Optimizes layout containment
              pl: 2,
            }}
          >
            <Chart
              multiSeriesData={{ ...chartData.priceChart, ...chartData.ratioChart, ...chartData.pullbackChart }}
              rebalanceLogsMap={chartData.rebalanceLogsMap}
              selectedDate={selectedDate}
              isLogScale={isLogScale}
              height="100%"
            />
          </Box>
        )}

        {/* Rebalance Details - Fixed minimum height */}
        <Box
          sx={{
            borderRadius: "0.5rem",
            border: "2px solid",
            borderColor: getRebalanceColor,
            p: 4,
            mx: 4,
            display: "grid",
            gridTemplateColumns: "200px minmax(60px, auto) 1fr minmax(60px, auto)",
            gap: 2,
            alignItems: "start",
            minHeight: "200px", // Prevents layout shift
            overflow: "auto", // Allows scrolling if content is too large
          }}
        >
          {selectedDate &&
          currentRebalanceLog &&
          chartData.rebalanceLogsMap &&
          typeof chartData.rebalanceLogsMap === "object" &&
          (chartData.rebalanceLogsMap as Record<string, RebalanceLog>)[selectedDate] ? (
            (() => {
              const rebalanceLog = simulation.rebalanceLogs.find((snapshot) => snapshot.date === selectedDate);
              if (!rebalanceLog) return null;

              const currentRatio = rebalanceLog.before.investments.ratio;
              const nextRatio = rebalanceLog.after.investments.ratio;
              const total = rebalanceLog.before.investments.total;
              const cumulativeRate = rebalanceLog.cumulativeRateSinceLastRebalance;
              const beforeRatio = rebalanceLog.before.investments.ratio;
              const afterRatio = rebalanceLog.after.investments.ratio;
              const beforeTQQQ = rebalanceLog.before.investments.TQQQ;
              const afterTQQQ = rebalanceLog.after.investments.TQQQ;
              const movedToCash = beforeTQQQ - afterTQQQ;
              const action = movedToCash >= 0 ? "Buying" : "Selling";

              return (
                <>
                  {(() => {
                    // Calculate slider values for better readability
                    const actualPercentage = currentRebalanceLog.cumulativeRateSinceLastRebalance * 100;
                    const minRange = simulation.variables.dropRate * 2 * 100; // Big Drop threshold
                    const maxRange = simulation.variables.targetRate * 2 * 100; // Big Spike threshold
                    const clampedPercentage = Math.max(minRange, Math.min(maxRange, actualPercentage));

                    // Mark positions for the slider
                    const sliderMarks = [
                      { value: minRange, label: `${minRange}% Big Drop` },
                      {
                        value: simulation.variables.dropRate * 100,
                        label: `${simulation.variables.dropRate * 100}% Drop`,
                      },
                      { value: 0, label: "0%" },
                      {
                        value: simulation.variables.targetRate * 100,
                        label: `${simulation.variables.targetRate * 100}% Spike`,
                      },
                      { value: maxRange, label: `${maxRange}% Big Spike` },
                    ];

                    return (
                      <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          position: "relative",
                          overflow: "visible",
                        }}
                      >
                        <Slider
                          orientation="vertical"
                          valueLabelDisplay="on"
                          valueLabelFormat={() => `${actualPercentage.toFixed(1)}%`}
                          track={false}
                          value={clampedPercentage}
                          min={minRange}
                          max={maxRange}
                          marks={sliderMarks}
                          sx={{
                            height: "80%",
                            "& .MuiSlider-thumb": {
                              backgroundColor: getRebalanceColor,
                              width: 16,
                              height: 16,
                              "&:hover": {
                                boxShadow: "none",
                              },
                            },
                            "& .MuiSlider-mark": {
                              backgroundColor: "grey.400",
                              width: 2,
                              height: 2,
                            },
                            "& .MuiSlider-markLabel": {
                              fontSize: "1rem",
                              color: "text.secondary",
                              whiteSpace: "nowrap",
                            },
                            "& .MuiSlider-valueLabel": {
                              backgroundColor: getRebalanceColor,
                              color: "white",
                              fontWeight: "bold",
                              fontSize: "1rem",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              "&:before": {
                                borderColor: getRebalanceColor,
                              },
                            },
                          }}
                          disabled
                        />
                      </Box>
                    );
                  })()}

                  {/* Before Ratio Box */}
                  {generateRatioBox(currentRatio)}

                  {/* Details Text - Center Column */}
                  <Box sx={{ overflow: "auto", minWidth: 0 }}>
                    <Typography fontSize={"1rem"} gutterBottom>
                      <strong>Rate ({simulation.variables.rebalanceDays}d):</strong> {formatValue(cumulativeRate, true)}
                    </Typography>
                    <Typography fontSize={"1rem"} gutterBottom>
                      <strong>Type:</strong> {rebalanceLog.rebalanceType} -{" "}
                      {RebalanceTypeExplanation[rebalanceLog.rebalanceType as keyof typeof RebalanceTypeExplanation]}
                    </Typography>
                    <Typography fontSize={"1rem"} gutterBottom>
                      <strong>Before:</strong> {formatValue(total)} total with {formatValue(beforeTQQQ)} (
                      {formatValue(beforeRatio, true)}) in TQQQ
                    </Typography>
                    <Typography fontSize={"1rem"}>
                      <strong>{action}:</strong> {formatValue(Math.abs(movedToCash))} of TQQQ to have{" "}
                      {formatValue(afterRatio, true)} in TQQQ
                    </Typography>
                  </Box>

                  {/* After Ratio Box */}
                  {generateRatioBox(nextRatio)}
                </>
              );
            })()
          ) : (
            <Box sx={{ gridColumn: "1 / -1", textAlign: "center", color: "text.secondary", p: 4 }}>
              <Typography>Select a date to view rebalance details</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Board;
