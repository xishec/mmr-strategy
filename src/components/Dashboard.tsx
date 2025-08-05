import React from "react";
import { Box } from "@mui/material";
import { MarketData } from "../core/models";
import { useSimulation, useDateNavigation, useChartData } from "../hooks";
import SimulationSetup from "./SimulationSetup";
import Legend from "./Legend";
import RebalanceDetails from "./RebalanceDetails";
import SimulationResultsDialog from "./SimulationResultsDialog";
import Chart from "./Chart";

interface DashboardProps {
  marketData: MarketData;
}

const Dashboard: React.FC<DashboardProps> = ({ marketData }) => {
  // Unified simulation state management - now handles both single and multiple simulations
  const {
    simulation,
    variables,
    simulationResults,
    isRunningMultipleSimulations,
    simulationProgress,
    updateVariable,
    runMultipleSimulationsHandler,
  } = useSimulation(marketData);

  // Date navigation
  const { selectedDate, availableDates, setSelectedDateIndex } = useDateNavigation(simulation);

  // Chart data processing
  const { chartData, legendValues } = useChartData(simulation, selectedDate);

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
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gridTemplateRows: "1fr",
        gap: 2,
        p: 4,
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Simulation Setup Sidebar */}
      <SimulationSetup
        startDate={variables.startDate}
        endDate={variables.endDate}
        initialMoney={variables.initialMoney}
        rebalanceDays={variables.rebalanceDays}
        targetRate={variables.targetRate}
        cashYearRate={variables.cashYearRate}
        targetRatio={variables.targetRatio}
        dropRate={variables.dropRate}
        monthlyNewCash={variables.monthlyNewCash}
        simulationYears={variables.simulationYears}
        isLogScale={variables.isLogScale}
        isRunningMultipleSimulations={isRunningMultipleSimulations}
        marketData={marketData}
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
        onTargetRateChange={(value: number) => updateVariable("targetRate", value)}
        onCashYearRateChange={(value: number) => updateVariable("cashYearRate", value)}
        onTargetRatioChange={(value: number) => updateVariable("targetRatio", value)}
        onDropRateChange={(value: number) => updateVariable("dropRate", value)}
        onMonthlyNewCashChange={(value: number) => updateVariable("monthlyNewCash", value)}
        onSimulationYearsChange={(value: number) => updateVariable("simulationYears", value)}
        onLogScaleChange={(checked: boolean) => updateVariable("isLogScale", checked)}
        onRunMultipleSimulations={handleRunMultipleSimulations}
      />

      {/* Main Content Area */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "min-content 1fr min-content",
          overflow: "hidden",
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        {/* Legend */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box sx={{ px: 2, ml: 6 }}>
            <Legend
              priceSeriesData={chartData.priceChart}
              ratioSeriesData={{ ...chartData.ratioChart, ...chartData.pullbackChart }}
              selectedDate={selectedDate}
              priceValues={legendValues.priceValues}
              ratioValues={legendValues.ratioValues}
            />
          </Box>
        )}

        {/* Chart */}
        {simulation && simulation.portfolioSnapshots.length > 0 && (
          <Box
            sx={{
              minHeight: 0, // Critical: allows grid item to shrink
              minWidth: 0, // Critical: allows grid item to shrink
              overflow: "hidden", // Prevents content overflow
              contain: "layout", // Optimizes layout containment
              pl: 2,
            }}
          >
            <Chart
              multiSeriesData={{ ...chartData.priceChart, ...chartData.ratioChart, ...chartData.pullbackChart }}
              rebalanceLogsMap={chartData.rebalanceLogsMap}
              selectedDate={selectedDate}
              isLogScale={variables.isLogScale}
              height="100%"
              onDateChange={handleDateChange}
            />
          </Box>
        )}

        {/* Rebalance Details */}
        <Box sx={{ mx: 4 }}>
          <RebalanceDetails selectedDate={selectedDate} simulation={simulation} chartData={chartData} />
        </Box>
      </Box>

      {/* Results Dialog */}
      <SimulationResultsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        results={simulationResults}
        isLoading={isRunningMultipleSimulations}
        progress={simulationProgress}
        title={`Historical Strategy Performance vs QQQ (${variables.simulationYears} year periods)`}
      />
    </Box>
  );
};

export default Dashboard;
