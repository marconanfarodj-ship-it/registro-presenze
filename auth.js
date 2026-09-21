const jwt = require("jsonwebtoken");

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  console.warn(
    "ATTENZIONE: SESSION_SECRET non è impostata. Imposta una stringa segreta lunga nel file .env."
  );
}

const ADMIN_COOKIE = "admin_session";
const EMPLOYEE_COOKIE = "employee_session";

function signAdminSession() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "30d" });
}

function signEmployeeSession(employeeId) {
  return jwt.sign({ role: "employee", employeeId }, SECRET, { expiresIn: "180d" });
}

function signMagicLinkToken(employeeId) {
  return jwt.sign({ purpose: "magic-link", employeeId }, SECRET, {
    expiresIn: "15m",
  });
}

function verify(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const adminCookieOptions = {
  ...baseCookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 giorni, in linea con signAdminSession
};

const employeeCookieOptions = {
  ...baseCookieOptions,
  maxAge: 180 * 24 * 60 * 60 * 1000, // 180 giorni, in linea con signEmployeeSession
};

// Mantenuto per compatibilità con eventuale codice che usa il nome generico
// (es. il clear della sessione non richiede maxAge).
const cookieOptions = baseCookieOptions;

function requireAdmin(req, res, next) {
  const token = req.cookies[ADMIN_COOKIE];
  const payload = token && verify(token);
  if (!payload || payload.role !== "admin") {
    return res.redirect("/admin/login");
  }
  next();
}

function requireEmployee(req, res, next) {
  const token = req.cookies[EMPLOYEE_COOKIE];
  const payload = token && verify(token);
  if (!payload || payload.role !== "employee") {
    return res.redirect("/login");
  }
  req.employeeId = payload.employeeId;
  next();
}

module.exports = {
  ADMIN_COOKIE,
  EMPLOYEE_COOKIE,
  cookieOptions,
  adminCookieOptions,
  employeeCookieOptions,
  signAdminSession,
  signEmployeeSession,
  signMagicLinkToken,
  verify,
  requireAdmin,
  requireEmployee,
};
