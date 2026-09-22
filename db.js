const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/app.db";

// Assicura che la cartella del file DB esista
const dir = path.dirname(DB_PATH);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    rate_week REAL NOT NULL DEFAULT 0,
    rate_weekend REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    employee_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
`);

module.exports = {
  db,

  listEmployees() {
    return db.prepare("SELECT * FROM employees ORDER BY created_at ASC").all();
  },

  getEmployee(id) {
    return db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  },

  getEmployeeByEmail(email) {
    return db
      .prepare("SELECT * FROM employees WHERE lower(email) = lower(?)")
      .get(email);
  },

  createEmployee({ id, name, email, rateWeek, rateWeekend }) {
    db.prepare(
      `INSERT INTO employees (id, name, email, rate_week, rate_weekend)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, email, rateWeek || 0, rateWeekend || 0);
  },

  updateEmployee(id, { name, email, rateWeek, rateWeekend }) {
    db.prepare(
      `UPDATE employees SET name = ?, email = ?, rate_week = ?, rate_weekend = ? WHERE id = ?`
    ).run(name, email, rateWeek || 0, rateWeekend || 0, id);
  },

  deleteEmployee(id) {
    db.prepare("DELETE FROM attendance WHERE employee_id = ?").run(id);
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
  },

  getAttendanceForMonth(employeeId, yearMonthPrefix) {
    // yearMonthPrefix es. "2026-09"
    const rows = db
      .prepare(
        `SELECT date, status FROM attendance WHERE employee_id = ? AND date LIKE ?`
      )
      .all(employeeId, yearMonthPrefix + "-%");
    const map = {};
    for (const r of rows) map[r.date] = r.status;
    return map;
  },

  getAllAttendanceForMonth(yearMonthPrefix) {
    const rows = db
      .prepare(`SELECT employee_id, date, status FROM attendance WHERE date LIKE ?`)
      .all(yearMonthPrefix + "-%");
    const map = {};
    for (const r of rows) {
      if (!map[r.employee_id]) map[r.employee_id] = {};
      map[r.employee_id][r.date] = r.status;
    }
    return map;
  },

  setAttendance(employeeId, date, status) {
    if (!status) {
      db.prepare("DELETE FROM attendance WHERE employee_id = ? AND date = ?").run(
        employeeId,
        date
      );
      return;
    }
    db.prepare(
      `INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)
       ON CONFLICT(employee_id, date) DO UPDATE SET status = excluded.status`
    ).run(employeeId, date, status);
  },

  getAllAttendanceRows() {
    return db.prepare("SELECT employee_id, date, status FROM attendance").all();
  },

  restoreAll({ employees, attendance }) {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM attendance").run();
      db.prepare("DELETE FROM employees").run();

      const insertEmp = db.prepare(
        `INSERT INTO employees (id, name, email, rate_week, rate_weekend) VALUES (?, ?, ?, ?, ?)`
      );
      for (const e of employees) {
        insertEmp.run(
          e.id,
          e.name,
          e.email,
          Number(e.rate_week) || 0,
          Number(e.rate_weekend) || 0
        );
      }

      const insertAtt = db.prepare(
        `INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)`
      );
      for (const a of attendance) {
        insertAtt.run(a.employee_id, a.date, a.status);
      }
    });
    tx();
  },
};
