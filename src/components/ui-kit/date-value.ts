// A `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` value as a local `Date`, or
// `undefined` for anything else.
export const parseDateValue = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(
    value.trim(),
  );

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hours = '0', minutes = '0'] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  );

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const pad = (value: number) => String(value).padStart(2, '0');

// `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with `withTime`, in local time.
export const formatDateValue = (date: Date, withTime = false): string => {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return withTime
    ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    : day;
};
