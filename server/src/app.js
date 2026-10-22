import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'node:url';
import { db, migrate } from './db.js';
import { openapi } from './openapi.js';

migrate();
const app = express();
const root = fileURLToPath(new URL('../', import.meta.url));
const uploadsDir = path.join(root, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const secret = process.env.JWT_SECRET || 'local-development-secret-change-before-deployment';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET)
  throw new Error('JWT_SECRET is required in production');

app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d' }));
app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, { customSiteTitle: 'متجر علم API' }),
);

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}
function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function int(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    city: user.city,
    address: user.address,
    store_name: user.store_name,
    bio: user.bio,
    created_at: user.created_at,
  };
}
function getPublicUser(id) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return user ? publicUser(user) : null;
}
function tokenFor(user) {
  return jwt.sign({ id: user.id }, secret, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail(res, 401, 'سجّل الدخول أولاً');
  try {
    const payload = jwt.verify(token, secret);
    const user = getPublicUser(payload.id);
    if (!user) return fail(res, 401, 'الحساب غير موجود');
    req.user = user;
    next();
  } catch {
    return fail(res, 401, 'انتهت صلاحية الجلسة، سجّل الدخول من جديد');
  }
}
function role(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role) ? next() : fail(res, 403, 'ليس لديك صلاحية لهذا الإجراء');
}

const types = new Set(['book', 'newspaper', 'magazine', 'manuscript', 'rare', 'other']);
const conditions = new Set(['new', 'excellent', 'good', 'fair']);
const listingSelect = `SELECT l.*, COALESCE(NULLIF(u.store_name, ''), u.name) AS seller_name
  FROM listings l JOIN users u ON u.id = l.seller_id`;
function getListing(id) {
  return db.prepare(`${listingSelect} WHERE l.id = ?`).get(id);
}
function validListing(body) {
  const listing = {
    title: clean(body.title, 160),
    author: clean(body.author, 120),
    description: clean(body.description, 3000),
    item_type: clean(body.item_type, 30),
    item_condition: clean(body.item_condition, 30),
    publication_year:
      body.publication_year === '' || body.publication_year == null
        ? null
        : int(body.publication_year),
    price: int(body.price),
    quantity: int(body.quantity),
    image_url: clean(body.image_url, 1000),
  };
  if (!listing.title || !types.has(listing.item_type) || !conditions.has(listing.item_condition))
    return { error: 'أدخل العنوان والنوع والحالة بشكل صحيح' };
  if (!Number.isInteger(listing.price) || listing.price < 0 || listing.price > 10000000)
    return { error: 'السعر يجب أن يكون رقماً صحيحاً بالجنيه المصري' };
  if (!Number.isInteger(listing.quantity) || listing.quantity < 1 || listing.quantity > 10000)
    return { error: 'الكمية يجب أن تكون بين 1 و10000' };
  if (
    listing.publication_year !== null &&
    (!Number.isInteger(listing.publication_year) ||
      listing.publication_year < 100 ||
      listing.publication_year > new Date().getFullYear() + 1)
  )
    return { error: 'سنة النشر غير صحيحة' };
  if (
    listing.image_url &&
    !/^https?:\/\//i.test(listing.image_url) &&
    !listing.image_url.startsWith('/uploads/')
  )
    return { error: 'رابط الصورة غير صحيح' };
  return { listing };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 200).toLowerCase();
  const password = req.body.password;
  const requestedRole = req.body.role === 'seller' ? 'seller' : 'customer';
  if (
    name.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 8
  )
    return fail(res, 400, 'أدخل اسماً وبريداً صحيحاً وكلمة مرور من 8 أحرف على الأقل');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return fail(res, 409, 'البريد الإلكتروني مستخدم بالفعل');
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 12), requestedRole);
  const user = getPublicUser(result.lastInsertRowid);
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});
app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email, 200).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (
    !user ||
    typeof req.body.password !== 'string' ||
    !bcrypt.compareSync(req.body.password, user.password_hash)
  )
    return fail(res, 401, 'البريد أو كلمة المرور غير صحيحين');
  res.json({ user: publicUser(user), token: tokenFor(user) });
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/become-seller', auth, (req, res) => {
  if (req.user.role === 'customer')
    db.prepare("UPDATE users SET role = 'seller' WHERE id = ?").run(req.user.id);
  const user = getPublicUser(req.user.id);
  res.json({ user });
});
app.get('/api/profile', auth, (req, res) => res.json({ user: req.user }));
app.put('/api/profile', auth, (req, res) => {
  const values = req.body || {};
  const name = clean(values.name, 100);
  const email = clean(values.email, 200).toLowerCase();
  const phone = clean(values.phone, 30);
  const city = clean(values.city, 100);
  const address = clean(values.address, 250);
  const storeName = clean(values.store_name, 100);
  const bio = clean(values.bio, 500);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, 'أدخل اسماً وبريداً إلكترونياً صحيحين');
  if (phone && !/^[+\d\s()-]{8,30}$/.test(phone)) return fail(res, 400, 'رقم الهاتف غير صحيح');
  if (db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, req.user.id))
    return fail(res, 409, 'البريد الإلكتروني مستخدم بالفعل');
  db.prepare(
    'UPDATE users SET name = ?, email = ?, phone = ?, city = ?, address = ?, store_name = ?, bio = ? WHERE id = ?',
  ).run(name, email, phone, city, address, storeName, bio, req.user.id);
  res.json({ user: getPublicUser(req.user.id) });
});
app.put('/api/profile/password', auth, (req, res) => {
  const currentPassword = req.body?.current_password;
  const newPassword = req.body?.new_password;
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    newPassword.length < 8
  )
    return fail(res, 400, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return fail(res, 400, 'كلمة المرور الحالية غير صحيحة');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 12),
    req.user.id,
  );
  res.status(204).end();
});

app.get('/api/listings', (req, res) => {
  const q = clean(req.query.q, 100);
  const type = clean(req.query.type, 30);
  const sort = clean(req.query.sort, 30);
  const page = Math.max(1, Math.min(10000, int(req.query.page || 1) || 1));
  const limit = 12;
  const where = ["l.status = 'approved'", 'l.quantity > 0'];
  const params = [];
  if (q) {
    where.push('(l.title LIKE ? OR l.author LIKE ? OR l.description LIKE ?)');
    params.push(...Array(3).fill(`%${q}%`));
  }
  if (types.has(type)) {
    where.push('l.item_type = ?');
    params.push(type);
  }
  const clause = where.join(' AND ');
  const order =
    sort === 'price_asc'
      ? 'l.price ASC, l.id DESC'
      : sort === 'price_desc'
        ? 'l.price DESC, l.id DESC'
        : 'l.created_at DESC, l.id DESC';
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM listings l WHERE ${clause}`)
    .get(...params).count;
  const items = db
    .prepare(`${listingSelect} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
app.get('/api/listings/:id', (req, res) => {
  const item = getListing(int(req.params.id));
  if (!item || item.status !== 'approved' || item.quantity < 1)
    return fail(res, 404, 'المادة غير موجودة');
  res.json({ item });
});
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(
        null,
        `${crypto.randomUUID()}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || ''}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
app.post('/api/uploads', auth, role('seller', 'admin'), upload.single('image'), (req, res) =>
  req.file
    ? res.status(201).json({ url: `/uploads/${req.file.filename}` })
    : fail(res, 400, 'اختر صورة JPG أو PNG أو WebP'),
);

app.get('/api/seller/listings', auth, role('seller', 'admin'), (req, res) => {
  res.json({
    items: db
      .prepare(`${listingSelect} WHERE l.seller_id = ? ORDER BY l.created_at DESC, l.id DESC`)
      .all(req.user.id),
  });
});
app.post('/api/seller/listings', auth, role('seller', 'admin'), (req, res) => {
  const { listing, error } = validListing(req.body);
  if (error) return fail(res, 400, error);
  if (req.body.sale_mode && req.body.sale_mode !== 'fixed')
    return fail(res, 400, 'طريقة العرض غير متاحة');
  const status = req.user.role === 'admin' ? 'approved' : 'pending';
  try {
    db.exec('BEGIN IMMEDIATE');
    const result = db
      .prepare(
        `INSERT INTO listings (seller_id, title, author, description, item_type, item_condition, publication_year, price, quantity, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.user.id,
        listing.title,
        listing.author,
        listing.description,
        listing.item_type,
        listing.item_condition,
        listing.publication_year,
        listing.price,
        listing.quantity,
        listing.image_url,
        status,
      );
    db.exec('COMMIT');
    res.status(201).json({ item: getListing(result.lastInsertRowid) });
  } catch (error) {
    db.exec('ROLLBACK');
    return fail(res, 500, 'تعذر إضافة المعروض');
  }
});
app.put('/api/seller/listings/:id', auth, role('seller', 'admin'), (req, res) => {
  const current = getListing(int(req.params.id));
  if (!current || current.seller_id !== req.user.id) return fail(res, 404, 'المادة غير موجودة');
  const { listing, error } = validListing(req.body);
  if (error) return fail(res, 400, error);
  const status = req.user.role === 'admin' ? 'approved' : 'pending';
  db.prepare(
    `UPDATE listings SET title = ?, author = ?, description = ?, item_type = ?, item_condition = ?, publication_year = ?, price = ?, quantity = ?, image_url = ?, status = ?, review_note = '', updated_at = datetime('now') WHERE id = ?`,
  ).run(
    listing.title,
    listing.author,
    listing.description,
    listing.item_type,
    listing.item_condition,
    listing.publication_year,
    listing.price,
    listing.quantity,
    listing.image_url,
    status,
    current.id,
  );
  res.json({ item: getListing(current.id) });
});
app.delete('/api/seller/listings/:id', auth, role('seller', 'admin'), (req, res) => {
  const current = getListing(int(req.params.id));
  if (!current || current.seller_id !== req.user.id) return fail(res, 404, 'المادة غير موجودة');
  if (db.prepare('SELECT 1 FROM order_items WHERE listing_id = ?').get(current.id))
    return fail(res, 409, 'لا يمكن حذف مادة مرتبطة بطلب سابق');
  db.prepare('DELETE FROM listings WHERE id = ?').run(current.id);
  res.status(204).end();
});

app.get('/api/admin/listings', auth, role('admin'), (req, res) => {
  const status = clean(req.query.status, 30);
  const items =
    status && ['pending', 'approved', 'rejected'].includes(status)
      ? db
          .prepare(`${listingSelect} WHERE l.status = ? ORDER BY l.created_at DESC, l.id DESC`)
          .all(status)
      : db.prepare(`${listingSelect} ORDER BY l.created_at DESC, l.id DESC`).all();
  res.json({ items });
});
app.patch('/api/admin/listings/:id/review', auth, role('admin'), (req, res) => {
  const current = getListing(int(req.params.id));
  if (!current) return fail(res, 404, 'المادة غير موجودة');
  const status = clean(req.body.status, 30);
  if (!['approved', 'rejected'].includes(status)) return fail(res, 400, 'اختر الموافقة أو الرفض');
  db.prepare(
    `UPDATE listings SET status = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(status, clean(req.body.note, 500), current.id);
  res.json({ item: getListing(current.id) });
});
app.post('/api/orders', auth, (req, res) => {
  const customerName = clean(req.body.customer_name, 100);
  const phone = clean(req.body.phone, 30);
  const address = clean(req.body.address, 250);
  const city = clean(req.body.city, 100);
  const notes = clean(req.body.notes, 500);
  const rawItems = req.body.items;
  if (
    customerName.length < 2 ||
    !/^[+\d\s()-]{8,30}$/.test(phone) ||
    address.length < 5 ||
    !city ||
    !Array.isArray(rawItems) ||
    !rawItems.length ||
    rawItems.length > 50
  )
    return fail(res, 400, 'أكمل بيانات التوصيل والسلة');
  const unique = new Map();
  for (const raw of rawItems) {
    const id = int(raw.listing_id),
      quantity = int(raw.quantity);
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    )
      return fail(res, 400, 'الكمية غير صحيحة');
    unique.set(id, (unique.get(id) || 0) + quantity);
  }
  try {
    db.exec('BEGIN IMMEDIATE');
    const bySeller = new Map();
    for (const [id, quantity] of unique) {
      const item = getListing(id);
      if (!item || item.status !== 'approved' || item.quantity < quantity)
        throw new Error(`الكمية المطلوبة غير متاحة: ${item?.title || id}`);
      if (!bySeller.has(item.seller_id)) bySeller.set(item.seller_id, []);
      bySeller.get(item.seller_id).push({ ...item, ordered_quantity: quantity });
    }
    const orderIds = [];
    for (const sellerItems of bySeller.values()) {
      const subtotal = sellerItems.reduce(
        (sum, item) => sum + item.price * item.ordered_quantity,
        0,
      );
      const order = db
        .prepare(
          `INSERT INTO orders (buyer_id, customer_name, phone, address, city, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(req.user.id, customerName, phone, address, city, notes, subtotal);
      orderIds.push(order.lastInsertRowid);
      for (const item of sellerItems) {
        db.prepare(
          'INSERT INTO order_items (order_id, listing_id, seller_id, title, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          order.lastInsertRowid,
          item.id,
          item.seller_id,
          item.title,
          item.price,
          item.ordered_quantity,
        );
        db.prepare(
          "UPDATE listings SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?",
        ).run(item.ordered_quantity, item.id);
      }
    }
    db.exec('COMMIT');
    const orders = orderIds.map((id) => orderDetails(id));
    res.status(201).json({ order: orders[0], orders });
  } catch (error) {
    db.exec('ROLLBACK');
    return fail(res, 409, error.message);
  }
});
function orderDetails(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return {
    ...order,
    items: db
      .prepare(
        `SELECT oi.*, COALESCE(NULLIF(u.store_name, ''), u.name) AS seller_name
         FROM order_items oi JOIN users u ON u.id = oi.seller_id WHERE oi.order_id = ?`,
      )
      .all(id),
  };
}
app.get('/api/orders/mine', auth, (req, res) => {
  const orders = db
    .prepare('SELECT id FROM orders WHERE buyer_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json({ items: orders.map((row) => orderDetails(row.id)) });
});
app.get('/api/seller/orders', auth, role('seller', 'admin'), (req, res) => {
  const items = db
    .prepare(
      `SELECT oi.*, o.status, o.customer_name, o.city, o.phone, o.address, o.created_at FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = ? ORDER BY o.created_at DESC, oi.id DESC`,
    )
    .all(req.user.id);
  res.json({ items });
});
app.get('/api/admin/orders', auth, role('admin'), (_req, res) => {
  const orders = db.prepare('SELECT id FROM orders ORDER BY created_at DESC, id DESC').all();
  res.json({ items: orders.map((row) => orderDetails(row.id)) });
});
app.patch('/api/admin/orders/:id', auth, role('admin'), (req, res) => {
  const id = int(req.params.id);
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!current) return fail(res, 404, 'الطلب غير موجود');
  const status = clean(req.body.status, 30);
  if (!['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status))
    return fail(res, 400, 'حالة الطلب غير صحيحة');
  if (current.status === 'cancelled' && status !== 'cancelled')
    return fail(res, 409, 'الطلب الملغي لا يمكن إعادته');
  db.exec('BEGIN IMMEDIATE');
  try {
    if (status === 'cancelled' && current.status !== 'cancelled') {
      for (const item of db
        .prepare('SELECT listing_id, quantity FROM order_items WHERE order_id = ?')
        .all(id))
        db.prepare('UPDATE listings SET quantity = quantity + ? WHERE id = ?').run(
          item.quantity,
          item.listing_id,
        );
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return fail(res, 500, error.message);
  }
  res.json({ order: orderDetails(id) });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError)
    return fail(
      res,
      400,
      error.code === 'LIMIT_FILE_SIZE' ? 'الصورة أكبر من 5 ميجابايت' : 'تعذر رفع الصورة',
    );
  console.error(error);
  return fail(res, 500, 'حدث خطأ في الخادم');
});
export default app;
