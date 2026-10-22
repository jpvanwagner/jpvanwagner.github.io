/* Converts simulation seconds into the cosmetic wall clock ("07:42 AM"). */

export function clockMinutes(simSeconds, settings) {
  return settings.SHIFT_START_MINUTES + simSeconds * settings.CLOCK_MINUTES_PER_SECOND;
}

export function formatClock(totalMinutes) {
  const hrs24 = Math.floor(totalMinutes / 60) % 24;
  const mins = Math.floor(totalMinutes % 60);
  const period = hrs24 >= 12 ? 'PM' : 'AM';
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  return `${String(hrs12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
}

export function shiftDurationSeconds(settings) {
  return settings.SHIFT_LENGTH_MINUTES / settings.CLOCK_MINUTES_PER_SECOND;
}
