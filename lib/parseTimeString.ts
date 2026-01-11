/**
 * Parse a time string like "5 minutes", "30 seconds", "2-3 hours" into total seconds.
 * For ranges, uses the lower bound.
 */
export function parseTimeString(timeStr: string): number | null {
  const normalized = timeStr.toLowerCase().trim();

  // Match patterns like "5 minutes", "30 seconds", "2 hours", "5-7 minutes", "1.5 hours"
  const match = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)$/
  );

  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (isNaN(value) || value <= 0) {
    return null;
  }

  // Convert to seconds based on unit
  if (unit.startsWith('sec')) {
    return Math.round(value);
  } else if (unit.startsWith('min')) {
    return Math.round(value * 60);
  } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
    return Math.round(value * 3600);
  }

  return null;
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
