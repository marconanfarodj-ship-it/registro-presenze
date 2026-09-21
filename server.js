require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const store = require("./db");
const auth = require("./auth");
const { sendMagicLinkEmail } = require("./mailer");
const du = require("./dateUtils");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// ---------- Home ----------
app.get("/", (req, res) => {
  res.render("index");
});

// ================= ADMIN =================

app.get("/admin/login", (req, res) => {
  res.render("admin-login", { error: null });
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    res.cookie(auth.ADMIN_COOKIE, auth.signAdminSession(), auth.adminCookieOptions);
    return res.redirect("/admin");
  }
  res.render("admin-login", { error: "Password errata." });
});

app.get("/admin/logout", (req, res) => {
  res.clearCookie(auth.ADMIN_COOKIE, auth.cookieOptions);
  res.redirect("/admin/login");
});

app.get("/admin", auth.requireAdmin, (req, res) => {
  const { y, m0 } = du.resolveViewMonth(req.query);
  const employees = store.listEmployees();
  const nDays = du.daysInMonth(y, m0);
  const monthPrefix = `${y}-${du.pad(m0 + 1)}`;
  const attendanceByEmp = store.getAllAttendanceForMonth(monthPrefix);

  const rows = employees.map((emp) => {
    const att = attendanceByEmp[emp.id] || {};
    let countP = 0, countA = 0, countF = 0, countM = 0;
    let countPWeek = 0, countPWeekend = 0;
    const days = [];
    for (let d = 1; d <= nDays; d++) {
      const key = du.dateKey(y, m0, d);
      const status = att[key] || "";
      if (status === "P") {
        countP++;
        if (du.isWeekend(y, m0, d)) countPWeekend++; else countPWeek++;
      } else if (status === "A") countA++;
      else if (status === "F") countF++;
      else if (status === "M") countM++;
      days.push({
        day: d,
        status,
        weekend: du.isWeekend(y, m0, d),
        today: du.isToday(y, m0, d),
        label: `${d} ${du.MONTHS[m0]} — ${du.STATUS_LABEL[status]}`,
      });
    }
    const total = countPWeek * emp.rate_week + countPWeekend * emp.rate_weekend;
    return { emp, days, countP, countA, countF, countM, total };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  const headerDays = [];
  for (let d = 1; d <= nDays; d++) {
    headerDays.push({ day: d, weekend: du.isWeekend(y, m0, d), dow: du.dowLabel(y, m0, d) });
  }

  const prev = du.prevMonth(y, m0);
  const next = du.nextMonth(y, m0);

  res.render("admin-dashboard", {
    y, m0, monthLabel: `${du.MONTHS[m0]} ${y}`,
    employees, rows, headerDays, grandTotal,
    prev, next,
    STATUS_LABEL: du.STATUS_LABEL,
  });
});

app.post("/admin/employees", auth.requireAdmin, (req, res) => {
  const { name, email, rateWeek, rateWeekend } = req.body;
  if (name && name.trim() && email && email.trim()) {
    try {
      store.createEmployee({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        rateWeek: parseFloat(rateWeek) || 0,
        rateWeekend: parseFloat(rateWeekend) || 0,
      });
    } catch (err) {
      // probabile email duplicata: ignoriamo silenziosamente e torniamo alla dashboard
      console.error("Errore creazione dipendente:", err.message);
    }
  }
  res.redirect(backToMonth(req));
});

app.post("/admin/employees/:id/update", auth.requireAdmin, (req, res) => {
  const existing = store.getEmployee(req.params.id);
  if (existing) {
    const { name, email, rateWeek, rateWeekend } = req.body;
    store.updateEmployee(req.params.id, {
      name: (name || existing.name).trim(),
      email: (email || existing.email).trim().toLowerCase(),
      rateWeek: parseFloat(rateWeek) || 0,
      rateWeekend: parseFloat(rateWeekend) || 0,
    });
  }
  res.redirect(backToMonth(req));
});

app.post("/admin/employees/:id/delete", auth.requireAdmin, (req, res) => {
  store.deleteEmployee(req.params.id);
  res.redirect(backToMonth(req));
});

app.post("/admin/attendance", auth.requireAdmin, (req, res) => {
  const { employeeId, date } = req.body;
  const current = req.body.current || "";
  const idx = du.STATUS_CYCLE.indexOf(current);
  const next = du.STATUS_CYCLE[(idx + 1) % du.STATUS_CYCLE.length];
  store.setAttendance(employeeId, date, next);
  res.redirect(backToMonth(req));
});

function backToMonth(req) {
  const y = req.query.y || req.body.y;
  const m = req.query.m || req.body.m;
  if (y && m) return `/admin?y=${y}&m=${m}`;
  return "/admin";
}

// ================= EMPLOYEE (magic link) =================

app.get("/login", (req, res) => {
  res.render("employee-login", { error: null });
});

app.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const employee = email && store.getEmployeeByEmail(email);

  // Per non rivelare quali email sono registrate, mostriamo sempre lo stesso messaggio,
  // ma inviamo l'email solo se il dipendente esiste davvero.
  if (employee) {
    const token = auth.signMagicLinkToken(employee.id);
    const link = `${APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
    try {
      await sendMagicLinkEmail({ to: employee.email, name: employee.name, link });
    } catch (err) {
      console.error("Invio email fallito:", err.message);
      return res.render("employee-login", {
        error: "Non sono riuscito a inviare l'email. Riprova tra poco o contatta chi gestisce l'app.",
      });
    }
  }

  res.render("employee-check-email", { email });
});

app.get("/auth/verify", (req, res) => {
  const payload = auth.verify(req.query.token || "");
  if (!payload || payload.purpose !== "magic-link" || !payload.employeeId) {
    return res.render("employee-login", {
      error: "Il link non è valido o è scaduto. Richiedine uno nuovo.",
    });
  }
  const employee = store.getEmployee(payload.employeeId);
  if (!employee) {
    return res.render("employee-login", { error: "Account non trovato." });
  }
  res.cookie(
    auth.EMPLOYEE_COOKIE,
    auth.signEmployeeSession(employee.id),
    auth.employeeCookieOptions
  );
  res.redirect("/me");
});

app.get("/logout", (req, res) => {
  res.clearCookie(auth.EMPLOYEE_COOKIE, auth.cookieOptions);
  res.redirect("/login");
});

app.get("/me", auth.requireEmployee, (req, res) => {
  const employee = store.getEmployee(req.employeeId);
  if (!employee) {
    res.clearCookie(auth.EMPLOYEE_COOKIE, auth.cookieOptions);
    return res.redirect("/login");
  }

  const { y, m0 } = du.resolveViewMonth(req.query);
  const nDays = du.daysInMonth(y, m0);
  const monthPrefix = `${y}-${du.pad(m0 + 1)}`;
  const att = store.getAttendanceForMonth(employee.id, monthPrefix);

  let countP = 0, countA = 0, countF = 0, countM = 0;
  const days = [];
  for (let d = 1; d <= nDays; d++) {
    const key = du.dateKey(y, m0, d);
    const status = att[key] || "";
    if (status === "P") countP++;
    else if (status === "A") countA++;
    else if (status === "F") countF++;
    else if (status === "M") countM++;
    days.push({
      day: d,
      status,
      weekend: du.isWeekend(y, m0, d),
      today: du.isToday(y, m0, d),
      dow: du.dowLabel(y, m0, d),
      label: `${d} ${du.MONTHS[m0]} — ${du.STATUS_LABEL[status]}`,
    });
  }

  const prev = du.prevMonth(y, m0);
  const next = du.nextMonth(y, m0);

  res.render("employee-dashboard", {
    employee,
    y, m0, monthLabel: `${du.MONTHS[m0]} ${y}`,
    days, countP, countA, countF, countM,
    prev, next,
  });
});

// ---------- Avvio ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Registro presenze in ascolto su http://localhost:${PORT}`);
});
