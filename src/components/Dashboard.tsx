import React from "react";
import { Box, Card, CardContent, Typography, Fade, Container } from "@mui/material";
import { Analytics, Assessment } from "@mui/icons-material";
import { MarketData } from "../core/models";
import SimulationSetup from "./SimulationSetup";
import Legend from "./Legend";
import SimulationResultsDialog from "./SimulationResultsDialog";
import Chart from "./Chart";
import { useDateNavigation } from "../hooks/useDateNavigation";
import { useSimulation } from "../hooks/useSimulation";
import { useChartData } from "../hooks/useChartData";
import InformationBar from "./RebalanceDetails";

interface DashboardProps {
  marketData: MarketData;
}

const Dashboard: React.FC<DashboardProps> = ({ marketData }) => {
  // Unified simulation state management - now handles both single and multiple simulations
  const { simulation, dashboardVariables, multiSimulationResults, updateVariable, runMultipleSimulationsHandler } =
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

  return (
    <Fade in={true} timeout={500}>
      <Container maxWidth={false} disableGutters sx={{ height: "100vh", bgcolor: "grey.100" }}>
        {/* Main Layout */}
        <Box
          sx={{
            height: "100vh",
            display: "grid",
            gridTemplateColumns: "400px 1fr",
            gridTemplateRows: "min-content min-content 1fr",
            gap: 2,
            p: 2,
            overflow: "hidden",
          }}
        >
          {/* Rebalance Details Section */}
          <Card elevation={0} sx={{ borderRadius: 2, gridColumn: "1/3" }}>
            <CardContent sx={{ p: 4, pt: 3 }}>
              <InformationBar marketData={marketData} simulation={simulation} />
            </CardContent>
          </Card>

          {/* Sidebar - Simulation Setup */}
          <Card elevation={0} sx={{ borderRadius: 2, gridRow: "2/4" }}>
            <CardContent sx={{ p: 4, pt: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Analytics color="primary" fontSize="small" />
                <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 600 }}>
                  Simulation Setup
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure your investment simulation parameters
              </Typography>
              <SimulationSetup
                startDate={new Date(dashboardVariables.simulationVariables.startDate)}
                endDate={new Date(dashboardVariables.simulationVariables.endDate)}
                initialMoney={dashboardVariables.simulationVariables.initialMoney}
                cashYearRate={dashboardVariables.simulationVariables.cashYearRate}
                upMargin={dashboardVariables.simulationVariables.SMAUpMargin * 100} // Convert to percentage
                dropRate={dashboardVariables.simulationVariables.SMADownMargin * 100} // Convert to percentage
                monthlyNewCash={dashboardVariables.simulationVariables.monthlyNewCash}
                simulationYears={dashboardVariables.multiSimulationVariables.simulationDurationYears}
                isLogScale={dashboardVariables.uiVariables.isLogScale}
                simulationFrequencyDays={dashboardVariables.multiSimulationVariables.simulationFrequencyDays}
                simulationAnalysisMinusYears={dashboardVariables.multiSimulationVariables.simulationAnalysisMinusYears}
                onStartDateChange={(newValue: Date | null) => {
                  if (newValue) {
                    const updatedSimulationVariables = {
                      ...dashboardVariables.simulationVariables,
                      startDate: newValue.toISOString().split("T")[0],
                    };
                    updateVariable("simulationVariables", updatedSimulationVariables);
                  }
                }}
                onEndDateChange={(newValue: Date | null) => {
                  if (newValue) {
                    const updatedSimulationVariables = {
                      ...dashboardVariables.simulationVariables,
                      endDate: newValue.toISOString().split("T")[0],
                    };
                    updateVariable("simulationVariables", updatedSimulationVariables);
                  }
                }}
                onInitialMoneyChange={(value: number) => {
                  const updatedSimulationVariables = {
                    ...dashboardVariables.simulationVariables,
                    initialMoney: value,
                  };
                  updateVariable("simulationVariables", updatedSimulationVariables);
                }}
                onCashYearRateChange={(value: number) => {
                  const updatedSimulationVariables = {
                    ...dashboardVariables.simulationVariables,
                    cashYearRate: value,
                  };
                  updateVariable("simulationVariables", updatedSimulationVariables);
                }}
                onSMAUpMarginChange={(value: number) => {
                  const updatedSimulationVariables = {
                    ...dashboardVariables.simulationVariables,
                    SMAUpMargin: value / 100, // Convert from percentage
                  };
                  updateVariable("simulationVariables", updatedSimulationVariables);
                }}
                onSMADownMarginChange={(value: number) => {
                  const updatedSimulationVariables = {
                    ...dashboardVariables.simulationVariables,
                    SMADownMargin: value / 100, // Convert from percentage
                  };
                  updateVariable("simulationVariables", updatedSimulationVariables);
                }}
                onMonthlyNewCashChange={(value: number) => {
                  const updatedSimulationVariables = {
                    ...dashboardVariables.simulationVariables,
                    monthlyNewCash: value,
                  };
                  updateVariable("simulationVariables", updatedSimulationVariables);
                }}
                onSimulationYearsChange={(value: number) => {
                  const updatedMultiSimulationVariables = {
                    ...dashboardVariables.multiSimulationVariables,
                    simulationDurationYears: value,
                  };
                  updateVariable("multiSimulationVariables", updatedMultiSimulationVariables);
                }}
                onLogScaleChange={(checked: boolean) => {
                  const updatedUIVariables = {
                    ...dashboardVariables.uiVariables,
                    isLogScale: checked,
                  };
                  updateVariable("uiVariables", updatedUIVariables);
                }}
                onSimulationFrequencyDaysChange={(value: number) => {
                  const updatedMultiSimulationVariables = {
                    ...dashboardVariables.multiSimulationVariables,
                    simulationFrequencyDays: value,
                  };
                  updateVariable("multiSimulationVariables", updatedMultiSimulationVariables);
                }}
                onSimulationAnalysisMinusYearsChange={(value: number) => {
                  const updatedMultiSimulationVariables = {
                    ...dashboardVariables.multiSimulationVariables,
                    simulationAnalysisMinusYears: value,
                  };
                  updateVariable("multiSimulationVariables", updatedMultiSimulationVariables);
                }}
                onRunMultipleSimulations={handleRunMultipleSimulations}
              />
            </CardContent>
          </Card>

          {/* Legend Section */}
          <Card elevation={0} sx={{ borderRadius: 2, overflow: "visible" }}>
            <CardContent sx={{ p: 4 }}>
              <Legend d3ChartData={d3ChartData} selectedDate={selectedDate} />
            </CardContent>
          </Card>

          {/* Chart Section */}
          <Card
            elevation={0}
            sx={{
              borderRadius: 2,
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardContent sx={{ p: 4, pt: 3, pb: 0, flex: 1, display: "flex", flexDirection: "column" }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Chart
                  d3ChartData={d3ChartData}
                  selectedDate={selectedDate}
                  isLogScale={dashboardVariables.uiVariables.isLogScale}
                  height="100%"
                  onDateChange={handleDateChange}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Results Dialog */}
        <SimulationResultsDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          multiSimulationResults={multiSimulationResults}
          title={`Historical Strategy Performance vs QQQ (${dashboardVariables.multiSimulationVariables.simulationDurationYears} year periods)`}
        />
      </Container>
    </Fade>
  );
};

export default Dashboard;
