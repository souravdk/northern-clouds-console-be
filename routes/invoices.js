const router = require('express').Router();
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

function calcTotals(items, taxPercent = 0, discount = 0) {
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const tax = +(subtotal * (Number(taxPercent) / 100)).toFixed(2);
  const total = +(subtotal + tax - Number(discount || 0)).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tax, total };
}

router.get('/', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const params = [];
    let sql = `SELECT i.*, b.check_in, b.check_out, c.name as customer_name, h.name as homestay_name
               FROM invoices i
               JOIN bookings b ON b.id = i.booking_id
               JOIN customers c ON c.id = b.customer_id
               JOIN homestays h ON h.id = b.homestay_id
               WHERE 1=1`;
    if (status) { sql += ' AND i.status = ?'; params.push(status); }
    if (q) { sql += ' AND (i.invoice_no LIKE ? OR c.name LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY i.id DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, b.check_in, b.check_out, b.guests, c.name as customer_name, c.email as customer_email,
              c.phone as customer_phone, c.address as customer_address, r.name as room_name,
              h.name as homestay_name, h.address as homestay_address
       FROM invoices i
       JOIN bookings b ON b.id = i.booking_id
       JOIN rooms r ON r.id = b.room_id
       JOIN customers c ON c.id = b.customer_id
       JOIN homestays h ON h.id = b.homestay_id
       WHERE i.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { booking_id, items = [], tax_percent = 0, discount = 0, notes } = req.body;
    if (!booking_id || !items.length) return res.status(400).json({ error: 'booking_id and items required' });

    const normalized = items.map(it => ({
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      amount: +(Number(it.quantity || 1) * Number(it.unit_price || 0)).toFixed(2),
    }));
    const totals = calcTotals(normalized, tax_percent, discount);
    const invoice_no = `INV-${Date.now()}`;

    const [r] = await conn.query(
      `INSERT INTO invoices (booking_id, invoice_no, subtotal, tax, discount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [booking_id, invoice_no, totals.subtotal, totals.tax, discount, totals.total, notes]
    );
    for (const it of normalized) {
      await conn.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
        [r.insertId, it.description, it.quantity, it.unit_price, it.amount]
      );
    }
    await conn.commit();
    res.json({ id: r.insertId, invoice_no, ...totals });
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
});

router.post('/:id/payment', async (req, res, next) => {
  try {
    const { paid_amount, payment_method } = req.body;
    const [rows] = await pool.query('SELECT total, paid_amount FROM invoices WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const newPaid = Number(rows[0].paid_amount) + Number(paid_amount || 0);
    let status = 'partial';
    if (newPaid >= Number(rows[0].total)) status = 'paid';
    else if (newPaid <= 0) status = 'unpaid';
    await pool.query(
      'UPDATE invoices SET paid_amount = ?, payment_method = ?, status = ? WHERE id = ?',
      [newPaid, payment_method, status, req.params.id]
    );
    res.json({ ok: true, status, paid_amount: newPaid });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
