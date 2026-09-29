// =============================================================
// mailer.js — sends real emails via SMTP (e.g. Gmail).
// If SMTP isn't configured yet, emails are skipped (and logged
// to the console) instead of crashing the server, so the site
// still works while you're setting this up.
// =============================================================
const nodemailer = require('nodemailer');

const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/other
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendMail({ to, subject, html }) {
  if (!isConfigured) {
    console.log(`\n[mailer] SMTP not configured yet — skipped email to ${to}: "${subject}"`);
    console.log('[mailer] Set SMTP_HOST / SMTP_USER / SMTP_PASS / OWNER_EMAIL in .env to enable real emails.\n');
    return { skipped: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Sunvora Foods" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    return { sent: true };
  } catch (err) {
    console.error('[mailer] Failed to send email:', err.message);
    return { error: err.message };
  }
}

// Sent to YOU (the owner) whenever someone creates an account.
function sendSignupNotificationToOwner(user) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) { console.log('[mailer] OWNER_EMAIL not set in .env — skipping owner signup notification.'); return Promise.resolve(); }
  return sendMail({
    to: ownerEmail,
    subject: `New customer signup — ${user.name}`,
    html: `
      <div style="font-family:sans-serif;">
        <h2 style="color:#173A2A;">New Sunvora Foods account created</h2>
        <table cellpadding="6" style="border-collapse:collapse;">
          <tr><td><b>Name</b></td><td>${user.name}</td></tr>
          <tr><td><b>Email</b></td><td>${user.email}</td></tr>
          <tr><td><b>Signed up</b></td><td>${new Date().toLocaleString()}</td></tr>
        </table>
      </div>`
  });
}

// Sent to the CUSTOMER as a welcome confirmation.
function sendWelcomeEmailToCustomer(user) {
  return sendMail({
    to: user.email,
    subject: `Welcome to Sunvora Foods, ${user.name.split(' ')[0]}!`,
    html: `
      <div style="font-family:sans-serif;">
        <h2 style="color:#173A2A;">Welcome to Sunvora Foods</h2>
        <p>Hi ${user.name.split(' ')[0]}, your account has been created successfully. You can now sign in any time to track your orders and leave reviews.</p>
        <p style="color:#6B7568;font-size:13px;">— The Sunvora Foods team</p>
      </div>`
  });
}

// Sent to YOU whenever an order is placed.
// Sent to YOU whenever an order is placed.
function sendOrderNotificationToOwner(order) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return Promise.resolve();
  const rows = order.items.map(i => `<tr><td>${i.name} (${i.variantLabel})</td><td>${i.qty}</td><td>₹${i.price * i.qty}</td></tr>`).join('');
  return sendMail({
    to: ownerEmail,
    subject: `New order ${order.id} — ₹${order.total}`,
    html: `
      <div style="font-family:sans-serif;">
        <h2 style="color:#173A2A;">New order placed</h2>
        <p><b>Customer:</b> ${order.userName} (${order.userEmail})</p>
        ${order.phone ? `<p><b>Phone:</b> ${order.phone}</p>` : ''}
        <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd;">
          <tr style="background:#f2f2f2;"><th>Item</th><th>Qty</th><th>Amount</th></tr>
          ${rows}
        </table>
        <p><b>Total: ₹${order.total}</b></p>
      </div>`
  });
}

// Sent to the CUSTOMER as order confirmation
function sendOrderConfirmationToCustomer(order) {
  const rows = order.items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.name} (${i.variantLabel})</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${i.price * i.qty}</td>
    </tr>`).join('');

  return sendMail({
    to: order.userEmail,
    subject: `Order Confirmed — ${order.id} | Sunvora Foods`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#20261F;">
        <div style="background:#173A2A;color:#fff;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;font-size:22px;">Thank you for your order!</h2>
          <p style="margin:8px 0 0;opacity:0.85;">We have received your order successfully.</p>
        </div>

        <div style="background:#fff;padding:24px;border:1px solid #EFE9DA;border-top:none;border-radius:0 0 12px 12px;">
          <p>Hi <b>${order.userName}</b>,</p>
          <p>Your order <b>${order.id}</b> has been received. Here’s a summary:</p>

          <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;">
            <thead>
              <tr style="background:#f4f9f4;">
                <th style="padding:10px;text-align:left;">Product</th>
                <th style="padding:10px;text-align:center;">Qty</th>
                <th style="padding:10px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <p style="font-size:16px;font-weight:700;text-align:right;">
            Total: ₹${order.total}
          </p>

          <p style="color:#6B7568;font-size:13px;margin-top:24px;">
            We will process your order shortly. You can track it anytime using the email you provided.
          </p>

          <p style="color:#6B7568;font-size:13px;">— The Sunvora Foods team</p>
        </div>
      </div>`
  });
}

module.exports = {
  sendMail,
  sendSignupNotificationToOwner,
  sendWelcomeEmailToCustomer,
  sendOrderNotificationToOwner,
  sendOrderConfirmationToCustomer,
  isConfigured
};