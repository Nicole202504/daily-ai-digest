function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function zonedDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtc;

  for (let i = 0; i < 4; i += 1) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const observedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const diff = observedUtc - targetUtc;
    if (diff === 0) break;
    guess -= diff;
  }

  return new Date(guess);
}

function formatLocalDate(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getDayWindow(dateText, timeZone) {
  const [year, month, day] = dateText.split("-").map(Number);
  const start = zonedDateTimeToUtc({ year, month, day }, timeZone);
  const next = addDays(dateText, 1);
  const [ny, nm, nd] = next.split("-").map(Number);
  const end = zonedDateTimeToUtc({ year: ny, month: nm, day: nd }, timeZone);
  return {
    date: dateText,
    timeZone,
    start,
    end,
    startUtc: start.toISOString(),
    endUtc: end.toISOString()
  };
}

export function getTodayWindow(timeZone = "Asia/Shanghai", now = new Date()) {
  return getDayWindow(formatLocalDate(now, timeZone), timeZone);
}

export function getPreviousDayWindow(timeZone = "America/Los_Angeles", now = new Date()) {
  return getDayWindow(addDays(formatLocalDate(now, timeZone), -1), timeZone);
}

export function isoHoursAgo(hours, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}
