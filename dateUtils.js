const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const DOW = ["L", "M", "M", "G", "V", "S", "D"];
const STATUS_LABEL = { "": "—", P: "Presente", A: "Assente", F: "Ferie", M: "Malattia" };
const STATUS_CYCLE = ["", "P", "A", "F", "M"];

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function dateKey(y, m, d) {
  // m is 0-based
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function isWeekend(y, m, d) {
  const dow = new Date(y, m, d).getDay();
  return dow === 0 || dow === 6;
}

function isToday(y, m, d) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
}

function dowLabel(y, m, d) {
  const dow = new Date(y, m, d).getDay();
  return DOW[(dow + 6) % 7];
}

/** Parses ?y=&m= query params (m is 1-based in the URL), defaults to the current month. */
function resolveViewMonth(query) {
  const now = new Date();
  let y = parseInt(query.y, 10);
  let m = parseInt(query.m, 10); // 1-based from the URL
  if (!Number.isFinite(y) || y < 2000 || y > 2100) y = now.getFullYear();
  if (!Number.isFinite(m) || m < 1 || m > 12) m = now.getMonth() + 1;
  return { y, m0: m - 1 }; // m0 is 0-based for Date()
}

function prevMonth(y, m0) {
  const d = new Date(y, m0 - 1, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
function nextMonth(y, m0) {
  const d = new Date(y, m0 + 1, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

module.exports = {
  MONTHS,
  DOW,
  STATUS_LABEL,
  STATUS_CYCLE,
  pad,
  dateKey,
  daysInMonth,
  isWeekend,
  isToday,
  dowLabel,
  resolveViewMonth,
  prevMonth,
  nextMonth,
};
