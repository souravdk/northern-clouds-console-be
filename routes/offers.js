const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.use(authRequired);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM offers ORDER BY id DESC');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { title, description, discount_percent, valid_from, valid_to, target_tags } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const [r] = await pool.query(
      `INSERT INTO offers (title, description, discount_percent, valid_from, valid_to, target_tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, discount_percent, valid_from || null, valid_to || null, target_tags]
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { title, description, discount_percent, valid_from, valid_to, target_tags, active } = req.body;
    await pool.query(
      `UPDATE offers SET title=?, description=?, discount_percent=?, valid_from=?, valid_to=?, target_tags=?, active=? WHERE id=?`,
      [title, description, discount_percent, valid_from || null, valid_to || null, target_tags, active ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM offers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
