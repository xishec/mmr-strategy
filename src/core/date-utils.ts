/**
 * Simple date utilities that work consistently with YYYY-MM-DD strings
 * All dates are treated as local dates for simplicity
 */

/**
 * Formats a Date object to YYYY-MM-DD string in local timezone
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a YYYY-MM-DD string to a Date object in local timezone
 */
export const parseDate = (dateString: string): Date => {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const parts = dateString.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateString}`);
  }

  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date components in: ${dateString}`);
  }

  // Create date in local timezone
  return new Date(year, month - 1, day);
};

/**
 * Adds days to a date string and returns a new date string
 */
export const addDays = (dateString: string, days: number): string => {
  const date = parseDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

/**
 * Calculates the difference in days between two date strings
 */
export const daysBetween = (startDate: string, endDate: string): number => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculates the difference in years between two date strings
 */
export const yearsBetween = (startDate: string, endDate: string): number => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365.25);
};

/**
 * Adds years to a date string and returns a new date string
 */
export const addYears = (dateString: string, years: number): string => {
  const date = parseDate(dateString);
  date.setFullYear(date.getFullYear() + years);
  return formatDate(date);
};

/**
 * Gets today's date as YYYY-MM-DD string
 */
export const today = (): string => {
  return formatDate(new Date());
};

/**
 * Checks if a date string is valid
 */
export const isValidDate = (dateString: string): boolean => {
  try {
    parseDate(dateString);
    return true;
  } catch {
    return false;
  }
};

/**
 * Compares two date strings
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export const compareDates = (date1: string, date2: string): number => {
  if (date1 === date2) return 0;
  return date1 < date2 ? -1 : 1;
};
