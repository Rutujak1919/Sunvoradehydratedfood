# Sunvora Foods — full website with a real backend

This is a complete, working store: a Node.js server that actually saves customers,
orders and reviews to a database file, plus the storefront and an owner-only
admin dashboard. No fake data, no localStorage tricks — everything you do
(sign up, add a review, place an order, edit a product as the owner) is saved
by the server and is still there the next time you open the site.

## 1. Project structure — what every file is for

```
sunvora-foods/
├── server.js              ← the backend. Handles logins, products, orders, reviews.
├── package.json           ← lists the small number of libraries the server needs
├── .env.example            ← copy this to .env and set your own passwords/secrets
├── .gitignore
├── data/
│   └── db.json            ← the "database". All products/customers/orders/reviews live here.
└── public/                 ← everything the browser downloads (the actual website)
    ├── index.html          ← page structure (header, hero, product grid, admin dashboard, modals)
    ├── css/
    │   └── style.css       ← every visual style: colours, layout, luxury look
    ├── js/
    │   ├── jar.js           ← draws the original jar illustration for each product
    │   ├── i18n.js           ← the 10 Indian-language translations + switch logic
    │   ├── api.js            ← talks to the backend (fetch requests)
    │   ├── app.js             ← storefront logic: search, cart, checkout, reviews, login
    │   └── admin.js           ← owner dashboard logic (separate from customer login)
    └── assets/
        ├── logo-icon.png    ← your logo, cropped into a circular badge (used in the header)
        └── logo-full.jpg    ← your full logo lock-up (used in the footer)
```

**Why a `data/db.json` file instead of a "real" database?** It behaves exactly like
a database from the website's point of view — the server reads and writes it,
customers never see it — and it needs zero setup, which is the fastest way to get
you a fully working backend today. If your store grows past a few hundred orders a day,
tell me and I'll swap this for MongoDB or PostgreSQL with no changes to the storefront.

## 2. Running it in VS Code (step by step)

1. **Install Node.js** (one-time, if you don't have it): go to
   [nodejs.org](https://nodejs.org), download the **LTS** version, install it.
   Confirm it worked by opening a terminal and typing `node -v` — it should print
   a version number.

2. **Open the project folder in VS Code**: `File → Open Folder…` → select the
   `sunvora-foods` folder.

3. **Open a terminal inside VS Code**: `Terminal → New Terminal` (or `` Ctrl+` ``).

4. **Create your secrets file**: in that terminal, run:
   ```
   copy .env.example .env
   ```
   (on Mac/Linux use `cp .env.example .env` instead). Then open the new `.env`
   file and change `OWNER_PASSWORD` to whatever you want your real admin
   password to be, and change `JWT_SECRET` to any long random string.

5. **Install the dependencies** (downloads the small number of libraries the
   server uses):
   ```
   npm install
   ```

6. **Start the server**:
   ```
   npm start
   ```
   You'll see: `Sunvora Foods server running: http://localhost:3000`

7. **Open the site**: go to **http://localhost:3000** in your browser. That's
   your real, working website, running from your own laptop.

To stop the server, click in the terminal and press `Ctrl+C`. Run `npm start`
again any time you want it back up. Every time you restart, all your data
(products, customers, orders, reviews) is still there, because it's saved in
`data/db.json`.

## 3. How the backend actually works

- **Customer accounts** — signing up hashes the password (never stored in
  plain text) and saves the customer to `data/db.json`. Logging in gives the
  browser a token that proves who they are for future requests.
- **Search** — typing in the search bar calls the server (`GET /api/products?q=...`)
  as you type, so it always searches the real, current product list — not a
  fixed list baked into the page. This is what makes it work smoothly no
  matter how many products you add later.
- **Reviews** — submitting a review is a signed-in-only request to the
  server; the server recalculates that product's star rating immediately, so
  it updates live for every visitor.
- **Checkout** — the server (not the browser) checks stock and calculates the
  total, so customers can't trick the price by editing the page.
- **Owner dashboard** — logging in as the owner (the "Owner Panel" link in the
  navigation bar) gets a *separate* token with its own permissions. Customers
  are never shown this login option, and the admin screens only render for
  someone holding a valid owner token.

## 4. Making it a live public website

Running it with `npm start` only makes it visible on your own laptop. To get
a real public link, you need to put this Node.js app on a host that can run
Node — most shared/PHP hosting (like the `webbusinesstech.in` plan your old
site was on) **cannot run Node.js apps**, only PHP. You have two good options:

**Option A — free and simple (recommended to start): Render.com**
1. Create a free account at [render.com](https://render.com).
2. Push this project to a GitHub repository (VS Code has a built-in "Publish
   to GitHub" button in the Source Control tab).
3. In Render, click **New → Web Service**, connect your GitHub repo.
4. Build command: `npm install`. Start command: `npm start`.
5. Add your `.env` values (OWNER_PASSWORD, JWT_SECRET) under Render's
   "Environment" tab — never upload your real `.env` file to GitHub.
6. Deploy. Render gives you a live `https://yourapp.onrender.com` link.
   You can later point your own domain (e.g. `sunvorafoods.com`) at it.

**Option B — if you want to keep your current host**
Ask your hosting provider (or check their cPanel) whether they support
**"Setup Node.js App"**. Many Indian hosts (Hostinger business+ plans,
some GoDaddy plans) do. If yours does, you'd upload this whole folder and
point the app's entry file to `server.js`.

Either way — buy/point a domain name at whichever host you choose, and that
domain will show this exact website, live, to anyone.

## 6. Getting signup/order emails working

Every time someone creates an account or places an order, the server now sends
a real email — to **you** (a notification) and, for signups, a welcome email
to the **customer**. This uses a library called Nodemailer, configured
entirely through your `.env` file — no code changes needed.

**Easiest option: use a Gmail account you own.**
1. Go to your Google Account → **Security** → turn on **2-Step Verification**
   (required before Google will let you create an App Password).
2. Still under Security, search for **"App Passwords"**, create one — choose
   "Mail" as the app — and copy the 16-character password it gives you.
3. In your `.env` file, fill in:
   ```
   OWNER_EMAIL=your-real-email@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-gmail-address@gmail.com
   SMTP_PASS=the 16-character app password (no spaces)
   SMTP_FROM="Sunvora Foods" <your-gmail-address@gmail.com>
   ```
4. Restart the server (`Ctrl+C`, then `npm start`). Sign up as a test
   customer on the site — you should get an email within a few seconds, and
   the new customer's inbox gets a welcome email too.

**If you'd rather use a different provider** (Hostinger email, Outlook,
SendGrid, etc.), just change `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` /
`SMTP_PASS` to that provider's SMTP details — everything else stays the same.

**Note:** until you fill in `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, the site still
works completely normally — it just skips sending the email and prints a note
in the terminal, so you can finish everything else first and turn emails on
whenever you're ready.

## 5. Before you go live, please change:

- `OWNER_PASSWORD` in `.env` — don't ship the demo password.
- `JWT_SECRET` in `.env` — a long random string.
- The social links in `public/index.html` (search for `sunvorafoods` near the
  footer icons) — point them at your real Instagram / Facebook / LinkedIn /
  Twitter accounts.
- Contact details in the footer (address/phone/email) if they change.
