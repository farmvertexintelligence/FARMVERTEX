# FarmVertex Backend

A minimal Express backend that powers the contact form on the FarmVertex Intelligence
website. It accepts a POST request, validates it, and emails the submission to
**hello@farmvertex.com**.

This is real, runnable server code — but it isn't deployed anywhere yet. You'll need
to host it and connect it to the frontend. Steps below.

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

- `TO_EMAIL` — already set to `hello@farmvertex.com`.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` — credentials
  for whatever mailbox or transactional email provider will actually send the mail.
  You cannot send email without real SMTP credentials from somewhere. Two common paths:
  - **Use the real hello@farmvertex.com mailbox's SMTP** (if it's on Google Workspace,
    Zoho Mail, Microsoft 365, etc. — each has its own SMTP host/port and an "app
    password" you generate in account settings, not your normal login password).
  - **Use a transactional email API** (Resend, Postmark, SendGrid, Mailgun, Amazon SES).
    These are built for exactly this — sending mail from a website — and are generally
    more reliable at scale than a personal mailbox's SMTP. Each has its own SMTP
    credentials you can drop straight into this same `.env` file.
- `ALLOWED_ORIGINS` — the exact URL(s) your live frontend will be served from. This is
  a CORS allowlist; requests from any other origin will be rejected.

## 3. Run locally

```bash
npm start
```

Server starts on `http://localhost:4000` (or whatever `PORT` you set). Test it:

```bash
curl -X POST http://localhost:4000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","organization":"Test Co","message":"Hello"}'
```

## 4. Deploy

This is a standard Node/Express app — it runs on any Node host. Common options:
Railway, Render, Fly.io, a small VPS, or a serverless adapter if you'd rather run it
as a function. Whichever you pick, set the same environment variables from `.env` in
that platform's dashboard/secrets manager — don't commit `.env` to git.

## 5. Connect the frontend

**Current state:** `contact.html` has a real form (name, email, organisation, interest,
message, plus the `website` honeypot). It is handled by `assets/js/site.js`:

- **Without a backend** (the default), submitting validates the fields and opens the
  visitor's email app with a prefilled message to hello@farmvertex.com.
- **With this backend deployed**, add its URL to the form and it will POST JSON to it:

  ```html
  <form class="panel reveal" data-contact data-endpoint="https://YOUR-BACKEND/api/contact" novalidate>
  ```

  The selected "Interested in" option is prefixed to the message, so the request shape
  matches what `server.js` already expects (`name`, `email`, `organization`, `message`,
  `website`).

Remember to add the site's origin (e.g. `https://www.farmvertex.com`) to
`ALLOWED_ORIGINS` in the backend's environment.

## Notes

- The form has a hidden honeypot field (`website`) that filters out the most basic
  spam bots without adding a CAPTCHA. It's not bulletproof — if spam becomes a real
  problem, add a proper CAPTCHA (hCaptcha/Turnstile) or a service like Akismet.
- Rate limiting is set to 5 submissions per IP per 15 minutes. Adjust in `server.js`
  if that's too strict or too loose for your traffic.
- All submitted text is HTML-escaped before being placed in the email body, so the
  form can't be used to inject arbitrary HTML into the message you receive.
