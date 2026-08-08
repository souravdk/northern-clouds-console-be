const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const { homestay_id } = req.query;
    const params = [];
    let sql = `SELECT r.*, h.name as homestay_name FROM rooms r JOIN homestays h ON h.id = r.homestay_id`;
    if (homestay_id) { sql += ' WHERE r.homestay_id = ?'; params.push(homestay_id); }
    sql += ' ORDER BY r.id DESC';
    const [rows] = await pool.query(sql, params);
    for (const room of rows) {
      const [photos] = await pool.query('SELECT id, url FROM room_photos WHERE room_id = ?', [room.id]);
      room.photos = photos;
    }
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const [photos] = await pool.query('SELECT id, url FROM room_photos WHERE room_id = ?', [req.params.id]);
    res.json({ ...rows[0], photos });
  } catch (e) { next(e); }
});

router.post('/', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { homestay_id, name, room_type, capacity, base_price, description, amenities } = req.body;
    if (!homestay_id || !name) return res.status(400).json({ error: 'Missing fields' });
    const [r] = await pool.query(
      `INSERT INTO rooms (homestay_id, name, room_type, capacity, base_price, description, amenities)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [homestay_id, name, room_type, capacity || 2, base_price || 0, description, amenities]
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    const { name, room_type, capacity, base_price, description, amenities, active } = req.body;
    await pool.query(
      `UPDATE rooms SET name=?, room_type=?, capacity=?, base_price=?, description=?, amenities=?, active=? WHERE id=?`,
      [name, room_type, capacity, base_price, description, amenities, active ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/photos', requireRole('owner', 'manager'), upload.array('photos', 10), async (req, res, next) => {
  try {
    const urls = (req.files || []).map(f => `/uploads/${f.filename}`);
    for (const url of urls) {
      await pool.query('INSERT INTO room_photos (room_id, url) VALUES (?, ?)', [req.params.id, url]);
    }
    res.json({ uploaded: urls });
  } catch (e) { next(e); }
});

router.delete('/photos/:photoId', requireRole('owner', 'manager'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM room_photos WHERE id = ?', [req.params.photoId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Availability search: GET /rooms/availability?check_in=&check_out=&guests=&homestay_id=
router.get('/search/availability', async (req, res, next) => {
  try {
    const { check_in, check_out, guests = 1, homestay_id } = req.query;
    if (!check_in || !check_out) return res.status(400).json({ error: 'check_in and check_out required' });
    const params = [Number(guests), check_in, check_in, check_out, check_out, check_in, check_out];
    let sql = `
      SELECT r.*, h.name as homestay_name FROM rooms r
      JOIN homestays h ON h.id = r.homestay_id
      WHERE r.active = 1 AND r.capacity >= ?
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.id
        AND b.status IN ('booked','checked_in')
        AND NOT (b.check_out <= ? OR b.check_in >= ?)
      )`;
    // Above: a booking overlaps if NOT (booking ends on/before requested start OR booking starts on/after requested end)
    // params reused; rebuild cleanly:
    const realParams = [Number(guests), check_in, check_out];
    let realSql = `
      SELECT r.*, h.name as homestay_name FROM rooms r
      JOIN homestays h ON h.id = r.homestay_id
      WHERE r.active = 1 AND r.capacity >= ?
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.id
        AND b.status IN ('booked','checked_in')
        AND NOT (b.check_out <= ? OR b.check_in >= ?)
      )`;
    if (homestay_id) { realSql += ' AND r.homestay_id = ?'; realParams.push(homestay_id); }
    realSql += ' ORDER BY r.base_price ASC';
    const [rows] = await pool.query(realSql, realParams);
    for (const room of rows) {
      const [photos] = await pool.query('SELECT id, url FROM room_photos WHERE room_id = ?', [room.id]);
      room.photos = photos;
    }
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
