import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Box, Typography, TextField, FormControlLabel, Switch, Button, Slider, IconButton } from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { convertAnnualRateToDaily, runMultipleSimulations, startSimulation } from "../core/functions";
import { MarketData, Simulation, RebalanceLog, PortfolioSnapshot } from "../core/models";
import Chart from "./Chart";
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
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePreviousDate();
      } else if (event.key === "ArrowRight") {
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
      StrategyTotal: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: portfolioSnapshotsMap[rebalanceLog.date].investments.total,
      })),
      Target: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: rebalanceLog.currentTarget,
      })),
      MockTotalQQQ: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: portfolioSnapshotsMap[rebalanceLog.date].investments.mockTotalQQQ,
      })),
      MockTotalTQQQ: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: portfolioSnapshotsMap[rebalanceLog.date].investments.mockTotalTQQQ,
      })),
    };

    const ratioChart = {
      Ratio: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: portfolioSnapshotsMap[rebalanceLog.date].investments.ratio,
      })),
    };

    const pullbackChart = {
      pullback: simulation.rebalanceLogs.map((rebalanceLog) => ({
        time: rebalanceLog.date,
        value: portfolioSnapshotsMap[rebalanceLog.date].pullback,
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

  // Update selected date index when simulation data changes
  useEffect(() => {
    if (simulation.rebalanceLogs.length > 0) {
      setSelectedDateIndex(simulation.rebalanceLogs.length - 1);
    }
  }, [simulation.rebalanceLogs]);

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
        <Legend
          priceSeriesData={chartData.priceChart}
          ratioSeriesData={{ ...chartData.ratioChart, ...chartData.pullbackChart }}
          selectedDate={selectedDate}
          priceValues={legendValues.priceValues}
          ratioValues={legendValues.ratioValues}
        />

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

        <Box>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Rebalance Log Details
          </Typography>

          {selectedDate ? (
            currentRebalanceLog ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, fontSize: "0.875rem" }}>
                <Box>
                  <strong>Rebalance Type:</strong> {currentRebalanceLog.rebalanceType}
                </Box>
                {/* <Box>
                  <strong>Reason:</strong> {currentRebalanceLog.reason}
                </Box> */}
                <Box>
                  <strong>Cumulative Rate:</strong>{" "}
                  {(currentRebalanceLog.cumulativeRateSinceLastRebalance * 100).toFixed(2)}%
                </Box>
                <Box>
                  <strong>Strategy Rate:</strong>{" "}
                  {simulation.annualizedStrategyRate ? (simulation.annualizedStrategyRate * 100).toFixed(2) : "N/A"}%
                </Box>
                <Box>
                  <strong>QQQ Rate:</strong>{" "}
                  {simulation.annualizedQQQRate ? (simulation.annualizedQQQRate * 100).toFixed(2) : "N/A"}%
                </Box>
                <Box>
                  <strong>TQQQ Rate:</strong>{" "}
                  {simulation.annualizedTQQQRate ? (simulation.annualizedTQQQRate * 100).toFixed(2) : "N/A"}%
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No rebalance occurred on {selectedDate}
              </Typography>
            )
          ) : (
            <Typography variant="body2" color="text.secondary">
              Hover over the chart to see rebalance details
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Board;
