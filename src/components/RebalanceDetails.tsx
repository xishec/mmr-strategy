import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { formatValue, getRebalanceTypeColor } from "../core/functions";
import { Simulation, RebalanceLog, RebalanceTypeExplanation, D3ChartData } from "../core/models";
import RatioBox from "./RatioBox";

interface RebalanceDetailsProps {
  selectedDate: string | null;
  simulation: Simulation;
  d3ChartData: D3ChartData;
}

const RebalanceDetails: React.FC<RebalanceDetailsProps> = ({ selectedDate, simulation, d3ChartData }) => {
  // Get current rebalance log safely
  const currentRebalanceLog = useMemo(() => {
    if (!selectedDate || !d3ChartData.rebalanceLogsMap || typeof d3ChartData.rebalanceLogsMap !== "object") {
      return null;
    }
    return (d3ChartData.rebalanceLogsMap as Record<string, RebalanceLog>)[selectedDate] || null;
  }, [selectedDate, d3ChartData.rebalanceLogsMap]);

  // Get rebalance color based on rebalance type
  const getRebalanceColor = useMemo(() => {
    if (!currentRebalanceLog) return "grey.300";
    return getRebalanceTypeColor(currentRebalanceLog);
  }, [currentRebalanceLog]);

  const renderRebalanceContent = () => {
    if (!selectedDate || !currentRebalanceLog) {
      return (
        <Box sx={{ gridColumn: "1 / -1", textAlign: "center", color: "text.secondary", p: 4 }}>
          <Typography>Select a date to view rebalance details</Typography>
        </Box>
      );
    }

    const rebalanceLog = simulation.rebalanceLogs.find((snapshot) => snapshot.date === selectedDate);
    if (!rebalanceLog) return null;

    const currentRatio = rebalanceLog.before.investments.ratio;
    const nextRatio = rebalanceLog.after.investments.ratio;
    const total = rebalanceLog.before.investments.total;
    const cumulativeRate = rebalanceLog.cumulativeRateSinceLastRebalance;
    const beforeRatio = rebalanceLog.before.investments.ratio;
    const afterRatio = rebalanceLog.after.investments.ratio;
    const beforeTQQQ = rebalanceLog.before.investments.TQQQ;
    const afterTQQQ = rebalanceLog.after.investments.TQQQ;
    const movedToCash = afterTQQQ - beforeTQQQ;
    const action = movedToCash >= 0 ? "Buying" : "Selling";

    return (
      <>
        {/* Before Ratio Box */}
        <RatioBox
          difference={currentRatio}
          cashBackgroundColor={"grey.300"}
          tqqqBackgroundColor={"grey.400"}
          showSign={false}
        />

        {/* Delta Ratio Box */}
        <RatioBox
          difference={nextRatio - currentRatio}
          cashBackgroundColor={"grey.300"}
          tqqqBackgroundColor={"grey.400"}
          showSign={true}
        />

        {/* Details Text - Center Column */}
        <Box
          sx={{
            height: "100%",
            width: "100%",
            overflow: "auto",
            minWidth: 0,
          }}
        >
          <Typography fontSize={"1rem"} gutterBottom>
            Accumulated performance last {simulation.variables.rebalanceDays} days :{" "}
            <strong style={{ color: getRebalanceColor }}> {formatValue(cumulativeRate, true)} </strong>
          </Typography>
          <Typography fontSize={"1rem"} gutterBottom>
            Before : <strong>{formatValue(total)} </strong> total with <strong>{formatValue(beforeTQQQ)} </strong> (
            {formatValue(beforeRatio, true)}) in TQQQ
          </Typography>
          <Typography fontSize={"1rem"}>
            After :{" "}
            <strong>
              {action} {formatValue(Math.abs(movedToCash))}
            </strong>{" "}
            of TQQQ to have <strong>{formatValue(afterTQQQ)} </strong> ({formatValue(afterRatio, true)}) in TQQQ
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: "rgba(0, 0, 0, 0.03)",
              borderRadius: 2,
              borderLeft: "4px solid",
              borderRight: "4px solid",
              borderColor: getRebalanceColor,
              width: "100%",
            }}
          >
            <Typography fontSize={"0.75rem"} lineHeight={1.5} color="text.primary" sx={{ fontStyle: "italic" }}>
              {RebalanceTypeExplanation[rebalanceLog.rebalanceType as keyof typeof RebalanceTypeExplanation]}
            </Typography>
          </Box>
        </Box>

        {/* After Ratio Box */}
        <RatioBox
          difference={nextRatio}
          cashBackgroundColor={"grey.300"}
          tqqqBackgroundColor={getRebalanceColor}
          showSign={false}
        />
      </>
    );
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        // border: "2px solid",
        // borderColor: "#d4d4d4ff",
        // backgroundColor: "#f7f7f7ff",
        // mx: 4,
        display: "grid",
        gridTemplateColumns: "minmax(60px, auto) minmax(60px, auto) 1fr minmax(60px, auto)",
        gap: 4,
        alignItems: "start",
        minHeight: "200px", // Prevents layout shift
        overflow: "auto", // Allows scrolling if content is too large
      }}
    >
      {renderRebalanceContent()}
    </Box>
  );
};

export default RebalanceDetails;
