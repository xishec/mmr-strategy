import React, { useMemo } from "react";
import { Box, Typography, Slider } from "@mui/material";
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
    const movedToCash = beforeTQQQ - afterTQQQ;
    const action = movedToCash >= 0 ? "Buying" : "Selling";

    // Calculate slider values for better readability
    const actualPercentage = currentRebalanceLog.cumulativeRateSinceLastRebalance * 100;
    const minRange = simulation.variables.dropRate * 2 * 100; // Big Drop threshold
    const maxRange = -simulation.variables.dropRate * 2 * 100; // Big Spike threshold
    const clampedPercentage = Math.max(minRange, Math.min(maxRange, actualPercentage));

    // Mark positions for the slider
    const sliderMarks = [
      { 
        value: minRange, 
        label: (
          <strong style={{ color: '#EA4335' }}>{`< ${minRange}%`}</strong>
        )
      }, // red
      { 
        value: -20, 
        label: (
          <strong style={{ color: '#FBBC04' }}>{`${minRange / 2}%`}</strong>
        )
      }, // yellow
      { 
        value: 0, 
        label: (
          <strong style={{ color: '#34A853' }}>{`0%`}</strong>
        )
      }, //green
      { 
        value: 20, 
        label: (
          <strong style={{ color: '#34A853' }}>{`${maxRange / 2}%`}</strong>
        )
      }, //green
      { 
        value: maxRange, 
        label: (
          <strong style={{ color: '#34A853' }}>{`> ${maxRange}%`}</strong>
        )
      }, //green
    ];

    return (
      <>
        {/* Vertical Slider */}
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            overflow: "visible",
          }}
        >
          <Slider
            orientation="vertical"
            valueLabelDisplay="on"
            valueLabelFormat={() => `${actualPercentage.toFixed(2)}%`}
            track={false}
            value={clampedPercentage}
            min={minRange}
            max={maxRange}
            marks={sliderMarks}
            sx={{
              height: "80%",
              "& .MuiSlider-thumb": {
                backgroundColor: getRebalanceColor,
                width: 16,
                height: 16,
                "&:hover": {
                  boxShadow: "none",
                },
              },
              "& .MuiSlider-mark": {
                backgroundColor: "grey.400",
                width: 2,
                height: 2,
              },
              "& .MuiSlider-markLabel": {
                fontSize: "1rem",
                whiteSpace: "nowrap",
              },
              "& .MuiSlider-valueLabel": {
                backgroundColor: getRebalanceColor,
                color: "white",
                fontWeight: "bold",
                fontSize: "1rem",
                borderRadius: "4px",
                padding: "2px 6px",
                "&:before": {
                  borderColor: getRebalanceColor,
                },
              },
            }}
            disabled
          />
        </Box>

        {/* Before Ratio Box */}
        <RatioBox ratio={currentRatio} cashBackgroundColor={"grey.200"} tqqqBackgroundColor={"grey.400"} />

        {/* Delta Ratio Box */}
        <RatioBox
          ratio={Math.abs(currentRatio - nextRatio)}
          cashBackgroundColor={"grey.200"}
          tqqqBackgroundColor={"grey.400"}
        />

        {/* Details Text - Center Column */}
        <Box sx={{ overflow: "auto", minWidth: 0 }}>
          <Typography fontSize={"1rem"} gutterBottom>
            <strong>Rate ({simulation.variables.rebalanceDays}d):</strong> {formatValue(cumulativeRate, true)}
          </Typography>
          <Typography fontSize={"1rem"} gutterBottom>
            <strong>Type:</strong> {rebalanceLog.rebalanceType} -{" "}
            {RebalanceTypeExplanation[rebalanceLog.rebalanceType as keyof typeof RebalanceTypeExplanation]}
          </Typography>
          <Typography fontSize={"1rem"} gutterBottom>
            <strong>Before:</strong> {formatValue(total)} total with {formatValue(beforeTQQQ)} (
            {formatValue(beforeRatio, true)}) in TQQQ
          </Typography>
          <Typography fontSize={"1rem"}>
            <strong>{action}:</strong> {formatValue(Math.abs(movedToCash))} of TQQQ to have{" "}
            {formatValue(afterRatio, true)} in TQQQ
          </Typography>
        </Box>

        {/* After Ratio Box */}
        <RatioBox ratio={nextRatio} cashBackgroundColor={"grey.200"} tqqqBackgroundColor={getRebalanceColor} />
      </>
    );
  };

  return (
    <Box
      sx={{
        borderRadius: "0.5rem",
        border: "2px solid",
        borderColor: getRebalanceColor,
        p: 4,
        mx: 4,
        display: "grid",
        gridTemplateColumns: "200px minmax(60px, auto) minmax(60px, auto) 1fr minmax(60px, auto)",
        gap: 2,
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
