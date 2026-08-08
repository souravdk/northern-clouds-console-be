const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.use(authRequired);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM homestays ORDER BY id DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM homestays WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { name, address, city, phone, email, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const [r] = await pool.query(
      'INSERT INTO homestays (name, address, city, phone, email, description) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address, city, phone, email, description]
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { name, address, city, phone, email, description, active } = req.body;
    await pool.query(
      `UPDATE homestays SET name=?, address=?, city=?, phone=?, email=?, description=?, active=? WHERE id=?`,
      [name, address, city, phone, email, description, active ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM homestays WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
