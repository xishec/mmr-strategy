import React, { useEffect } from "react";
import {
  Button,
  Container,
  Box,
  Typography,
  Paper,
  Divider,
} from "@mui/material";
import { initializeSimulation } from "../core/functions";
import { Simulation } from "../core/models";

interface BoardProps {
  simulation: Simulation;
  setSimulation: (simulation: Simulation | null) => void;
}

const Board: React.FC<BoardProps> = ({ simulation, setSimulation }) => {
  const handleStopSimulation = () => {
    setSimulation({
      ...simulation,
      started: false,
    });
  };

  useEffect(() => {
    initializeSimulation(simulation, setSimulation);
  }, [simulation, setSimulation]);

  return (
    <Container maxWidth="md">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Simulation Board
        </Typography>{" "}
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleStopSimulation}
          sx={{ mb: 2 }}
        >
          Stop Simulation
        </Button>
        {/* Simulation Information */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            Simulation Details
          </Typography>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <Typography variant="body1">
              <strong>Started:</strong> {simulation.started ? "Yes" : "No"}
            </Typography>
            <Typography variant="body1">
              <strong>Starting Date:</strong>{" "}
              {simulation.startingDate.toLocaleDateString()}
            </Typography>
            <Typography variant="body1">
              <strong>Initial Money:</strong> ${simulation.initialMoney}
            </Typography>
            <Typography variant="body1">
              <strong>Current Iteration:</strong>{" "}
              {(simulation.currentIterationNumber ?? 0) + 1}
            </Typography>
            <Typography variant="body1" sx={{ gridColumn: "1 / -1" }}>
              <strong>Total Iterations:</strong>{" "}
              {simulation.iterations?.length ?? 1}
            </Typography>
          </Box>
        </Paper>
        {/* Iterations Display */}
        {simulation.iterations && simulation.iterations.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
              Iterations
            </Typography>
            {simulation.iterations.map((iteration, index) => (
              <Box
                key={index}
                sx={{ mb: 3, p: 2, border: "1px solid #ddd", borderRadius: 1 }}
              >
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  Iteration {index + 1}
                </Typography>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
                  <Typography variant="body2">
                    <strong>Date:</strong> {iteration.date.toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Delta:</strong> {iteration.delta}
                  </Typography>
                  <Typography variant="body2">
                    <strong>TQQQ Money:</strong> $
                    {iteration.portfolio.TQQQMoney.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>SQQQ Money:</strong> $
                    {iteration.portfolio.Cash.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current Target:</strong> $
                    {iteration.currentTarget.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Peak:</strong> ${iteration.peak.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Pullback:</strong> {iteration.pullback}
                  </Typography>
                  {iteration.comment && (
                    <Typography variant="body2" sx={{ gridColumn: "1 / -1" }}>
                      <strong>Comment:</strong> {iteration.comment}
                    </Typography>
                  )}
                  {iteration.adjustments && (
                    <Box sx={{ gridColumn: "1 / -1", mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Adjustments:</strong>
                      </Typography>
                      <Box
                        sx={{
                          ml: 2,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2">
                          Should Skip:{" "}
                          {iteration.adjustments.shouldSkip ? "Yes" : "No"}
                        </Typography>
                        <Typography variant="body2">
                          Should Restart:{" "}
                          {iteration.adjustments.shouldRestart ? "Yes" : "No"}
                        </Typography>
                        <Typography variant="body2">
                          Next TQQQ: $
                          {iteration.adjustments.nextPortfolio.TQQQMoney.toFixed(
                            2
                          )}
                        </Typography>
                        <Typography variant="body2">
                          Next Cash: $
                          {iteration.adjustments.nextPortfolio.Cash.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
                {index < (simulation.iterations?.length ?? 0) - 1 && (
                  <Divider sx={{ mt: 2 }} />
                )}
              </Box>
            ))}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default Board;
