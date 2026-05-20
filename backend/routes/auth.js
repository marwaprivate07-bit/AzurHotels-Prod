// backend/routes/auth.js
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const { sendNewPasswordEmail } = require('../mailer');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
  console.log('✅ bcryptjs chargé correctement');
} catch (e) {
  console.error('❌ bcryptjs non installé ! Lance: npm install bcryptjs');
  process.exit(1);
}

const JWT_SECRET     = process.env.JWT_SECRET || 'azur-bi-super-secret-2025';
const JWT_EXPIRES_IN = '8h';
const JWT_REMEMBER   = '7d';

async function findUserById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, name, role, hotel, avatar FROM utilisateurs WHERE id = ?', [id]
  );
  return rows[0] || null;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, error: 'Session expirée', expired: true });
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password, rememberMe = false } = req.body;

  if (!username || !password)
    return res.status(400).json({ success: false, error: "Nom d'utilisateur et mot de passe requis" });

  try {
    const [rows] = await pool.query('SELECT * FROM utilisateurs WHERE username = ?', [username.trim()]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const expiresIn = rememberMe ? JWT_REMEMBER : JWT_EXPIRES_IN;
    const payload = { id: user.id, username: user.username, role: user.role, hotel: user.hotel };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000));

    res.json({
      success: true, token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, name: user.name, username: user.username, role: user.role, hotel: user.hotel, avatar: user.avatar, allowed_dashboards: user.allowed_dashboards || null, allowed_hotels: user.allowed_hotels || null },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur: ' + err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', verifyToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    const newToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, hotel: user.hotel },
      JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
    );
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 8 * 60 * 60 * 1000);
    res.json({ success: true, token: newToken, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Déconnexion réussie' });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// L'utilisateur entre son identifiant → reçoit un nouveau mot de passe par email
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  console.log('🔍 Forgot password request for:', username);
  
  if (!username)
    return res.status(400).json({ success: false, error: "Identifiant requis." });

  try {
    const [rows] = await pool.query(
      'SELECT id, username, name, email FROM utilisateurs WHERE username = ?',
      [username.trim()]
    );

    console.log('🔍 DB rows found:', rows.length);

    // Toujours retourner succès pour ne pas révéler si le compte existe
    if (!rows.length) {
      console.log('⚠️ User not found');
      return res.json({ success: true });
    }

    if (!rows[0].email) {
      console.log('⚠️ User has no email:', rows[0]);
      return res.json({ success: true });
    }

    const user = rows[0];
    console.log('👤 User found:', user);

    // Générer un nouveau mot de passe de 10 caractères
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let newPassword = '';
    for (let i = 0; i < 10; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];

    console.log('🔑 New password generated');

    // Hasher et sauvegarder en DB
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE utilisateurs SET password = ? WHERE id = ?', [hashed, user.id]);
    console.log('💾 Password updated in DB');

    // Envoyer l'email avec le nouveau mot de passe
    try {
      await sendNewPasswordEmail({
        to: user.email,
        name: user.name,
        username: user.username,
        newPassword,
      });
      console.log('📧 Email sent to:', user.email);
    } catch (emailErr) {
      console.error('❌ Email error:', emailErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Forgot-password error:', err.message);
    res.status(500).json({ success: false, error: 'Erreur serveur: ' + err.message });
  }
});

router.verifyToken = verifyToken;
module.exports = router;
