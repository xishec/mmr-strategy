import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Box, Typography, TextField, FormControlLabel, Switch, Button, Slider, IconButton } from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { convertAnnualRateToDaily, runMultipleSimulations, startSimulation } from "../core/functions";
import { MarketData, Simulation, RebalanceLog, PortfolioSnapshot, RebalanceType } from "../core/models";
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
  const [initialMoney, setInitialMoney] = useState<number>(100000);
  const [rebalanceDays, setRebalanceDays] = useState<number>(90);
  const [targetRate, setTargetRate] = useState<number>(0.15);
  const [cashYearRate, setCashYearRate] = useState<number>(0.0);
  const [targetRatio, setTargetRatio] = useState<number>(0.5);
  const [spikeRate, setSpikeRate] = useState<number>(0.2);
  const [dropRate, setDropRate] = useState<number>(-0.2);
  const [isLogScale, setIsLogScale] = useState<boolean>(true);
  const [monthlyNewCash, setMonthlyNewCash] = useState<number>(2000);

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
      spikeRate: spikeRate,
      dropRate: dropRate,
      monthlyNewCash: monthlyNewCash,
    },
  });

  // Available dates for slider navigation
  const availableDates = useMemo(() => {
    if (!simulation || simulation.rebalanceLogs.length === 0) return [];
    return simulation.rebalanceLogs.map((log) => log.date).sort();
  }, [simulation]);

  // Current selected date based on index
  const selectedDate = availableDates[selectedDateIndex] || null;

  // Handle slider-controlled date selection
  const handleSliderChange = useCallback((_: Event, value: number | number[]) => {
    const index = Array.isArray(value) ? value[0] : value;
    setSelectedDateIndex(index);
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
        spikeRate: spikeRate,
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
    spikeRate,
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
        value: rebalanceLog.currentTarget,
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
        {(ratio * 100).toFixed(2)}%
      </Box>
    </Box>
  );

  return (
    <Box width="100%" height="100vh" display="grid" gridTemplateColumns="1fr 4fr" gap={2} sx={{ p: 4 }}>
      {/* Variables */}
      <Box>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Simulation Setup
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 2, mb: 3 }}>
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
            label="Spike Rate"
            type="number"
            value={spikeRate}
            onChange={(e) => setSpikeRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 },
            }}
          />

          <TextField
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

        <FormControlLabel
          control={<Switch checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)} color="primary" />}
          label="Log Scale"
          sx={{ mt: 2 }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleRunMultipleSimulations}
          sx={{ mt: 2, alignSelf: "start" }}
          disabled={!marketData}
        >
          Run Multiple Simulations (Every 10 Days)
        </Button>
      </Box>

      {/* Rebalance Log Details */}
      <Box
        sx={{
          height: "95vh",
          display: "grid",
          gridTemplateRows: "min-content 4fr min-content 1fr",
          gap: "0",
          padding: "1rem",
        }}
      >
        <Box sx={{ margin: "0 3rem" }}>
          <Legend
            priceSeriesData={chartData.priceChart}
            ratioSeriesData={{ ...chartData.ratioChart, ...chartData.pullbackChart }}
            selectedDate={selectedDate}
            priceValues={legendValues.priceValues}
            ratioValues={legendValues.ratioValues}
          />
        </Box>

        {/* Combined Chart Section */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Chart
              multiSeriesData={{ ...chartData.priceChart, ...chartData.ratioChart, ...chartData.pullbackChart }}
              rebalanceLogsMap={chartData.rebalanceLogsMap}
              selectedDate={selectedDate}
              isLogScale={isLogScale}
              height="100%"
            />
          </Box>
        )}

        {/* Date Navigation Slider */}
        {availableDates.length > 0 && (
          <Box
            display={"grid"}
            alignItems="center"
            gridTemplateColumns={"min-content 1fr min-content"}
            gap={2}
            sx={{ marginTop: "-3.5rem" }}
          >
            <IconButton onClick={handlePreviousDate} disabled={selectedDateIndex === 0} size="small">
              <KeyboardArrowLeft />
            </IconButton>

            <Slider
              color="secondary"
              value={selectedDateIndex}
              onChange={handleSliderChange}
              size="small"
              min={0}
              max={availableDates.length - 1}
              step={1}
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

        <Box
          sx={{
            borderRadius: "0.5rem",
            border: "2px solid",
            borderColor: getRebalanceColor,
            padding: "1rem",
            margin: "0 3rem",
            marginTop: "1.5rem",
            display: "grid",
            gridTemplateColumns: "225px min-content 1fr min-content",
            gap: "2rem",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {selectedDate &&
            currentRebalanceLog &&
            chartData.rebalanceLogsMap &&
            typeof chartData.rebalanceLogsMap === "object" &&
            (chartData.rebalanceLogsMap as Record<string, RebalanceLog>)[selectedDate] && (
              <>
                {(() => {
                  // Calculate slider values for better readability
                  const actualPercentage = currentRebalanceLog.cumulativeRateSinceLastRebalance * 100;
                  const minRange = simulation.variables.dropRate * 2 * 100; // Big Drop threshold
                  const maxRange = simulation.variables.spikeRate * 2 * 100; // Big Spike threshold
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
                      value: simulation.variables.spikeRate * 100,
                      label: `${simulation.variables.spikeRate * 100}% Spike`,
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
                        valueLabelFormat={() => `${actualPercentage.toFixed(2)}%`}
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

                {/* Rectangle with cash and TQQQ amounts */}
                {(() => {
                  const rebalanceLog = simulation.rebalanceLogs.find((snapshot) => snapshot.date === selectedDate);
                  if (!rebalanceLog) return null;

                  const currentRatio = rebalanceLog.currentRatio;
                  const nextRatio = rebalanceLog.nextRatio;

                  return (
                    <>
                      {generateRatioBox(currentRatio)}
                      <Box>hi</Box>
                      {generateRatioBox(nextRatio)}
                    </>
                  );
                })()}
              </>
            )}
        </Box>
      </Box>
    </Box>
  );
};

export default Board;
