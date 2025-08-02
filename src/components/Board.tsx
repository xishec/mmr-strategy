import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button, Box, Typography, TextField, FormControlLabel, Switch } from "@mui/material";
import { startSimulation } from "../core/functions";
import { MarketData, Simulation, MultiSeriesChartData } from "../core/models";
import Chart from "./Chart";

interface BoardProps {
  simulation: Simulation;
  setSimulation: (simulation: Simulation | null) => void;
  marketData: MarketData;
}

const Board: React.FC<BoardProps> = ({ simulation, setSimulation, marketData }) => {
  // useState variables for each simulation variable
  const [rebalanceDays, setRebalanceDays] = useState<number>(simulation.variables.rebalanceDays);
  const [targetRate, setTargetRate] = useState<number>(simulation.variables.targetRate);
  const [cashDayRate, setCashDayRate] = useState<number>(simulation.variables.CashDayRate);
  const [targetRatio, setTargetRatio] = useState<number>(simulation.variables.TargetRatio);
  const [spikeRate, setSpikeRate] = useState<number>(simulation.variables.SpikeRate);
  const [dropRate, setDropRate] = useState<number>(simulation.variables.DropRate);
  const [doubleDropRate, setDoubleDropRate] = useState<number>(simulation.variables.DoubleDropRate);
  const [isLogScale, setIsLogScale] = useState<boolean>(false);

  const [priceChart, setPriceChart] = useState<MultiSeriesChartData>({});
  const [ratioChart, setRatioChart] = useState<MultiSeriesChartData>({});
  const [pullbackChart, setPullbackChart] = useState<MultiSeriesChartData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Chart synchronization state
  const chartInstancesRef = useRef<{
    [key: string]: { chart: any; mainSeries: any };
  }>({});

  const handleStopSimulation = () => {
    setSimulation({
      ...simulation,
      started: false,
    });
  };

  useEffect(() => {
    console.log(selectedDate);
  }, [selectedDate]);

  const handleUpdateVariables = () => {
    const updatedSimulation = {
      ...simulation,
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

  useEffect(() => {
    startSimulation(simulation, setSimulation, marketData);
    const last = simulation.portfolioSnapshots[simulation.portfolioSnapshots.length - 1];
    console.log("newSimulation", last.investments.Total, simulation.variables);
  }, [marketData, simulation, setSimulation]);

  useEffect(() => {
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
  }, [simulation.portfolioSnapshots]);

  return (
    <Box width="100%" height="100vh" display="grid" gridTemplateColumns="1fr 4fr" gap={2} sx={{ p: 4 }}>
      <Box>
        <Button variant="outlined" color="secondary" onClick={handleStopSimulation} sx={{ mb: 4 }}>
          Stop Simulation
        </Button>

        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Simulation Variables
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 2, mb: 3 }}>
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

        <Button variant="contained" color="primary" onClick={handleUpdateVariables}>
          Update Variables & Restart Simulation
        </Button>

        <FormControlLabel
          control={<Switch checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)} color="primary" />}
          label="Log Scale"
          sx={{ mt: 2 }}
        />
      </Box>

      <Box sx={{ height: "95vh", display: "grid", gridTemplateRows: "2fr 1fr", gap: 0 }}>
        {/* Chart Section */}
        {simulation.portfolioSnapshots.length > 0 && (
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
        {simulation.portfolioSnapshots.length > 0 && (
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
