import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Response from get_daily_note command
 */
export interface DailyNoteResponse {
  path: string;
  date: string;
  exists: boolean;
  content?: string;
}

/**
 * Daily notes state
 */
export interface DailyNotesState {
  dailyNotes: string[];
  currentDate: Date;
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Formats a Date to YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to Date
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Gets the days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Gets the first day of the month (0 = Sunday, 1 = Monday, etc.)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Hook for managing daily notes
 */
export function useDailyNotes() {
  const [state, setState] = useState<DailyNotesState>({
    dailyNotes: [],
    currentDate: new Date(),
    selectedDate: null,
    isLoading: false,
    error: null,
  });

  const fetchDailyNotesList = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await invoke<string[]>('get_daily_notes_list');

      // Defensive check: ensure response is an array
      const notes = Array.isArray(response) ? response : [];

      setState((prev) => ({
        ...prev,
        dailyNotes: notes,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch daily notes',
      }));
    }
  }, []);

  const getDailyNote = useCallback(async (date: string): Promise<DailyNoteResponse | null> => {
    setState((prev) => ({ ...prev, isLoading: true, selectedDate: date }));

    try {
      const response = await invoke<DailyNoteResponse>('get_daily_note', { date });

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
      }));

      return response;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get daily note',
      }));
      return null;
    }
  }, []);

  const openDailyNote = useCallback(async (date: Date): Promise<string | null> => {
    const dateStr = formatDateString(date);
    const response = await getDailyNote(dateStr);
    return response?.path || null;
  }, [getDailyNote]);

  const openTodaysNote = useCallback(async (): Promise<string | null> => {
    return openDailyNote(new Date());
  }, [openDailyNote]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setState((prev) => {
      const newDate = new Date(prev.currentDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return { ...prev, currentDate: newDate };
    });
  }, []);

  const goToToday = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentDate: new Date(),
    }));
  }, []);

  const setCurrentDate = useCallback((date: Date) => {
    setState((prev) => ({
      ...prev,
      currentDate: date,
    }));
  }, []);

  const hasNoteForDate = useCallback((date: Date): boolean => {
    const dateStr = formatDateString(date);
    return state.dailyNotes.includes(dateStr);
  }, [state.dailyNotes]);

  const refresh = useCallback(() => {
    fetchDailyNotesList();
  }, [fetchDailyNotesList]);

  // Fetch daily notes list on mount
  useEffect(() => {
    fetchDailyNotesList();
  }, [fetchDailyNotesList]);

  return {
    ...state,
    fetchDailyNotesList,
    getDailyNote,
    openDailyNote,
    openTodaysNote,
    navigateMonth,
    goToToday,
    setCurrentDate,
    hasNoteForDate,
    refresh,
  };
}

/**
 * Helper hook for calendar view data
 */
export function useCalendarData(currentDate: Date, dailyNotes: string[]) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Defensive check - ensure dailyNotes is an array
  const notes = Array.isArray(dailyNotes) ? dailyNotes : [];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  // Create calendar grid (6 rows x 7 columns)
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean; hasNote: boolean } | null> = [];

  // Previous month days
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthDays - i);
    const dateStr = formatDateString(date);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      hasNote: notes.includes(dateStr),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDateString(date);
    calendarDays.push({
      date,
      isCurrentMonth: true,
      hasNote: notes.includes(dateStr),
    });
  }

  // Next month days to fill remaining slots
  const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    const dateStr = formatDateString(date);
    calendarDays.push({
      date,
      isCurrentMonth: false,
      hasNote: notes.includes(dateStr),
    });
  }

  // Split into weeks
  const weeks: typeof calendarDays[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const yearStr = year.toString();

  return {
    weeks,
    monthName,
    year: yearStr,
    daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  };
}
