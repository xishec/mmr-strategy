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

  const [priceChart, setPriceChart] = useState<MultiSeriesChartData>({});
  const [metadataChart, setMetadataChart] = useState<MultiSeriesChartData>({});
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

  const findClosestRebalanceDate = (date: string) => {
    const rebalanceDates = simulation.rebalanceLogs.map((rebalanceLog) => rebalanceLog.date);
    const closestDate = rebalanceDates.reduce((prev, curr) => {
      return Math.abs(new Date(curr).getTime() - new Date(date).getTime()) <
        Math.abs(new Date(prev).getTime() - new Date(date).getTime())
        ? curr
        : prev;
    });
    return closestDate;
  };

  const handlePointClick = useCallback((date: string, value: number) => {
    const closestRebalanceDate = findClosestRebalanceDate(date);
    setSelectedDate(closestRebalanceDate);
  }, []);

  // Chart synchronization functions
  const getCrosshairDataPoint = useCallback((series: any, param: any) => {
    if (!param.time) {
      return null;
    }
    const dataPoint = param.seriesData.get(series);

    const closestRebalanceDate = findClosestRebalanceDate(dataPoint.time);
    setSelectedDate(closestRebalanceDate);
    return dataPoint || null;
  }, []);

  const syncCrosshair = useCallback((chart: any, series: any, dataPoint: any) => {
    if (dataPoint) {
      chart.setCrosshairPosition(dataPoint.value, dataPoint.time, series);
      return;
    }
    chart.clearCrosshairPosition();
  }, []);

  const handleChartReady = useCallback(
    (chartId: string, chart: any, mainSeries: any) => {
      chartInstancesRef.current[chartId] = { chart, mainSeries };

      // Set up synchronization once all three charts are ready
      if (Object.keys(chartInstancesRef.current).length === 3) {
        const chartIds = Object.keys(chartInstancesRef.current);
        const charts = chartIds.map((id) => chartInstancesRef.current[id]);

        // Clear any existing subscriptions to avoid duplicates
        charts.forEach((chartInstance) => {
          try {
            chartInstance.chart.timeScale().unsubscribeVisibleLogicalRangeChange();
            chartInstance.chart.unsubscribeCrosshairMove();
          } catch (e) {
            // Ignore errors if no subscriptions exist
          }
        });

        // Sync time scale between all charts
        charts.forEach((chartInstance, index) => {
          chartInstance.chart.timeScale().subscribeVisibleLogicalRangeChange((timeRange: any) => {
            charts.forEach((otherChartInstance, otherIndex) => {
              if (index !== otherIndex) {
                try {
                  otherChartInstance.chart.timeScale().setVisibleLogicalRange(timeRange);
                } catch (e) {
                  // Ignore errors if chart is not ready
                }
              }
            });
          });
        });

        // Sync crosshair between all charts
        charts.forEach((chartInstance, index) => {
          chartInstance.chart.subscribeCrosshairMove((param: any) => {
            const dataPoint = getCrosshairDataPoint(chartInstance.mainSeries, param);
            charts.forEach((otherChartInstance, otherIndex) => {
              if (index !== otherIndex) {
                try {
                  syncCrosshair(otherChartInstance.chart, otherChartInstance.mainSeries, dataPoint);
                } catch (e) {
                  // Ignore errors if chart is not ready
                }
              }
            });
          });
        });

        console.log("All three charts synchronized successfully");
      }
    },
    [getCrosshairDataPoint, syncCrosshair]
  );

  useEffect(() => {
    if (simulation.portfolioSnapshots.length === 0) {
      startSimulation(simulation, setSimulation, marketData);
    }
  }, [marketData, simulation, setSimulation]);

  // Clear chart instances when simulation changes to ensure fresh synchronization
  useEffect(() => {
    chartInstancesRef.current = {};
  }, [simulation]);

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
    setMetadataChart({
      Ratio: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.investments.Ratio,
      })),
      pullback: simulation.portfolioSnapshots.map((snapshot) => ({
        time: snapshot.date,
        value: snapshot.pullback,
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
                    borderBottom: "1px dashed #FBBC04",
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
                Selected Date: {selectedDate}
              </Alert>
            )}

            <Chart
              multiSeriesData={priceChart}
              onPointClick={handlePointClick}
              syncId="chart1"
              onChartReady={handleChartReady}
              rebalanceLogs={simulation.rebalanceLogs}
              selectedDate={selectedDate}
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
                    borderBottom: "1px dashed #FBBC04",
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
                Selected Date: {selectedDate}
              </Alert>
            )}

            <Chart
              multiSeriesData={priceChart}
              onPointClick={handlePointClick}
              useLogScale
              syncId="chart2"
              onChartReady={handleChartReady}
              rebalanceLogs={simulation.rebalanceLogs}
              selectedDate={selectedDate}
            />
          </Box>
        )}

        {/* Metadata Chart Section */}
        {simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
              Portfolio Metadata
            </Typography>

            {/* Legend */}
            <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#2962FF" }}></Box>
                <Typography variant="body2">TQQQ Ratio</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 16, height: 3, backgroundColor: "#FF6D00" }}></Box>
                <Typography variant="body2">Pullback</Typography>
              </Box>
            </Box>

            <Chart
              multiSeriesData={metadataChart}
              onPointClick={handlePointClick}
              syncId="chart3"
              onChartReady={handleChartReady}
              selectedDate={selectedDate}
            />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Board;
