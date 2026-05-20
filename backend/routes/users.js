// backend/routes/users.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { verifyToken } = require('./auth');
const { sendWelcomeEmail } = require('../mailer');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) { console.error('❌ bcryptjs manquant'); process.exit(1); }

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ success: false, error: 'Accès refusé.' });
  next();
}

// GET /api/auth/users
router.get('/', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, name, email, role, hotel, active, allowed_hotels, allowed_dashboards FROM utilisateurs ORDER BY id ASC'
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users
router.post('/', verifyToken, adminOnly, async (req, res) => {
  const { username, name, email, password, role, hotels = [], dashboards = [] } = req.body;

  if (!username || !name || !password || !role)
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants.' });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, error: 'Adresse e-mail invalide.' });

  try {
    const [existing] = await pool.query('SELECT id FROM utilisateurs WHERE username = ?', [username.trim()]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, error: "Nom d'utilisateur déjà pris." });

    if (email) {
      const [emailCheck] = await pool.query('SELECT id FROM utilisateurs WHERE email = ?', [email.trim()]);
      if (emailCheck.length > 0)
        return res.status(409).json({ success: false, error: 'Adresse e-mail déjà utilisée.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO utilisateurs (username, name, email, password, role, active, allowed_hotels, allowed_dashboards) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      [username.trim(), name.trim(), email ? email.trim() : null, hashed, role, JSON.stringify(hotels), JSON.stringify(dashboards)]
    );

    // Envoyer email de bienvenue avec identifiants
    if (email) {
      try {
        await sendWelcomeEmail({ to: email.trim(), name: name.trim(), username: username.trim(), password });
        console.log('📧 Email de bienvenue envoyé à ' + email);
      } catch (mailErr) {
        console.error('⚠️ Erreur envoi email:', mailErr.message);
      }
    }

    res.status(201).json({ success: true, id: result.insertId, emailSent: !!email });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/users/:id  ← UPDATE complet (modifier un utilisateur)
router.put('/:id', verifyToken, adminOnly, async (req, res) => {
  const { name, email, role, hotels = [], dashboards = [], password } = req.body;

  if (!name || !role)
    return res.status(400).json({ success: false, error: 'Nom et rôle obligatoires.' });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, error: 'Adresse e-mail invalide.' });

  try {
    if (email) {
      const [emailCheck] = await pool.query(
        'SELECT id FROM utilisateurs WHERE email = ? AND id != ?', [email.trim(), req.params.id]
      );
      if (emailCheck.length > 0)
        return res.status(409).json({ success: false, error: 'Adresse e-mail déjà utilisée.' });
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE utilisateurs SET name=?, email=?, role=?, allowed_hotels=?, allowed_dashboards=?, password=? WHERE id=?',
        [name.trim(), email ? email.trim() : null, role.trim(), JSON.stringify(hotels), JSON.stringify(dashboards), hashed, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE utilisateurs SET name=?, email=?, role=?, allowed_hotels=?, allowed_dashboards=? WHERE id=?',
        [name.trim(), email ? email.trim() : null, role.trim(), JSON.stringify(hotels), JSON.stringify(dashboards), req.params.id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/:id', verifyToken, adminOnly, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ success: false, error: 'Impossible de supprimer votre propre compte.' });
  try {
    await pool.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/auth/users/:id
router.patch('/:id', verifyToken, adminOnly, async (req, res) => {
  const { active } = req.body;
  try {
    await pool.query('UPDATE utilisateurs SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
