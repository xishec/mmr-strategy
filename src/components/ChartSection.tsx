import React from 'react';
import { Box } from '@mui/material';
import Chart from './Chart';
import Legend from './Legend';
import { ChartData, LegendValues } from '../hooks';

interface ChartSectionProps {
  chartData: ChartData;
  legendValues: LegendValues;
  selectedDate: string | null;
  isLogScale: boolean;
}

const ChartSection: React.FC<ChartSectionProps> = ({
  chartData,
  legendValues,
  selectedDate,
  isLogScale,
}) => {
  return (
    <>
      {/* Legend */}
      <Box sx={{ px: 2, ml: 6 }}>
        <Legend
          priceSeriesData={chartData.priceChart}
          ratioSeriesData={{ ...chartData.ratioChart, ...chartData.pullbackChart }}
          selectedDate={selectedDate}
          priceValues={legendValues.priceValues}
          ratioValues={legendValues.ratioValues}
        />
      </Box>

      {/* Chart */}
      <Box
        sx={{
          minHeight: 0, // Critical: allows grid item to shrink
          minWidth: 0, // Critical: allows grid item to shrink
          overflow: 'hidden', // Prevents content overflow
          contain: 'layout', // Optimizes layout containment
          pl: 2,
        }}
      >
        <Chart
          multiSeriesData={{ ...chartData.priceChart, ...chartData.ratioChart, ...chartData.pullbackChart }}
          rebalanceLogsMap={chartData.rebalanceLogsMap}
          selectedDate={selectedDate}
          isLogScale={isLogScale}
          height="100%"
        />
      </Box>
    </>
  );
};

export default ChartSection;
