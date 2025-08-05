import React from "react";
import { Box } from "@mui/material";

interface RatioBoxProps {
  ratio: number;
  cashBackgroundColor: string;
  tqqqBackgroundColor: string;
}

const RatioBox: React.FC<RatioBoxProps> = ({ ratio, cashBackgroundColor, tqqqBackgroundColor }) => {
  return (
    <Box
      sx={{
        borderRadius: "0.5rem",
        height: "100%",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Cash section */}
      <Box
        sx={{
          backgroundColor: cashBackgroundColor,
          flex: 1 - ratio,
        }}
      />
      {/* TQQQ section */}
      <Box
        sx={{
          backgroundColor: tqqqBackgroundColor,
          flex: ratio,
        }}
      />
      {/* Ratio percentage overlay */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          fontWeight: "bold",
          fontSize: "1rem",
        }}
      >
        {(ratio * 100).toFixed(1)}%
      </Box>
    </Box>
  );
};

export default RatioBox;
