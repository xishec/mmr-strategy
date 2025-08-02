import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button, Box, Typography, TextField, FormControlLabel, Switch } from "@mui/material";
import { startSimulation } from "../core/functions";
import { MarketData, Simulation, MultiSeriesChartData, Variables } from "../core/models";
import Chart from "./Chart";

interface BoardProps {
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({ marketData }) => {
  const [startingDate, setStartingDate] = useState<Date>(() => {
    return new Date("2000-01-01");
  });
  const [initialMoney, setInitialMoney] = useState<number>(100);
  const [rebalanceDays, setRebalanceDays] = useState<number>(90);
  const [targetRate, setTargetRate] = useState<number>(0.09);
  const [cashDayRate, setCashDayRate] = useState<number>(0);
  const [targetRatio, setTargetRatio] = useState<number>(0.6);
  const [spikeRate, setSpikeRate] = useState<number>(0.18);
  const [dropRate, setDropRate] = useState<number>(-0.09);
  const [doubleDropRate, setDoubleDropRate] = useState<number>(-0.09);
  const [isLogScale, setIsLogScale] = useState<boolean>(false);

  const [priceChart, setPriceChart] = useState<MultiSeriesChartData>({});
  const [ratioChart, setRatioChart] = useState<MultiSeriesChartData>({});
  const [pullbackChart, setPullbackChart] = useState<MultiSeriesChartData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [simulation, setSimulation] = useState<Simulation | null>({
    started: true,
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
      DoubleDropRate: doubleDropRate,
    } as Variables,
  } as Simulation);

  // Chart synchronization state
  const chartInstancesRef = useRef<{
    [key: string]: { chart: any; mainSeries: any };
  }>({});

  const handleStopSimulation = () => {
    setSimulation(null);
  };

  useEffect(() => {
    console.log(selectedDate);
  }, [selectedDate]);

  const handleUpdateVariables = () => {
    if (!simulation) return;

    const updatedSimulation: Simulation = {
      ...simulation,
      startingDate: startingDate.toISOString().split("T")[0],
      initialMoney: initialMoney,
      variables: {
        rebalanceDays,
        targetRate,
        CashDayRate: cashDayRate,
        TargetRatio: targetRatio,
        SpikeRate: spikeRate,
        DropRate: dropRate,
        DoubleDropRate: doubleDropRate,
      },
    };
    setSimulation(updatedSimulation);
  };

  const handlePointClick = useCallback((date: string, value: number) => {
    setSelectedDate(date);
  }, []);

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
      syncCrosshairToAll(date);
    },
    [syncCrosshairToAll]
  );

  const handleCrosshairLeave = useCallback(() => {
    syncCrosshairToAll(null);
  }, [syncCrosshairToAll]);

  // Track when simulation needs to be run
  const lastSimulationParams = useRef<string>("");

  useEffect(() => {
    if (marketData && simulation && simulation.started) {
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
      setPriceChart({
        Sig9Total: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.investments.Total,
        })),
        Sig9Target: simulation.portfolioSnapshots.map((snapshot) => ({
          time: snapshot.date,
          value: snapshot.nextTarget,
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
  }, [simulation]);

  // If no simulation exists, start one with default values
  useEffect(() => {
    if (!simulation) {
      const date = startingDate.toISOString().split("T")[0];
      const newSimulation: Simulation = {
        started: true,
        startingDate: date,
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
          DoubleDropRate: doubleDropRate,
        },
      };
      setSimulation(newSimulation);
    }
  }, [
    simulation,
    startingDate,
    initialMoney,
    rebalanceDays,
    targetRate,
    cashDayRate,
    targetRatio,
    spikeRate,
    dropRate,
    doubleDropRate,
    setSimulation,
  ]);

  return (
    <Box width="100%" height="100vh" display="grid" gridTemplateColumns="1fr 4fr" gap={2} sx={{ p: 4 }}>
      <Box>
        {simulation && (
          <Button variant="outlined" color="secondary" onClick={handleStopSimulation} sx={{ mb: 4 }}>
            Stop Simulation
          </Button>
        )}

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
            label="Double Drop Rate"
            type="number"
            value={doubleDropRate}
            onChange={(e) => setDoubleDropRate(Number(e.target.value))}
            variant="outlined"
            slotProps={{
              htmlInput: { step: 0.01 },
            }}
          />
        </Box>

        <Button variant="contained" color="primary" onClick={handleUpdateVariables} sx={{ mb: 2 }}>
          {!simulation ? "Start Simulation" : "Update Variables & Restart Simulation"}
        </Button>

        <FormControlLabel
          control={<Switch checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)} color="primary" />}
          label="Log Scale"
          sx={{ mt: 2 }}
        />
      </Box>

      <Box sx={{ height: "95vh", display: "grid", gridTemplateRows: "2fr 1fr", gap: 0 }}>
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
