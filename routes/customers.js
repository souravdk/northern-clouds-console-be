const router = require('express').Router();
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const { q, tag } = req.query;
    const params = [];
    let sql = 'SELECT * FROM customers WHERE 1=1';
    if (q) { sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (tag) { sql += ' AND FIND_IN_SET(?, tags)'; params.push(tag); }
    sql += ' ORDER BY id DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const [bookings] = await pool.query(
      `SELECT b.*, r.name as room_name, h.name as homestay_name
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN homestays h ON h.id = b.homestay_id
       WHERE b.customer_id = ? ORDER BY b.check_in DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], bookings });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, id_proof, address, tags, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const [r] = await pool.query(
      'INSERT INTO customers (name, email, phone, id_proof, address, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, id_proof, address, tags, notes]
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, id_proof, address, tags, notes } = req.body;
    await pool.query(
      'UPDATE customers SET name=?, email=?, phone=?, id_proof=?, address=?, tags=?, notes=? WHERE id=?',
      [name, email, phone, id_proof, address, tags, notes, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
