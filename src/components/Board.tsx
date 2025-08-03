import React, { useEffect, useState, useCallback, useRef } from "react";
import { Box, Typography, TextField, FormControlLabel, Switch, Button } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { convertAnnualRateToDaily, runMultipleSimulations, startSimulation } from "../core/functions";
import { MarketData, Simulation, MultiSeriesChartData, RebalanceLog, PortfolioSnapshot } from "../core/models";
import Chart from "./Chart";

// Helper function to format currency values
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

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
  const [targetRate, setTargetRate] = useState<number>(0.1);
  const [cashYearRate, setCashYearRate] = useState<number>(0.0);
  const [targetRatio, setTargetRatio] = useState<number>(0.5);
  const [spikeRate, setSpikeRate] = useState<number>(0.5);
  const [dropRate, setDropRate] = useState<number>(-0.1);
  const [lookBackEnterRate, setLookBackEnterRate] = useState<number>(-0);
  const [lookBackDays, setLookBackDays] = useState<number>(300);
  const [isLogScale, setIsLogScale] = useState<boolean>(true);

  const [priceChart, setPriceChart] = useState<MultiSeriesChartData>({});
  const [ratioChart, setRatioChart] = useState<MultiSeriesChartData>({});
  const [pullbackChart, setPullbackChart] = useState<MultiSeriesChartData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [rebalanceLogsMap, setRebalanceLogsMap] = useState<Record<string, RebalanceLog>>({});

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
      lookBackEnterRate: lookBackEnterRate,
      lookBackDays: lookBackDays,
    },
  });

  // Chart synchronization state
  const chartInstancesRef = useRef<{
    [key: string]: { chart: any; mainSeries: any };
  }>({});
  const crosshairTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointClick = useCallback((date: string, value: number) => {
    // setSelectedDate(date);
  }, []);

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
        lookBackEnterRate: lookBackEnterRate,
        lookBackDays: lookBackDays,
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
    lookBackEnterRate,
    lookBackDays,
  ]);

  // Chart synchronization functions
  const handleChartReady = useCallback((chartId: string, chart: any, mainSeries: any) => {
    chartInstancesRef.current[chartId] = { chart, mainSeries };
  }, []);

  const syncCrosshairToAll = useCallback((date: string | null) => {
    Object.values(chartInstancesRef.current).forEach(({ chart }) => {
      if (date) {
        chart.setCrosshairPosition(0, date);
      } else {
        chart.clearCrosshairPosition();
      }
    });
  }, []);

  const handleCrosshairMove = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      syncCrosshairToAll(date);
    },
    [syncCrosshairToAll]
  );

  const setSelectedDateToLastRebalance = useCallback(() => {
    const lastRebalanceLog = simulation.rebalanceLogs;
    setSelectedDate(lastRebalanceLog[lastRebalanceLog.length - 1]?.date || null);
  }, [simulation]);

  const clearAllCrosshairs = useCallback(() => {
    Object.values(chartInstancesRef.current).forEach(({ chart }) => {
      chart.clearCrosshairPosition();
    });
  }, []);

  const handleCrosshairLeave = useCallback(() => {
    // Clear any existing timeout
    if (crosshairTimeoutRef.current) {
      clearTimeout(crosshairTimeoutRef.current);
    }

    // Add a small delay to ensure the crosshair is properly cleared
    crosshairTimeoutRef.current = setTimeout(() => {
      clearAllCrosshairs();
      setSelectedDateToLastRebalance();
    }, 50);
  }, [clearAllCrosshairs, setSelectedDateToLastRebalance]);

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

  useEffect(() => {
    if (simulation) {
      // Create rebalance logs map for quick lookup by date
      const newRebalanceLogsMap: Record<string, RebalanceLog> = {};
      simulation.rebalanceLogs.forEach((log) => {
        newRebalanceLogsMap[log.date] = log;
      });
      setRebalanceLogsMap(newRebalanceLogsMap);
      setSelectedDateToLastRebalance();

      const portfolioSnapshotsMap: Record<string, PortfolioSnapshot> = {};
      simulation.portfolioSnapshots.forEach((snapshot) => {
        portfolioSnapshotsMap[snapshot.date] = snapshot;
      });

      setPriceChart({
        StrategyTotal: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: portfolioSnapshotsMap[rebalanceLog.date].investments.total,
        })),
        Target: simulation.rebalanceLogs.map((rebalanceLog, i) => ({
          time: rebalanceLog.date,
          value: i > 0 ? simulation.rebalanceLogs[i - 1].nextTarget : rebalanceLog.total,
        })),
        MockTotalQQQ: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: portfolioSnapshotsMap[rebalanceLog.date].investments.mockTotalQQQ,
        })),
        MockTotalTQQQ: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: portfolioSnapshotsMap[rebalanceLog.date].investments.mockTotalTQQQ,
        })),
      });
      setRatioChart({
        Ratio: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: portfolioSnapshotsMap[rebalanceLog.date].investments.ratio,
        })),
      });
      setPullbackChart({
        pullback: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: portfolioSnapshotsMap[rebalanceLog.date].pullback,
        })),
      });
    }
  }, [simulation, setSelectedDateToLastRebalance]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (crosshairTimeoutRef.current) {
        clearTimeout(crosshairTimeoutRef.current);
      }
    };
  }, []);

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
            label="Average last rebalance delta should be higher than this"
            type="number"
            value={lookBackEnterRate}
            onChange={(e) => setLookBackEnterRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 },
            }}
          />

          <TextField
            label="Lookback number of rebalances"
            type="number"
            value={lookBackDays}
            onChange={(e) => setLookBackDays(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 1 },
            }}
          />
          {/* 
          <TextField
            label="Minimum pullback rate"
            type="number"
            value={minMinPullbackRate}
            onChange={(e) => setMinPullbackRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.1 },
            }}
          /> */}

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
        sx={{ height: "95vh", display: "grid", gridTemplateRows: "50px 3fr 1fr 1fr", gap: 0 }}
        onMouseLeave={handleCrosshairLeave}
      >
        <Box>Date</Box>

        {/* Chart Section */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Chart
                multiSeriesData={priceChart}
                onPointClick={handlePointClick}
                syncId="chart1"
                onChartReady={handleChartReady}
                rebalanceLogsMap={rebalanceLogsMap}
                selectedDate={selectedDate}
                onCrosshairMove={handleCrosshairMove}
                onCrosshairLeave={handleCrosshairLeave}
                chartType="price"
                isLogScale={isLogScale}
                height="100%"
              />
            </Box>
          </Box>
        )}

        {/* Ratio Chart Section */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Chart
                multiSeriesData={{ ...ratioChart, ...pullbackChart }}
                onPointClick={handlePointClick}
                syncId="chart3"
                onChartReady={handleChartReady}
                rebalanceLogsMap={rebalanceLogsMap}
                selectedDate={selectedDate}
                onCrosshairMove={handleCrosshairMove}
                onCrosshairLeave={handleCrosshairLeave}
                chartType="ratio-pullback"
                height="100%"
              />
            </Box>
          </Box>
        )}

        <Box>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Rebalance Log Details
          </Typography>

          {selectedDate ? (
            rebalanceLogsMap[selectedDate] ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, fontSize: "0.875rem" }}>
                <Box>
                  <strong>Date:</strong> {selectedDate}
                </Box>
                <Box>
                  <strong>Total:</strong> {formatCurrency(rebalanceLogsMap[selectedDate].total)}
                </Box>
                <Box>
                  <strong>Next Target:</strong>{" "}
                  {rebalanceLogsMap[selectedDate].nextTarget
                    ? formatCurrency(rebalanceLogsMap[selectedDate].nextTarget!)
                    : "N/A"}
                </Box>
                <Box>
                  <strong>Rebalance Type:</strong> {rebalanceLogsMap[selectedDate].rebalanceType}
                </Box>
                <Box>
                  <strong>Reason:</strong> {rebalanceLogsMap[selectedDate].reason}
                </Box>
                <Box>
                  <strong>Cumulative Rate:</strong>{" "}
                  {(rebalanceLogsMap[selectedDate].cumulativeRateSinceLastRebalance * 100).toFixed(2)}%
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
