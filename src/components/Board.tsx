import React, { useEffect, useState, useCallback, useRef } from "react";
import { Box, Typography, TextField, FormControlLabel, Switch } from "@mui/material";
import { startSimulation } from "../core/functions";
import { MarketData, Simulation, MultiSeriesChartData, Variables, RebalanceLog } from "../core/models";
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

interface BoardProps {
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({ marketData }) => {
  const [startingDate, setStartingDate] = useState<Date>(() => {
    return new Date("2001-01-01");
  });
  const [initialMoney, setInitialMoney] = useState<number>(100);
  const [rebalanceDays, setRebalanceDays] = useState<number>(92);
  const [targetRate, setTargetRate] = useState<number>(0.09);
  const [cashDayRate, setCashDayRate] = useState<number>(0);
  const [targetRatio, setTargetRatio] = useState<number>(0.6);
  const [spikeRate, setSpikeRate] = useState<number>(0.18);
  const [dropRate, setDropRate] = useState<number>(-0.06);
  const [bigDropRate, setBigDropRate] = useState<number>(0.01);
  const [isLogScale, setIsLogScale] = useState<boolean>(true);

  const [priceChart, setPriceChart] = useState<MultiSeriesChartData>({});
  const [ratioChart, setRatioChart] = useState<MultiSeriesChartData>({});
  const [pullbackChart, setPullbackChart] = useState<MultiSeriesChartData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [rebalanceLogsMap, setRebalanceLogsMap] = useState<Record<string, RebalanceLog>>({});

  const [simulation, setSimulation] = useState<Simulation>({
    startingDate: startingDate.toISOString().split("T")[0],
    initialMoney: initialMoney,
    portfolioSnapshots: [],
    rebalanceLogs: [],
    variables: {
      rebalanceDays,
      targetRate,
      CashDayRate: cashDayRate,
      TargetRatio: targetRatio,
      SpikeRate: spikeRate,
      DropRate: dropRate,
      BigDropRate: bigDropRate,
    } as Variables,
  } as Simulation);

  // Chart synchronization state
  const chartInstancesRef = useRef<{
    [key: string]: { chart: any; mainSeries: any };
  }>({});
  const crosshairTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointClick = useCallback((date: string, value: number) => {
    // setSelectedDate(date);
  }, []);

  // Auto-update simulation when variables change
  useEffect(() => {
    setSimulation((prevSimulation) => ({
      ...prevSimulation,
      startingDate: startingDate.toISOString().split("T")[0],
      initialMoney: initialMoney,
      variables: {
        rebalanceDays,
        targetRate,
        CashDayRate: cashDayRate,
        TargetRatio: targetRatio,
        SpikeRate: spikeRate,
        DropRate: dropRate,
        BigDropRate: bigDropRate,
      },
    }));
  }, [
    startingDate,
    initialMoney,
    rebalanceDays,
    targetRate,
    cashDayRate,
    targetRatio,
    spikeRate,
    dropRate,
    bigDropRate,
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
      const currentParams = JSON.stringify({
        startingDate: simulation.startingDate,
        initialMoney: simulation.initialMoney,
        variables: simulation.variables,
      });

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
      console.log("newRebalanceLogsMap:", newRebalanceLogsMap);
      setRebalanceLogsMap(newRebalanceLogsMap);
      setSelectedDateToLastRebalance();

      setPriceChart({
        Sig9Total: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.investments.Total,
        })),
        Target: simulation.rebalanceLogs.map((rebalanceLog) => ({
          time: rebalanceLog.date,
          value: rebalanceLog.nextTarget,
        })),
        MockTotalQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.investments.MockTotalQQQ,
        })),
        MockTotalTQQQ: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.investments.MockTotalTQQQ,
        })),
      });
      setRatioChart({
        Ratio: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.investments.Ratio,
        })),
      });
      setPullbackChart({
        pullback: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.pullback,
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
          <TextField
            label="Starting Date"
            type="date"
            value={startingDate.toISOString().split("T")[0]}
            onChange={(e) => setStartingDate(new Date(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 1 },
            }}
          />

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
            label="Cash Day Rate"
            type="number"
            value={cashDayRate}
            onChange={(e) => setCashDayRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.0001 },
            }}
          />

          <TextField
            label="Target Ratio"
            type="number"
            value={targetRatio}
            onChange={(e) => setTargetRatio(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 },
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
            value={bigDropRate}
            onChange={(e) => setBigDropRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.1 },
            }}
          />
        </Box>

        <FormControlLabel
          control={<Switch checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)} color="primary" />}
          label="Log Scale"
          sx={{ mt: 2 }}
        />
      </Box>

      {/* Rebalance Log Details */}
      <Box
        sx={{ height: "95vh", display: "grid", gridTemplateRows: "1fr 4fr 2fr", gap: 0 }}
        onMouseLeave={handleCrosshairLeave}
      >
        <Box sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 1 }}>
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
                  <strong>Cumulative Rate:</strong>{" "}
                  {(rebalanceLogsMap[selectedDate].cumulativeRateSinceLastRebalance * 100).toFixed(2)}%
                </Box>
                <Box>
                  <strong>Rebalance Type:</strong> {rebalanceLogsMap[selectedDate].rebalanceType}
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

        {/* Chart Section */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", mb: 2 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 1, flexShrink: 0 }}>
              Portfolio Performance Comparison
            </Typography>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Chart
                multiSeriesData={priceChart}
                onPointClick={handlePointClick}
                syncId="chart1"
                onChartReady={handleChartReady}
                rebalanceLogs={simulation.rebalanceLogs}
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
            <Typography variant="h5" component="h2" sx={{ mb: 1, flexShrink: 0 }}>
              TQQQ Ratio & Portfolio Pullback
            </Typography>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Chart
                multiSeriesData={{ ...ratioChart, ...pullbackChart }}
                onPointClick={handlePointClick}
                syncId="chart3"
                onChartReady={handleChartReady}
                rebalanceLogs={simulation.rebalanceLogs}
                selectedDate={selectedDate}
                onCrosshairMove={handleCrosshairMove}
                onCrosshairLeave={handleCrosshairLeave}
                chartType="ratio-pullback"
                height="100%"
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Board;
