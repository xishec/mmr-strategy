import React from 'react';
import { Box, Slider, IconButton } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';

interface DateNavigationProps {
  selectedDateIndex: number;
  availableDates: string[];
  onSliderChange: (_: Event, value: number | number[]) => void;
  onPreviousDate: () => void;
  onNextDate: () => void;
}

const DateNavigation: React.FC<DateNavigationProps> = ({
  selectedDateIndex,
  availableDates,
  onSliderChange,
  onPreviousDate,
  onNextDate,
}) => {
  if (availableDates.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 2,
        m: 2,
      }}
    >
      <IconButton onClick={onPreviousDate} disabled={selectedDateIndex === 0} size="small">
        <KeyboardArrowLeft />
      </IconButton>

      <Slider
        color="primary"
        value={selectedDateIndex}
        onChange={onSliderChange}
        size="small"
        min={0}
        max={availableDates.length - 1}
        step={1}
        valueLabelDisplay="off"
      />

      <IconButton
        onClick={onNextDate}
        disabled={selectedDateIndex === availableDates.length - 1}
        size="small"
      >
        <KeyboardArrowRight />
      </IconButton>
    </Box>
  );
};

export default DateNavigation;
