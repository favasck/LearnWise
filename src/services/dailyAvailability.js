import { qatarInstant } from './booking.js';

export function dailyAvailability(form) {
  const { date_from, date_to, time_from, time_to } = form;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!validDate(date_from) || !validDate(date_to) || date_to < date_from)
    throw Error('Choose a valid date range, with the end date on or after the start date.');
  if (![time_from,time_to].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) || time_to <= time_from)
    throw Error('Daily end time must be later than daily start time.');
  const start = Date.parse(date_from), end = Date.parse(date_to);
  if ((end-start)/86400000 >= 366) throw Error('Choose a date range of at most 366 days.');
  const windows = [];
  for (let day = start; day <= end; day += 86400000) {
    const date = new Date(day);
    if (form.exclude_fridays && date.getUTCDay() === 5) continue;
    const label = date.toISOString().slice(0,10);
    windows.push({tutor_id:form.tutor_id, starts_at:qatarInstant(`${label}T${time_from}`),
      ends_at:qatarInstant(`${label}T${time_to}`), mode:form.mode, buffer_min:Number(form.buffer_min)});
  }
  if (!windows.length) throw Error('No dates remain after excluding Fridays.');
  return windows;
}
