const router = require('express').Router();
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const { status, homestay_id, from, to, q } = req.query;
    const params = [];
    let sql = `SELECT b.*, r.name as room_name, h.name as homestay_name, c.name as customer_name, c.phone as customer_phone
               FROM bookings b
               JOIN rooms r ON r.id = b.room_id
               JOIN homestays h ON h.id = b.homestay_id
               JOIN customers c ON c.id = b.customer_id
               WHERE 1=1`;
    if (status) { sql += ' AND b.status = ?'; params.push(status); }
    if (homestay_id) { sql += ' AND b.homestay_id = ?'; params.push(homestay_id); }
    if (from) { sql += ' AND b.check_out >= ?'; params.push(from); }
    if (to) { sql += ' AND b.check_in <= ?'; params.push(to); }
    if (q) { sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY b.check_in DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, r.name as room_name, r.base_price, h.name as homestay_name, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN homestays h ON h.id = b.homestay_id
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const [invoices] = await pool.query('SELECT * FROM invoices WHERE booking_id = ?', [req.params.id]);
    res.json({ ...rows[0], invoices });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { homestay_id, room_id, customer_id, check_in, check_out, guests, notes } = req.body;
    if (!homestay_id || !room_id || !customer_id || !check_in || !check_out)
      return res.status(400).json({ error: 'Missing fields' });
    if (check_in >= check_out) return res.status(400).json({ error: 'check_out must be after check_in' });

    // overlap check
    const [conflict] = await pool.query(
      `SELECT id FROM bookings WHERE room_id = ? AND status IN ('booked','checked_in')
       AND NOT (check_out <= ? OR check_in >= ?)`,
      [room_id, check_in, check_out]
    );
    if (conflict.length) return res.status(409).json({ error: 'Room not available for these dates' });

    const [r] = await pool.query(
      `INSERT INTO bookings (homestay_id, room_id, customer_id, check_in, check_out, guests, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [homestay_id, room_id, customer_id, check_in, check_out, guests || 1, notes, req.user.id]
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { check_in, check_out, guests, notes, status } = req.body;
    await pool.query(
      'UPDATE bookings SET check_in=?, check_out=?, guests=?, notes=?, status=? WHERE id=?',
      [check_in, check_out, guests, notes, status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
