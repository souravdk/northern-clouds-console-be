require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

(async () => {
  try {
    const email = 'admin@example.com';
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      console.log('Admin user already exists:', email);
    } else {
      await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Owner', email, hash, 'owner']
      );
      console.log(`Seeded admin: ${email} / ${password}`);
    }

    // sample content blocks
    const blocks = [
      ['home_hero', 'Welcome', 'Edit this content from the admin panel.'],
      ['about', 'About Us', 'Tell your story here.'],
      ['contact', 'Contact', 'Phone, email, address.'],
    ];
    for (const [key, title, body] of blocks) {
      await pool.query(
        'INSERT IGNORE INTO content_blocks (block_key, title, body) VALUES (?, ?, ?)',
        [key, title, body]
      );
    }
    console.log('Done.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
