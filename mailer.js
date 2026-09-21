const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

async function sendMagicLinkEmail({ to, name, link }) {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    throw new Error(
      "RESEND_API_KEY o FROM_EMAIL non sono impostate nelle variabili d'ambiente."
    );
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">Accedi al Registro Presenze</h2>
      <p>Ciao ${escapeHtml(name)},</p>
      <p>Clicca sul pulsante qui sotto per accedere e vedere le tue presenze registrate. Il link è valido per 15 minuti.</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background:#1f7a5c; color:#fff; padding:12px 22px; border-radius:8px; text-decoration:none; display:inline-block;">
          Accedi al registro
        </a>
      </p>
      <p style="color:#666; font-size: 13px;">Se non hai richiesto tu questo accesso, ignora pure questa email.</p>
    </div>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: "Il tuo link di accesso al Registro Presenze",
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Resend ha risposto con errore ${resp.status}: ${text}`);
  }

  return resp.json();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { sendMagicLinkEmail };
