import { useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDailyNotes, useCalendarData, formatDateString } from '../../hooks/useDailyNotes';
import { useStore } from '../../store';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';

export function DailyNotesPanel() {
  const {
    dailyNotes,
    currentDate,
    isLoading,
    error,
    openDailyNote,
    navigateMonth,
    goToToday,
    refresh,
  } = useDailyNotes();

  const openFile = useStore((state) => state.openFile);

  // Defensive check: ensure dailyNotes is an array
  const safeDailyNotes = Array.isArray(dailyNotes) ? dailyNotes : [];
  const calendarData = useCalendarData(currentDate, safeDailyNotes);

  const handleDateClick = useCallback(async (date: Date) => {
    const path = await openDailyNote(date);
    if (path) {
      openFile(path);
    }
  }, [openDailyNote, openFile]);

  const handleTodayClick = useCallback(async () => {
    goToToday();
    const path = await openDailyNote(new Date());
    if (path) {
      openFile(path);
    }
  }, [goToToday, openDailyNote, openFile]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Calendar className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-sm text-red-500 mb-2">Failed to load daily notes</p>
        <p className="text-xs text-text-faint mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  const todayStr = formatDateString(new Date());

  return (
    <div className="flex flex-col h-full">
      {/* Header with today button */}
      <div className="px-4 py-3 border-b border-background-modifier-border">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleTodayClick}
          leftIcon={<Calendar className="h-4 w-4" />}
        >
          Open Today's Note
        </Button>
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-background-modifier-border">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 rounded hover:bg-background-modifier-hover text-text-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-normal">
            {calendarData.monthName} {calendarData.year}
          </span>
          {isLoading && <Spinner size="sm" />}
        </div>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 rounded hover:bg-background-modifier-hover text-text-muted"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <CalendarGrid
          weeks={calendarData.weeks}
          daysOfWeek={calendarData.daysOfWeek}
          todayStr={todayStr}
          onDateClick={handleDateClick}
        />

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-text-faint">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-interactive-accent" />
            <span>Has note</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full border border-interactive-accent" />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Stats footer */}
      <div className="px-4 py-2 border-t border-background-modifier-border">
        <div className="flex items-center justify-between text-xs text-text-faint">
          <span>{safeDailyNotes.length} daily notes</span>
          <button
            onClick={refresh}
            className={cn(
              'p-1 rounded hover:bg-background-modifier-hover',
              isLoading && 'animate-spin'
            )}
            aria-label="Refresh"
            disabled={isLoading}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface CalendarGridProps {
  weeks: Array<Array<{ date: Date; isCurrentMonth: boolean; hasNote: boolean } | null>>;
  daysOfWeek: string[];
  todayStr: string;
  onDateClick: (date: Date) => void;
}

function CalendarGrid({ weeks, daysOfWeek, todayStr, onDateClick }: CalendarGridProps) {
  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-faint py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, index) => {
          if (!day) return <div key={index} />;

          const dateStr = formatDateString(day.date);
          const isToday = dateStr === todayStr;
          const dayNum = day.date.getDate();

          return (
            <button
              key={dateStr}
              onClick={() => onDateClick(day.date)}
              className={cn(
                'aspect-square flex items-center justify-center',
                'rounded-md text-sm transition-colors',
                'hover:bg-background-modifier-hover',
                'focus:outline-none focus:ring-2 focus:ring-interactive-accent',
                day.isCurrentMonth
                  ? 'text-text-normal'
                  : 'text-text-faint',
                isToday && 'ring-2 ring-interactive-accent',
                day.hasNote && 'bg-interactive-accent/20 font-medium'
              )}
              aria-label={`${dateStr}${day.hasNote ? ' - has note' : ''}${isToday ? ' - today' : ''}`}
            >
              <span className="relative">
                {dayNum}
                {day.hasNote && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-interactive-accent" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
