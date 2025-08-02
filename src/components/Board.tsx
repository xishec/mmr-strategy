import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button, Container, Box, Typography, TextField, Alert } from "@mui/material";
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

  const [multiSeriesChart, setMultiSeriesChart] = useState<MultiSeriesChartData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);

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
    setSelectedValue(value);
  }, []);

  // Chart synchronization functions
  const getCrosshairDataPoint = useCallback((series: any, param: any) => {
    if (!param.time) {
      return null;
    }
    const dataPoint = param.seriesData.get(series);
    return dataPoint || null;
  }, []);

  const syncCrosshair = useCallback((chart: any, series: any, dataPoint: any) => {
    if (dataPoint) {
      chart.setCrosshairPosition(dataPoint.value, dataPoint.time, series);
      return;
    }
    chart.clearCrosshairPosition();
  }, []);

  const handleChartReady = useCallback((chartId: string, chart: any, mainSeries: any) => {
    chartInstancesRef.current[chartId] = { chart, mainSeries };
    
    // Set up synchronization once both charts are ready
    if (Object.keys(chartInstancesRef.current).length === 2) {
      const chartIds = Object.keys(chartInstancesRef.current);
      const [chart1Id, chart2Id] = chartIds;
      const { chart: chart1, mainSeries: mainSeries1 } = chartInstancesRef.current[chart1Id];
      const { chart: chart2, mainSeries: mainSeries2 } = chartInstancesRef.current[chart2Id];

      // Sync time scale
      chart1.timeScale().subscribeVisibleLogicalRangeChange((timeRange: any) => {
        chart2.timeScale().setVisibleLogicalRange(timeRange);
      });

      chart2.timeScale().subscribeVisibleLogicalRangeChange((timeRange: any) => {
        chart1.timeScale().setVisibleLogicalRange(timeRange);
      });

      // Sync crosshair
      chart1.subscribeCrosshairMove((param: any) => {
        const dataPoint = getCrosshairDataPoint(mainSeries1, param);
        syncCrosshair(chart2, mainSeries2, dataPoint);
      });

      chart2.subscribeCrosshairMove((param: any) => {
        const dataPoint = getCrosshairDataPoint(mainSeries2, param);
        syncCrosshair(chart1, mainSeries1, dataPoint);
      });
    }
  }, [getCrosshairDataPoint, syncCrosshair]);

  useEffect(() => {
    if (simulation.portfolioSnapshots.length === 0) {
      startSimulation(simulation, setSimulation, marketData);
    }
  }, [marketData, simulation, setSimulation]);

  useEffect(() => {
    // Create multi-series data
    setMultiSeriesChart({
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
  }, [simulation.portfolioSnapshots]);

  return (
    <Container maxWidth="xl">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Simulation Board
        </Typography>

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

        {/* Chart Section */}
        {simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
              Portfolio Performance Comparison
            </Typography>

            {/* Legend */}
            <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#FBBC04" }}></Box>
                <Typography variant="body2">Sig9 Total</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box 
                  sx={{ 
                    width: 16, 
                    height: 3, 
                    backgroundColor: "#FBBC04",
                    borderTop: "1px dashed #FBBC04",
                    borderBottom: "1px dashed #FBBC04"
                  }}
                ></Box>
                <Typography variant="body2">Sig9 Target</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#4285F4" }}></Box>
                <Typography variant="body2">Mock Total QQQ</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#EA4335" }}></Box>
                <Typography variant="body2">Mock Total TQQQ</Typography>
              </Box>
            </Box>

            {selectedDate && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Selected Date: {selectedDate} | Portfolio Value: ${selectedValue?.toLocaleString()}
              </Alert>
            )}

            <Chart 
              multiSeriesData={multiSeriesChart} 
              onPointClick={handlePointClick}
              syncId="chart1"
              onChartReady={handleChartReady}
            />
          </Box>
        )}

        {/* Log Scale Chart Section */}
        {simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
              Portfolio Performance Comparison (Log Scale)
            </Typography>

            {/* Legend */}
            <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#FBBC04" }}></Box>
                <Typography variant="body2">Sig9 Total</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box 
                  sx={{ 
                    width: 16, 
                    height: 3, 
                    backgroundColor: "#FBBC04",
                    borderTop: "1px dashed #FBBC04",
                    borderBottom: "1px dashed #FBBC04"
                  }}
                ></Box>
                <Typography variant="body2">Sig9 Target</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#4285F4" }}></Box>
                <Typography variant="body2">Mock Total QQQ</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#EA4335" }}></Box>
                <Typography variant="body2">Mock Total TQQQ</Typography>
              </Box>
            </Box>

            {selectedDate && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Selected Date: {selectedDate} | Portfolio Value: ${selectedValue?.toLocaleString()}
              </Alert>
            )}

            <Chart 
              multiSeriesData={multiSeriesChart} 
              onPointClick={handlePointClick} 
              useLogScale 
              syncId="chart2"
              onChartReady={handleChartReady}
            />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Board;
