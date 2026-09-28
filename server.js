require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const runSeed = require('./seed');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      database: 'connected',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      ok: false,
      database: 'disconnected',
      error: error.message,
    });
  }
});

app.post('/api/seed', async (req, res) => {
  const seedSecret = process.env.SEED_SECRET;

  if (!seedSecret) {
    return res.status(503).json({ error: 'Seed endpoint is not configured' });
  }

  if (req.get('x-seed-secret') !== seedSecret) {
    return res.status(401).json({ error: 'Invalid seed secret' });
  }

  try {
    const result = await runSeed();
    res.json({ ok: true, message: 'Seed completed', result });
  } catch (error) {
    console.error('Seed failed:', error);
    res.status(500).json({ ok: false, error: 'Seed failed' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/homestays', require('./routes/homestays'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/content', require('./routes/content'));
app.use('/api/offers', require('./routes/offers'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`);
});
