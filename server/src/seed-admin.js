import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'مدير المكتبة';
if (!email || !password || password.length < 10) {
  console.error(
    'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters) before running seed:admin.',
  );
  process.exitCode = 1;
} else {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')
    ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, role = 'admin'`,
  ).run(name, email, hash);
  console.log(`Admin account ready: ${email}`);
}
db.close();
