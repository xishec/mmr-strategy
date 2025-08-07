import React from "react";
import { Box } from "@mui/material";
import { black } from "./Chart";

interface RatioBoxProps {
  difference: number;
  cashBackgroundColor: string;
  tqqqBackgroundColor: string;
  showSign: boolean;
}

const RatioBox: React.FC<RatioBoxProps> = ({ showSign, difference, cashBackgroundColor, tqqqBackgroundColor }) => {
  const sign = difference >= 0 ? "+" : "-";
  const ratio = Math.abs(difference);
  return (
    <Box
      sx={{
        borderRadius: 2,
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
          color: black,
          fontWeight: "bold",
          fontSize: "1rem",
        }}
      >
        {`${showSign ? sign : ""} ${(ratio * 100).toFixed(2)}%`}
      </Box>
    </Box>
  );
};

export default RatioBox;
