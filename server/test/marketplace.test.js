import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warraq-test-'));
process.env.DB_FILE = path.join(dir, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-for-marketplace-workflow';
const { default: app } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}/api`;
after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function request(route, method = 'GET', body, token) {
  const response = await fetch(`${origin}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = response.status === 204 ? '' : await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }
  return { status: response.status, data };
}

test('seller approval, re-review, checkout and cancellation flow', async () => {
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@example.test', ?, 'admin')",
  ).run(bcrypt.hashSync('long-admin-password', 10));
  const admin = await request('/auth/login', 'POST', {
    email: 'admin@example.test',
    password: 'long-admin-password',
  });
  assert.equal(admin.status, 200);
  const seller = await request('/auth/register', 'POST', {
    name: 'Book seller',
    email: 'seller@example.test',
    password: 'seller-password',
    role: 'seller',
  });
  assert.equal(seller.status, 201);
  const image = new FormData();
  image.append(
    'image',
    new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    'cover.png',
  );
  const uploadedResponse = await fetch(`${origin}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller.data.token}` },
    body: image,
  });
  assert.equal(uploadedResponse.status, 201);
  const uploaded = await uploadedResponse.json();
  assert.match(uploaded.url, /^\/uploads\/.+\.png$/);
  fs.rmSync(path.join(process.cwd(), 'uploads', path.basename(uploaded.url)), { force: true });
  const buyer = await request('/auth/register', 'POST', {
    name: 'Book buyer',
    email: 'buyer@example.test',
    password: 'buyer-password',
    role: 'customer',
  });
  assert.equal(buyer.status, 201);
  const upgraded = await request('/auth/become-seller', 'POST', undefined, buyer.data.token);
  assert.equal(upgraded.data.user.role, 'seller');
  const profile = await request(
    '/profile',
    'PUT',
    {
      name: 'Book seller updated',
      email: 'seller@example.test',
      phone: '01012345678',
      city: 'Cairo',
      address: '12 Main Street',
      store_name: 'Old Books House',
      bio: 'Curated editions',
      role: 'admin',
    },
    seller.data.token,
  );
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.name, 'Book seller updated');
  assert.equal(profile.data.user.store_name, 'Old Books House');
  assert.equal(profile.data.user.role, 'seller');
  assert.equal(
    (await request('/auth/me', 'GET', undefined, seller.data.token)).data.user.city,
    'Cairo',
  );
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { name: 'Seller', email: 'admin@example.test' },
        seller.data.token,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/profile/password',
        'PUT',
        { current_password: 'wrong-password', new_password: 'new-seller-password' },
        seller.data.token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/profile/password',
        'PUT',
        { current_password: 'seller-password', new_password: 'new-seller-password' },
        seller.data.token,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await request('/auth/login', 'POST', {
        email: 'seller@example.test',
        password: 'seller-password',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request('/auth/login', 'POST', {
        email: 'seller@example.test',
        password: 'new-seller-password',
      })
    ).status,
    200,
  );
  const input = {
    title: 'A rare book',
    author: 'A writer',
    description: 'An early edition',
    item_type: 'rare',
    item_condition: 'good',
    publication_year: 1950,
    price: 250,
    quantity: 2,
  };
  const created = await request('/seller/listings', 'POST', input, seller.data.token);
  assert.equal(created.status, 201);
  assert.equal(created.data.item.status, 'pending');
  const id = created.data.item.id;
  assert.equal((await request('/listings')).data.total, 0);
  assert.equal((await request(`/listings/${id}`)).status, 404);
  assert.equal(
    (
      await request(
        `/admin/listings/${id}/review`,
        'PATCH',
        { status: 'approved' },
        seller.data.token,
      )
    ).status,
    403,
  );
  const reviewed = await request(
    `/admin/listings/${id}/review`,
    'PATCH',
    { status: 'approved' },
    admin.data.token,
  );
  assert.equal(reviewed.data.item.status, 'approved');
  assert.equal(reviewed.data.item.seller_name, 'Old Books House');
  assert.equal(
    (await request('/admin/listings', 'GET', undefined, admin.data.token)).data.items.find(
      (item) => item.id === id,
    ).status,
    'approved',
  );
  assert.equal(
    (await request('/seller/listings', 'GET', undefined, seller.data.token)).data.items.find(
      (item) => item.id === id,
    ).status,
    'approved',
  );
  assert.equal((await request('/listings')).data.total, 1);
  const edited = await request(
    `/seller/listings/${id}`,
    'PUT',
    { ...input, price: 300 },
    seller.data.token,
  );
  assert.equal(edited.data.item.status, 'pending');
  assert.equal((await request('/listings')).data.total, 0);
  await request(`/admin/listings/${id}/review`, 'PATCH', { status: 'approved' }, admin.data.token);
  const order = await request(
    '/orders',
    'POST',
    {
      customer_name: 'Book buyer',
      phone: '01012345678',
      address: '12 Main Street',
      city: 'Cairo',
      items: [{ listing_id: id, quantity: 2 }],
    },
    buyer.data.token,
  );
  assert.equal(order.status, 201);
  assert.equal(order.data.order.total, 600);
  assert.equal((await request('/listings')).data.total, 0);
  assert.equal(
    (
      await request(
        '/orders',
        'POST',
        {
          customer_name: 'Book buyer',
          phone: '01012345678',
          address: '12 Main Street',
          city: 'Cairo',
          items: [{ listing_id: id, quantity: 1 }],
        },
        buyer.data.token,
      )
    ).status,
    409,
  );
  const cancelled = await request(
    `/admin/orders/${order.data.order.id}`,
    'PATCH',
    { status: 'cancelled' },
    admin.data.token,
  );
  assert.equal(cancelled.data.order.status, 'cancelled');
  assert.equal((await request('/listings')).data.total, 1);
  const ownerItem = await request(
    '/seller/listings',
    'POST',
    { ...input, title: 'Owner edition' },
    admin.data.token,
  );
  assert.equal(ownerItem.status, 201);
  assert.equal(ownerItem.data.item.status, 'approved');
  const ownerEdited = await request(
    `/seller/listings/${ownerItem.data.item.id}`,
    'PUT',
    { ...input, title: 'Owner edition updated', price: 500 },
    admin.data.token,
  );
  assert.equal(ownerEdited.data.item.status, 'approved');
  assert.equal((await request('/listings')).data.total, 2);
});

test('orders are separated by seller and can be managed independently', async () => {
  const admin = await request('/auth/login', 'POST', {
    email: 'admin@example.test',
    password: 'long-admin-password',
  });
  const seller2 = await request('/auth/register', 'POST', {
    name: 'Second seller',
    email: 'second@example.test',
    password: 'second-password',
    role: 'seller',
  });
  const buyer = await request('/auth/register', 'POST', {
    name: 'Another buyer',
    email: 'another@example.test',
    password: 'buyer-password',
  });
  const listing = {
    title: 'Single copy from seller',
    author: 'Author',
    description: '',
    item_type: 'book',
    item_condition: 'good',
    price: 90,
    quantity: 1,
  };
  const first = await request('/seller/listings', 'POST', listing, seller2.data.token);
  const second = await request(
    '/seller/listings',
    'POST',
    { ...listing, title: 'Owner single copy', price: 150 },
    admin.data.token,
  );
  await request(
    `/admin/listings/${first.data.item.id}/review`,
    'PATCH',
    { status: 'approved' },
    admin.data.token,
  );
  const payload = {
    customer_name: 'Another buyer',
    phone: '01012345678',
    address: '12 Main Street',
    city: 'Cairo',
    items: [
      { listing_id: first.data.item.id, quantity: 1 },
      { listing_id: second.data.item.id, quantity: 1 },
    ],
  };
  const placed = await request('/orders', 'POST', payload, buyer.data.token);
  assert.equal(placed.status, 201);
  assert.equal(placed.data.orders.length, 2);
  assert.deepEqual(
    placed.data.orders.map((order) => order.total).sort((a, b) => a - b),
    [90, 150],
  );
  assert.equal(placed.data.orders[0].items[0].seller_name, 'Second seller');
  const sellerOrders = await request('/seller/orders', 'GET', undefined, seller2.data.token);
  assert.equal(
    sellerOrders.data.items.filter((item) => item.order_id === placed.data.orders[0].id).length,
    1,
  );
  assert.equal(
    sellerOrders.data.items.some((item) => item.order_id === placed.data.orders[1].id),
    false,
  );
  await request(
    `/admin/orders/${placed.data.orders[0].id}`,
    'PATCH',
    { status: 'confirmed' },
    admin.data.token,
  );
  const mine = await request('/orders/mine', 'GET', undefined, buyer.data.token);
  assert.equal(
    mine.data.items.find((order) => order.id === placed.data.orders[0].id).status,
    'confirmed',
  );
  assert.equal(
    mine.data.items.find((order) => order.id === placed.data.orders[1].id).status,
    'new',
  );
  const unavailable = await request(
    '/orders',
    'POST',
    { ...payload, items: [{ listing_id: first.data.item.id, quantity: 2 }] },
    buyer.data.token,
  );
  assert.equal(unavailable.status, 409);
  assert.match(unavailable.data.error, /الكمية/);
});

test('auction endpoints are removed and archived bids remain while the book sells normally', async () => {
  const admin = await request('/auth/login', 'POST', {
    email: 'admin@example.test',
    password: 'long-admin-password',
  });
  const buyer = await request('/auth/login', 'POST', {
    email: 'another@example.test',
    password: 'buyer-password',
  });
  const listing = {
    title: 'Previously auctioned book',
    author: 'Scholar',
    description: 'One copy',
    item_type: 'rare',
    item_condition: 'excellent',
    price: 200,
    quantity: 1,
  };
  const rejected = await request(
    '/seller/listings',
    'POST',
    {
      ...listing,
      sale_mode: 'auction',
      duration_hours: 24,
    },
    admin.data.token,
  );
  assert.equal(rejected.status, 400);
  const created = await request('/seller/listings', 'POST', listing, admin.data.token);
  assert.equal(created.status, 201);
  const auctionId = db
    .prepare(
      "INSERT INTO auctions (listing_id, opening_price, ends_at) VALUES (?, 200, datetime('now', '1 day'))",
    )
    .run(created.data.item.id).lastInsertRowid;
  db.prepare('INSERT INTO auction_bids (auction_id, bidder_id, amount) VALUES (?, ?, 250)').run(
    auctionId,
    buyer.data.user.id,
  );
  assert.equal((await request('/auctions')).status, 404);
  assert.equal((await request(`/auctions/${auctionId}`)).status, 404);
  assert.equal(
    (await request(`/auctions/${auctionId}/bids`, 'POST', { amount: 300 }, buyer.data.token))
      .status,
    404,
  );
  assert.equal((await request('/admin/auctions', 'GET', undefined, admin.data.token)).status, 404);
  const publicItem = await request(`/listings/${created.data.item.id}`);
  assert.equal(publicItem.status, 200);
  assert.equal(publicItem.data.item.price, 200);
  assert.equal('auction_id' in publicItem.data.item, false);
  const order = await request(
    '/orders',
    'POST',
    {
      customer_name: 'Another buyer',
      phone: '01012345678',
      address: '12 Main Street',
      city: 'Cairo',
      items: [{ listing_id: created.data.item.id, quantity: 1 }],
    },
    buyer.data.token,
  );
  assert.equal(order.status, 201);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM auction_bids WHERE auction_id = ?').get(auctionId).n,
    1,
  );
});
