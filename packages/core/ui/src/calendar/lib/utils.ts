export function getDateFromMinutes(minutes: number) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set time to midnight
  now.setMinutes(minutes);
  return now;
}
