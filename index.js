const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const ALLOWED_ORIGINS = [...new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean),
])];

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS non autorise'));
  },
}));
app.use(express.json());

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Routes
app.post('/api/contact', async (req, res) => {
  const { name, email, service, message } = req.body;

  if (!name || !email || !service || !message) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.RECEIVER_EMAIL) {
    return res.status(500).json({ error: 'Configuration email incomplète sur le serveur.' });
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Freezelec Site" <${process.env.EMAIL_USER}>`,
    to: process.env.RECEIVER_EMAIL,
    replyTo: email,
    subject: `Nouveau message de contact: ${service}`,
    text: `Nom: ${name}\nEmail: ${email}\nService: ${service}\nMessage: ${message}`,
    html: `
      <h3>Nouveau message de contact</h3>
      <p><strong>Nom:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
  };

  try {
    await transporter.verify();
    await transporter.sendMail(mailOptions);

    console.log('Message envoyé avec succès:', req.body);
    res.status(200).json({ message: 'Message envoyé avec succès !' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);

    if (error && error.code === 'EAUTH') {
      return res.status(500).json({
        error: 'Échec d’authentification SMTP. Vérifiez le mot de passe de la boîte mail Hostinger.',
      });
    }

    res.status(500).json({
      error: 'Une erreur SMTP est survenue lors de l’envoi du message.',
    });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    res.json({ ok: true, smtpHost: SMTP_HOST, smtpPort: SMTP_PORT });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.code || 'SMTP_ERROR',
      message: error.message || 'Erreur SMTP',
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
    });
  }
});

app.get('/', (req, res) => {
  res.send('Serveur Freezelec en cours d\'exécution...');
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
