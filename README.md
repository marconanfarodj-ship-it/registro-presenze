# Registro Presenze

App con backend reale per gestire presenze e assenze dei dipendenti:

- **Tu (amministratore)**: accedi con una password, vedi il calendario di tutti i dipendenti, tariffe (lun–ven e sab/dom) e il totale da pagare a fine mese.
- **Dipendenti**: accedono con un link magico via email (nessuna password), vedono **solo il proprio calendario**, senza tariffe né totali — perché i prezzi non arrivano mai al loro browser (girano solo lato server, nella dashboard admin protetta da password).

---

## 1. Cosa serve prima di iniziare

- Un account [GitHub](https://github.com) (hai detto di averlo già)
- Un account [Render](https://render.com) (hai detto di averlo già)
- Un account [Resend](https://resend.com) per inviare i link di accesso via email
- Il tuo dominio (per far inviare le email da un indirizzo tipo `presenze@tuodominio.it` in modo affidabile)

---

## 2. Metti il codice su GitHub

1. Crea un nuovo repository vuoto su GitHub (es. `registro-presenze`).
2. Nella cartella di questo progetto, sul tuo computer:
   ```bash
   git init
   git add .
   git commit -m "Prima versione registro presenze"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/registro-presenze.git
   git push -u origin main
   ```

---

## 3. Configura Resend (invio email)

1. Vai su [resend.com](https://resend.com) e crea un account.
2. Vai su **Domains** → **Add Domain** e inserisci il tuo dominio.
3. Resend ti darà alcuni record DNS (TXT, MX, CNAME) da aggiungere dove gestisci il tuo dominio (es. il pannello del tuo provider). Aggiungili lì.
4. Aspetta che Resend segni il dominio come **Verified** (di solito da pochi minuti a qualche ora).
5. Vai su **API Keys** → crea una nuova chiave → copiala (ti servirà come `RESEND_API_KEY`).
6. Decidi l'indirizzo mittente, es. `presenze@tuodominio.it` (deve appartenere al dominio appena verificato) → sarà il tuo `FROM_EMAIL`.

Finché il dominio non è verificato, puoi fare qualche prova con `FROM_EMAIL=onboarding@resend.dev`, ma **non usarlo con i dipendenti veri** (è limitato alle prove).

---

## 4. Crea il servizio su Render

### Opzione A — Blueprint automatico (più veloce)
Questo progetto include un file `render.yaml`. Su Render:
1. **New +** → **Blueprint**
2. Collega il repository GitHub appena creato
3. Render leggerà `render.yaml` e proporrà il servizio con il disco già configurato
4. Ti chiederà di compilare le variabili d'ambiente mancanti (vedi punto 5)

### Opzione B — Manuale
1. Su Render: **New +** → **Web Service**
2. Collega il repository GitHub
3. Impostazioni:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Vai su **Disks** → **Add Disk**:
   - **Mount Path**: `/data`
   - **Size**: 1 GB va benissimo
   - Questo è importante: senza un disco persistente, il database SQLite verrebbe cancellato a ogni riavvio/deploy.

---

## 5. Variabili d'ambiente su Render

Nella sezione **Environment** del servizio, aggiungi:

| Variabile | Valore |
|---|---|
| `ADMIN_PASSWORD` | una password che sceglierai tu per entrare come amministratore |
| `SESSION_SECRET` | una stringa lunga e casuale (vedi comando sotto) |
| `RESEND_API_KEY` | la chiave copiata da Resend |
| `FROM_EMAIL` | es. `presenze@tuodominio.it` |
| `APP_URL` | l'URL pubblico della tua app (es. `https://presenze.tuodominio.it` oppure l'URL che Render ti assegna tipo `https://registro-presenze.onrender.com`) |
| `DB_PATH` | `/data/app.db` |
| `NODE_ENV` | `production` |

Per generare una `SESSION_SECRET` sicura, sul tuo computer con Node installato:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fai il deploy. Al primo avvio il database viene creato automaticamente (tabelle vuote, nessuna configurazione manuale necessaria).

---

## 6. Collega il tuo dominio (opzionale ma consigliato)

1. Su Render, nel servizio → **Settings** → **Custom Domain** → aggiungi es. `presenze.tuodominio.it`
2. Render ti mostra un record CNAME da aggiungere nel pannello DNS del tuo dominio
3. Aggiorna anche `APP_URL` nelle variabili d'ambiente con l'URL definitivo (serve per costruire correttamente i link magici nelle email)

---

## 7. Uso quotidiano

- Vai su `https://tuo-dominio-o-url/admin/login`, inserisci la password → dashboard con calendario, tariffe e totali.
- Aggiungi un dipendente inserendo nome, email e le due tariffe (lun–ven, sab/dom).
- Clicca sulle caselle dei giorni per far scorrere lo stato: — → Presente → Assente → Ferie → Malattia.
- Il dipendente va su `https://tuo-dominio-o-url/login`, inserisce la sua email, riceve un link via email e clicca per entrare: vedrà solo il proprio calendario, senza tariffe né totali.

---

## Note importanti

- **Sicurezza**: questa è una protezione "ragionevole per un piccolo team", non un sistema bancario. La password admin e i link magici (validi 15 minuti) sono adeguati per un uso interno con dipendenti fidati, ma non c'è ad esempio autenticazione a due fattori.
- **Backup**: il database vive sul disco persistente di Render. Per un backup extra, puoi periodicamente scaricare il file `/data/app.db` tramite la Shell di Render (Render → il tuo servizio → **Shell**) con:
  ```bash
  cat /data/app.db | base64
  ```
  e salvare il risultato, oppure valutare in futuro un backup automatico programmato.
- **Costi**: Render fa pagare sia il servizio web (a meno di restare nel piano gratuito, che però "dorme" se inattivo) sia il disco persistente (di solito pochi dollari al mese). Resend ha un piano gratuito con un buon numero di email al mese, più che sufficiente per pochi dipendenti.
