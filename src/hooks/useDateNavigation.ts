import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Simulation } from "../core/models";

export interface UseDateNavigationReturn {
  selectedDate: string | null;
  availableDates: string[];
  setSelectedDateIndex: (index: number) => void;
}

export const useDateNavigation = (simulation: Simulation): UseDateNavigationReturn => {
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const lastKeyPressTime = useRef<number>(0);
  const keyRepeatThreshold = 100; // milliseconds between moves when holding key

  // Available dates for navigation
  const availableDates = useMemo(() => {
    if (!simulation || simulation.portfolioSnapshots.length === 0) return [];
    return simulation.portfolioSnapshots.map((snapshot) => snapshot.date);
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

  // Keyboard event handler for arrow key navigation with throttling
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if no input elements are focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentTime = Date.now();
      
      // For first press or when enough time has passed since last press
      if (!event.repeat || currentTime - lastKeyPressTime.current >= keyRepeatThreshold) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          handlePreviousDate();
          lastKeyPressTime.current = currentTime;
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          handleNextDate();
          lastKeyPressTime.current = currentTime;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handlePreviousDate, handleNextDate]);

  return {
    selectedDate,
    availableDates,
    setSelectedDateIndex,
  };
};
