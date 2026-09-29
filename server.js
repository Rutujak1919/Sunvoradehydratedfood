// =============================================================
// Sunvora Foods — backend server
// Node.js + Express + a JSON file acting as the database.
// Run with:  npm install   then   npm start
// =============================================================

require('dotenv').config();
const multer = require('multer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mailer = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Sunvora@Owner1';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- simple JSON "database" helpers ----------------
function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}
// ---------------- Image Upload ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'imag'));
  },
  filename: function (req, file, cb) {
    // Keep original name but make it safe
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_ ]/g, '');
    cb(null, Date.now() + '-' + safeName);
  }
});
const upload = multer({ storage: storage });

// ---------------- auth middleware ----------------
function authCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') throw new Error('wrong role');
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Your session has expired, please sign in again.' });
  }
}
function authOwner(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Owner login required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'owner') throw new Error('wrong role');
    req.owner = true;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Owner session invalid, please log in again.' });
  }
}

// =========================================================
// AUTH ROUTES
// =========================================================

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Please fill in all fields.' });
  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: 'u' + Date.now(), name, email: email.toLowerCase(), passwordHash: hash, createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDB(db);
  const token = jwt.sign({ role: 'customer', id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { name: user.name, email: user.email } });

  // Fire the emails after responding, so a slow/misconfigured mail server
  // never makes signup feel slow or fail for the customer.
  mailer.sendSignupNotificationToOwner(user).catch(() => {});
  mailer.sendWelcomeEmailToCustomer(user).catch(() => {});
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  const token = jwt.sign({ role: 'customer', id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { name: user.name, email: user.email } });
});

app.post('/api/auth/owner-login', (req, res) => {
  const { username, password } = req.body || {};
  const OWNER_USERNAME = process.env.OWNER_USERNAME || 'SunvoraFood';
  const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Rabhisha@2009';

  // ===== TEMPORARY DEBUG LOGS (remove later) =====
  console.log('----- OWNER LOGIN ATTEMPT -----');
  console.log('Received Username :', username);
  console.log('Received Password :', password);
  console.log('Stored Username   :', OWNER_USERNAME);
  console.log('Stored Password   :', OWNER_PASSWORD);
  console.log('Username match    :', username === OWNER_USERNAME);
  console.log('Password match    :', password === OWNER_PASSWORD);
  console.log('--------------------------------');
  // ===============================================

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (username !== OWNER_USERNAME || password !== OWNER_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// =========================================================
// PRODUCT ROUTES
// =========================================================

// Public: list products, with optional live search (?q=) and tag filter (?tag=)
app.get('/api/products', (req, res) => {
  const db = readDB();
  let list = db.products;
  const q = (req.query.q || '').trim().toLowerCase();
  const tag = (req.query.tag || '').trim().toLowerCase();
  if (q) {
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }
  if (tag && tag !== 'all') {
    list = list.filter(p => p.tags.includes(tag));
  }
  res.json(list);
});

app.get('/api/products/:id', (req, res) => {
  const db = readDB();
  const p = db.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json(p);
});

// Owner only: add / edit / delete products
app.post('/api/products', authOwner, (req, res) => {
  const db = readDB();
  const { name, color, desc, tags, imageUrl, variants } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Product name is required.' });
  const cleanVariants = (Array.isArray(variants) && variants.length > 0) ? variants.map((v, i) => ({
    id: v.id || ('v' + (i + 1)),
    label: v.label || '250g',
    price: Number(v.price) || 0,
    mrp: Number(v.mrp) || Number(v.price) || 0,
    stock: Number(v.stock) || 0
  })) : [{ id: 'v1', label: '250g', price: 0, mrp: 0, stock: 0 }];
  const product = {
    id: 'p' + Date.now(),
    name, color: color || '#4C7A3D',
    desc: desc || 'A pure Sunvora product.', tags: Array.isArray(tags) ? tags : [],
    imageUrl: imageUrl || '',
    variants: cleanVariants,
    rating: 4.5, ratingCount: 0
  };
  db.products.push(product);
  writeDB(db);
  res.json(product);
});

app.put('/api/products/:id', authOwner, (req, res) => {
  const db = readDB();
  const p = db.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const fields = ['name', 'color', 'desc', 'tags', 'imageUrl', 'variants'];
  fields.forEach(f => { if (req.body[f] !== undefined) p[f] = req.body[f]; });
  writeDB(db);
  res.json(p);
});

app.delete('/api/products/:id', authOwner, (req, res) => {
  const db = readDB();
  db.products = db.products.filter(x => x.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});


// Owner: upload product image
app.post('/api/owner/upload', authOwner, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  // Return the path that the frontend can use
  const imageUrl = 'imag/' + req.file.filename;
  res.json({ imageUrl });
});

// =========================================================
// REVIEW ROUTES
// =========================================================

app.get('/api/products/:id/reviews', (req, res) => {
  const db = readDB();
  const list = db.reviews.filter(r => r.productId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

app.post('/api/products/:id/reviews', authCustomer, (req, res) => {
  const db = readDB();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const { rating, comment } = req.body || {};
  if (!rating || !comment) return res.status(400).json({ error: 'Please add a star rating and a comment.' });
  const review = {
    id: 'r' + Date.now(), productId: product.id, userName: req.user.name, userEmail: req.user.email,
    rating: Number(rating), comment, ownerReply: null, createdAt: new Date().toISOString()
  };
  db.reviews.push(review);
  // recompute product's live average rating
  const productReviews = db.reviews.filter(r => r.productId === product.id);
  product.rating = Math.round((productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length) * 10) / 10;
  product.ratingCount = productReviews.length;
  writeDB(db);
  res.json(review);
});

app.post('/api/reviews/:reviewId/reply', authOwner, (req, res) => {
  const db = readDB();
  const review = db.reviews.find(r => r.id === req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  review.ownerReply = req.body.reply || '';
  writeDB(db);
  res.json(review);
});

// owner: see every review across all products, for the moderation tab
app.get('/api/reviews', authOwner, (req, res) => {
  const db = readDB();
  res.json(db.reviews);
});

// =========================================================
// ORDER ROUTES (checkout, and saved customer data)
// =========================================================

app.post('/api/orders', (req, res) => {
  const db = readDB();
  const { items, name, email, phone, address, paymentMethod } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!address || !address.trim()) {
    return res.status(400).json({ error: 'Delivery address is required.' });
  }

  let total = 0;
  const lineItems = [];

  for (const it of items) {
    const product = db.products.find(p => p.id === it.productId);
    if (!product) continue;
    const variant = product.variants.find(v => v.id === it.variantId);
    if (!variant) continue;

    const qty = Math.max(1, Number(it.qty) || 1);
    if (variant.stock < qty) {
      return res.status(400).json({ error: `Only ${variant.stock} left of ${product.name} (${variant.label}).` });
    }

    variant.stock -= qty;
    total += variant.price * qty;
    lineItems.push({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantLabel: variant.label,
      price: variant.price,
      qty
    });
  }

  if (lineItems.length === 0) {
    return res.status(400).json({ error: 'No valid items in cart.' });
  }

  const order = {
    id: 'ORD' + Date.now(),
    userName: name,
    userEmail: email.toLowerCase(),
    phone: phone || '',
    address: address.trim(),          // ← saving address
    paymentMethod: paymentMethod || 'cod',
    items: lineItems,
    total,
    status: 'Placed',
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);
  writeDB(db);
  res.json(order);

  // Send emails
  mailer.sendOrderNotificationToOwner(order).catch(() => {});
  mailer.sendOrderConfirmationToCustomer(order).catch(() => {});
});
app.get('/api/orders/mine', authCustomer, (req, res) => {
  const db = readDB();
  const mine = db.orders.filter(o => o.userEmail === req.user.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(mine);
});

app.get('/api/orders', authOwner, (req, res) => {
  const db = readDB();
  res.json(db.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
// Guest order lookup by email
app.get('/api/orders/lookup', (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const db = readDB();
  const orders = db.orders
    .filter(o => o.userEmail === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json(orders);
});

// =========================================================
// NEWSLETTER
// =========================================================

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email.' });
  const db = readDB();
  if (!db.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase())) {
    db.subscribers.push({ email, createdAt: new Date().toISOString() });
    writeDB(db);
  }
  res.json({ ok: true });
});

app.get('/api/subscribers', authOwner, (req, res) => {
  const db = readDB();
  res.json(db.subscribers.slice().reverse());
});

// =========================================================
// ADMIN STATS (owner dashboard summary numbers)
// =========================================================
app.get('/api/admin/stats', authOwner, (req, res) => {
  const db = readDB();
  res.json({
    products: db.products.length,
    orders: db.orders.length,
    reviews: db.reviews.length,
    subscribers: db.subscribers.length,
    customers: db.users.length
  });
});

// Fallback: send index.html for the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Owner dashboard page
app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Sunvora Foods server running:  http://localhost:${PORT}\n`);
});