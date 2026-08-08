const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.use(authRequired);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM content_blocks ORDER BY block_key');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { block_key, title, body } = req.body;
    if (!block_key) return res.status(400).json({ error: 'block_key required' });
    await pool.query(
      `INSERT INTO content_blocks (block_key, title, body) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body)`,
      [block_key, title, body]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:key', requireRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM content_blocks WHERE block_key = ?', [req.params.key]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
