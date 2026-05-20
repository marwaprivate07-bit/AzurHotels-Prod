require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware — must be declared before any route that uses it
const authRouter = require('./routes/auth');
const verifyToken = authRouter.verifyToken;

// Routes — ⚠️ /api/auth/users AVANT /api/auth
app.use('/api/auth/users', require('./routes/users')); // ✅ GESTION UTILISATEURS
app.use('/api/auth',       authRouter);                 // LOGIN + AUTH

app.use('/api/ca',          verifyToken, require('./routes/ca'));
app.use('/api/stats',       verifyToken, require('./routes/stats'));
app.use('/api/charges',     verifyToken, require('./routes/charges'));
app.use('/api/resultat',    verifyToken, require('./routes/resultat'));
app.use('/api/previsions',  verifyToken, require('./routes/previsions'));

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.get('/api/hotels', verifyToken, async (req, res) => {
  const pool = require('./db');
  try {
    const [rows] = await pool.execute('SELECT * FROM dim_hotel');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/annees', verifyToken, async (req, res) => {
  const pool = require('./db');
  try {
    const [rows] = await pool.execute('SELECT DISTINCT annee FROM dim_date ORDER BY annee');
    res.json({ success: true, data: rows.map(r => r.annee) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`✅ API sur http://localhost:${PORT}`));
}

module.exports = app;
