const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.use(authRequired, requireRole('owner', 'manager'));

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY id DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role || 'receptionist']
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const { name, role, active, password } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (role !== undefined) { fields.push('role = ?'); values.push(role); }
    if (active !== undefined) { fields.push('active = ?'); values.push(active ? 1 : 0); }
    if (password) { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)); }
    if (!fields.length) return res.json({ ok: true });
    values.push(req.params.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
