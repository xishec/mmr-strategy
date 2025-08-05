import { useState, useCallback, useEffect, useMemo } from 'react';
import { Simulation } from '../core/models';

export interface UseDateNavigationReturn {
  selectedDate: string | null;
  availableDates: string[];
  setSelectedDateIndex: (index: number) => void;
}

export const useDateNavigation = (simulation: Simulation): UseDateNavigationReturn => {
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);

  // Available dates for navigation
  const availableDates = useMemo(() => {
    if (!simulation || simulation.rebalanceLogs.length === 0) return [];
    return simulation.rebalanceLogs.map((log) => log.date).sort();
  }, [simulation]);

  // Current selected date string
  const selectedDate = useMemo(() => {
    if (availableDates.length === 0 || selectedDateIndex >= availableDates.length) return null;
    return availableDates[selectedDateIndex];
  }, [availableDates, selectedDateIndex]);

  // Handle keyboard navigation
  const handlePreviousDate = useCallback(() => {
    setSelectedDateIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextDate = useCallback(() => {
    setSelectedDateIndex((prev) => Math.min(availableDates.length - 1, prev + 1));
  }, [availableDates.length]);

  // Keyboard event handler for arrow key navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if no input elements are focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'ArrowLeft' && !event.repeat) {
        event.preventDefault();
        handlePreviousDate();
      } else if (event.key === 'ArrowRight' && !event.repeat) {
        event.preventDefault();
        handleNextDate();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePreviousDate, handleNextDate]);

  // Update selected date index when simulation data changes
  useEffect(() => {
    if (simulation.rebalanceLogs.length > 0) {
      setSelectedDateIndex(simulation.rebalanceLogs.length - 1);
    }
  }, [simulation.rebalanceLogs]);

  return {
    selectedDate,
    availableDates,
    setSelectedDateIndex,
  };
};
