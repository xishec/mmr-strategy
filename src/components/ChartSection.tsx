import React from 'react';
import { Box } from '@mui/material';
import Chart from './Chart';
import { ChartData } from '../hooks';

interface ChartSectionProps {
  chartData: ChartData;
  selectedDate: string | null;
  isLogScale: boolean;
}

const ChartSection: React.FC<ChartSectionProps> = ({
  chartData,
  selectedDate,
  isLogScale,
}) => {
  return (
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
  );
};

export default ChartSection;
