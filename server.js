require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on PORT: ${port}`));
