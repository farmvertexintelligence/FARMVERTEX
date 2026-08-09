require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json({ limit: '20kb' }));

// ---- CORS: only allow the frontend origins you configure in .env ----
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // allow server-to-server / curl requests with no origin header
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

// ---- Rate limit: 5 submissions per IP per 15 minutes ----
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

// ---- Mail transport ----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, organization, message, website } = req.body || {};

    // honeypot — bots tend to fill every field, humans never see this one
    if (website) {
      return res.status(200).json({ ok: true }); // pretend success, drop silently
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ error: 'Message is too long.' });
    }

    const safeName = escapeHtml(name).slice(0, 200);
    const safeOrg = escapeHtml(organization || '—').slice(0, 200);
    const safeMessage = escapeHtml(message).slice(0, 5000);
    const safeEmail = escapeHtml(email).slice(0, 200);

    await transporter.sendMail({
      from: `"FarmVertex Website" <${process.env.FROM_EMAIL}>`,
      to: process.env.TO_EMAIL,
      replyTo: email,
      subject: `New contact form submission — ${name}`,
      text:
`New message from the FarmVertex website contact form:

Name: ${name}
Email: ${email}
Organization: ${organization || '—'}

Message:
${message}`,
      html:
`<div style="font-family:sans-serif;font-size:14px;color:#222;">
  <h2 style="margin-bottom:4px;">New contact form submission</h2>
  <p><strong>Name:</strong> ${safeName}<br/>
  <strong>Email:</strong> ${safeEmail}<br/>
  <strong>Organization:</strong> ${safeOrg}</p>
  <p><strong>Message:</strong></p>
  <p style="white-space:pre-wrap;">${safeMessage}</p>
</div>`
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Something went wrong sending your message.' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FarmVertex backend listening on port ${PORT}`);
});
