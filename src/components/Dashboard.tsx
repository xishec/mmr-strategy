import React from "react";
import { Box, Card, CardContent, Typography, Fade, Container } from "@mui/material";
import { Analytics, Assessment } from "@mui/icons-material";
import { MarketData } from "../core/models";
import SimulationSetup from "./SimulationSetup";
import Legend from "./Legend";
import RebalanceDetails from "./RebalanceDetails";
import SimulationResultsDialog from "./SimulationResultsDialog";
import Chart from "./Chart";
import { useDateNavigation } from "../hooks/useDateNavigation";
import { useSimulation } from "../hooks/useSimulation";
import { useChartData } from "../hooks/useChartData";

interface DashboardProps {
  marketData: MarketData;
}

const Dashboard: React.FC<DashboardProps> = ({ marketData }) => {
  // Unified simulation state management - now handles both single and multiple simulations
  const { simulation, variables, analysisResults, updateVariable, runMultipleSimulationsHandler } =
    useSimulation(marketData);

  // Date navigation
  const { selectedDate, availableDates, setSelectedDateIndex } = useDateNavigation(simulation);

  // Chart data processing
  const d3ChartData = useChartData(simulation, selectedDate);

  // Handle date changes from chart interactions
  const handleDateChange = React.useCallback(
    (date: string) => {
      const dateIndex = availableDates.indexOf(date);
      if (dateIndex !== -1) {
        setSelectedDateIndex(dateIndex);
      }
    },
    [availableDates, setSelectedDateIndex]
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);

  const handleRunMultipleSimulations = async () => {
    setDialogOpen(true);
    runMultipleSimulationsHandler();
  };

  const hasSimulationData = simulation && simulation.portfolioSnapshots.length > 0;

  return (
    <Container maxWidth={false} disableGutters sx={{ height: "100vh", bgcolor: "grey.100" }}>
      {/* Main Layout */}
      <Box
        sx={{
          height: "100vh",
          display: "grid",
          gridTemplateColumns: "400px 1fr",
          gridTemplateRows: "1fr",
          gap: 2,
          p: 2,
          overflow: "hidden",
        }}
      >
        <Fade in={true} timeout={500}>
          <Box>
            <SimulationSetup
              startDate={variables.startDate}
              endDate={variables.endDate}
              initialMoney={variables.initialMoney}
              rebalanceDays={variables.rebalanceDays}
              cashYearRate={variables.cashYearRate}
              dropRate={variables.dropRate}
              monthlyNewCash={variables.monthlyNewCash}
              simulationYears={variables.simulationYears}
              isLogScale={variables.isLogScale}
              simulationFrequencyDays={variables.simulationFrequencyDays}
              simulationAnalysisMinusYears={variables.simulationAnalysisMinusYears}
              onStartDateChange={(newValue: Date | null) => {
                if (newValue) {
                  updateVariable("startDate", newValue);
                }
              }}
              onEndDateChange={(newValue: Date | null) => {
                if (newValue) {
                  updateVariable("endDate", newValue);
                }
              }}
              onInitialMoneyChange={(value: number) => updateVariable("initialMoney", value)}
              onRebalanceDaysChange={(value: number) => updateVariable("rebalanceDays", value)}
              onCashYearRateChange={(value: number) => updateVariable("cashYearRate", value)}
              onDropRateChange={(value: number) => updateVariable("dropRate", value)}
              onMonthlyNewCashChange={(value: number) => updateVariable("monthlyNewCash", value)}
              onSimulationYearsChange={(value: number) => updateVariable("simulationYears", value)}
              onLogScaleChange={(checked: boolean) => updateVariable("isLogScale", checked)}
              onSimulationFrequencyDaysChange={(value: number) => updateVariable("simulationFrequencyDays", value)}
              onSimulationAnalysisMinusYearsChange={(value: number) =>
                updateVariable("simulationAnalysisMinusYears", value)
              }
              onRunMultipleSimulations={handleRunMultipleSimulations}
            />
          </Box>
        </Fade>

        {/* Main Content */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {hasSimulationData && (
            <Fade in={true} timeout={750}>
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Legend Section */}
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    overflow: "visible",
                  }}
                >
                  <CardContent sx={{ p: 4, pt: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <Assessment color="primary" fontSize="small" />
                      <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 600 }}>
                        Strategy Performance Overview
                      </Typography>
                    </Box>
                    <Legend d3ChartData={d3ChartData} selectedDate={selectedDate} />
                  </CardContent>
                </Card>

                {/* Chart Section */}
                <Card
                  elevation={0}
                  sx={{
                    flex: 1,
                    borderRadius: 2,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <CardContent sx={{ p: 4, pb: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <Chart
                        d3ChartData={d3ChartData}
                        selectedDate={selectedDate}
                        isLogScale={variables.isLogScale}
                        height="100%"
                        onDateChange={handleDateChange}
                      />
                    </Box>
                  </CardContent>
                </Card>

                {/* Rebalance Details Section */}
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  <CardContent sx={{ p: 4, pt: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
                      <Analytics color="primary" fontSize="small" />
                      <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 600 }}>
                        Rebalance Details
                      </Typography>
                    </Box>
                    <RebalanceDetails selectedDate={selectedDate} simulation={simulation} d3ChartData={d3ChartData} />
                  </CardContent>
                </Card>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {/* Results Dialog */}
      <SimulationResultsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        analysisResults={analysisResults}
        title={`Historical Strategy Performance vs QQQ (${variables.simulationYears} year periods)`}
      />
    </Container>
  );
};

export default Dashboard;
