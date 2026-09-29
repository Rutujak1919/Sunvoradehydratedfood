/* =========================================================
   Sunvora Foods — owner admin dashboard
   Completely separate login from the storefront (there is no
   customer login at all — only this owner password).
   ========================================================= */

let IS_OWNER = false;

function openAdminLoginShortcut() {
  document.getElementById('ownerAuthError').style.display = 'none';
  showModal('ownerModal');
}

async function ownerLogin() {
  const username = document.getElementById('ow-user').value.trim();
  const password = document.getElementById('ow-pass').value;
  const errEl = document.getElementById('ownerAuthError');

  if (!username || !password) {
    errEl.textContent = 'Please enter both username and password.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const { token } = await API.post('/api/auth/owner-login', { username, password });
    localStorage.setItem('sunvora_owner_token', token);
    IS_OWNER = true;
    document.getElementById('ow-user').value = '';
    document.getElementById('ow-pass').value = '';
    errEl.style.display = 'none';
    closeModal('ownerModal');
    enterAdmin();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}
function ownerLogout() {
  localStorage.removeItem('sunvora_owner_token');
  IS_OWNER = false;
  exitAdmin();
  showToast('Owner logged out.');
}
function enterAdmin() {
  // Admin view has its own dedicated header (#adminTopBar) — the storefront
  // header, search bar and cart are hidden while you're in here, so nothing
  // customer-facing shows on this screen.
  document.querySelector('.main-header').style.display = 'none';
  document.querySelector('.category-nav').style.display = 'none';
  document.querySelector('.hero').style.display = 'none';
  document.getElementById('storefront').style.display = 'none';
  document.querySelector('footer').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';
  renderAdmin();
  window.scrollTo(0, 0);
}
function exitAdmin() {
  document.querySelector('.main-header').style.display = '';
  document.querySelector('.category-nav').style.display = '';
  document.querySelector('.hero').style.display = '';
  document.getElementById('storefront').style.display = '';
  document.querySelector('footer').style.display = '';
  document.getElementById('adminView').style.display = 'none';
}

async function renderAdmin() {
  try {
    const [stats, products, reviews, orders, subs] = await Promise.all([
      API.get('/api/admin/stats', 'owner'),
      API.get('/api/products'),
      API.get('/api/reviews', 'owner'),
      API.get('/api/orders', 'owner'),
      API.get('/api/subscribers', 'owner')
    ]);
    PRODUCTS = products;
    document.getElementById('adminStats').innerHTML = `
      <div class="stat"><div class="num">${stats.products}</div><div class="lab">Products</div></div>
      <div class="stat"><div class="num">${stats.orders}</div><div class="lab">Orders placed</div></div>
      <div class="stat"><div class="num">${stats.reviews}</div><div class="lab">Customer reviews</div></div>
      <div class="stat"><div class="num">${stats.subscribers}</div><div class="lab">Newsletter subscribers</div></div>
    `;
    renderAdminProducts(products);
    renderAdminReviews(products, reviews);

    // ========== UPDATED ORDERS TABLE ==========
    document.querySelector('#ordersTable tbody').innerHTML = orders.map(o => {
      const address = o.address || o.deliveryAddress || o.shippingAddress || '—';
      const mobile  = o.phone || o.mobile || o.phoneNumber || o.contact || '—';
      const payment = o.paymentMethod || o.payment || o.paymentType || o.method || '—';

      return `
        <tr>
          <td style="padding:8px;vertical-align:top;font-size:13px;">${o.id}</td>
          <td style="padding:8px;vertical-align:top;">
            <strong>${o.userName || o.name || '—'}</strong><br>
            <span style="color:#666;font-size:11px;">${o.userEmail || o.email || ''}</span>
          </td>
          <td style="padding:8px;vertical-align:top;font-size:12.5px;line-height:1.5;">
            ${o.items.map(i => `${i.name} (${i.variantLabel}) ×${i.qty}`).join('<br>')}
          </td>
          <td style="padding:8px;vertical-align:top;font-size:12.5px;max-width:180px;">${address}</td>
          <td style="padding:8px;vertical-align:top;">${mobile}</td>
          <td style="padding:8px;vertical-align:top;">
            ${payment === 'upi' || payment === 'UPI' ? 'UPI' : 
              (payment === 'cod' || payment === 'COD' ? 'Cash on Delivery' : payment)}
          </td>
          <td style="padding:8px;vertical-align:top;font-weight:600;">₹${o.total}</td>
          <td style="padding:8px;vertical-align:top;font-size:12px;white-space:nowrap;">
            ${new Date(o.createdAt).toLocaleString('en-IN')}
          </td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="padding:20px;text-align:center;color:#888;">No orders yet.</td></tr>`;
    // ========== END UPDATED ORDERS TABLE ==========

    document.querySelector('#subsTable tbody').innerHTML = subs.map(s =>
      `<tr><td>${s.email}</td><td>${new Date(s.createdAt).toLocaleDateString()}</td></tr>`
    ).join('') || `<tr><td colspan="2">No subscribers yet.</td></tr>`;
  } catch (e) {
    showToast(e.message);
    if (String(e.message).toLowerCase().includes('owner')) { ownerLogout(); openAdminLoginShortcut(); }
  }
}

function showAdminTab(tab) {
  document.querySelectorAll('.admin-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.classList.toggle('btn-dark', b.dataset.tab === tab);
    b.classList.toggle('btn-line', b.dataset.tab !== tab);
  });
  document.querySelectorAll('.admin-panel').forEach(p => {
    p.style.display = (p.id === 'panel-' + tab) ? 'block' : 'none';
    p.classList.toggle('active', p.id === 'panel-' + tab);
  });
}

/* ---------------- products + variants ---------------- */
function renderAdminProducts(products) {
  document.getElementById('adminProductList').innerHTML = products.map(p => `
    <div class="admin-card">
      <div class="admin-card-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="small-jar">${jarSVG(p.color, p.name, p.imageUrl)}</div>
          <span class="name">${p.name}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Delete Product</button>
      </div>
      <div class="admin-grid-form">
        <div class="field"><label>Jar/label colour</label><input value="${p.color}" onchange="updateProduct('${p.id}','color',this.value)"></div>
        <div class="field" style="grid-column:span 2;"><label>Real product photo URL (optional — leave blank to keep the illustration)</label><input value="${p.imageUrl || ''}" placeholder="https://..." onchange="updateProduct('${p.id}','imageUrl',this.value)"></div>
      </div>
      <div class="field" style="margin-top:8px;"><label>Description</label><input value="${p.desc}" onchange="updateProduct('${p.id}','desc',this.value)"></div>
      <div class="tag-checks">
        <label><input type="checkbox" ${p.tags.includes('bestseller') ? 'checked' : ''} onchange="toggleTag('${p.id}','bestseller',this.checked)"> Bestseller</label>
        <label><input type="checkbox" ${p.tags.includes('deal') ? 'checked' : ''} onchange="toggleTag('${p.id}','deal',this.checked)"> Today's Deal</label>
        <label><input type="checkbox" ${p.tags.includes('new') ? 'checked' : ''} onchange="toggleTag('${p.id}','new',this.checked)"> New Release</label>
        <label><input type="checkbox" ${p.tags.includes('sale') ? 'checked' : ''} onchange="toggleTag('${p.id}','sale',this.checked)"> Sale</label>
      </div>

      <div class="variant-table-wrap">
        <table class="variant-table">
          <thead><tr><th>Weight</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            ${p.variants.map(v => `
              <tr>
                <td><input value="${v.label}" onchange="updateVariant('${p.id}','${v.id}','label',this.value)"></td>
                <td><input type="number" value="${v.price}" onchange="updateVariant('${p.id}','${v.id}','price',this.value)"></td>
                <td><input type="number" value="${v.mrp}" onchange="updateVariant('${p.id}','${v.id}','mrp',this.value)"></td>
                <td><input type="number" value="${v.stock}" onchange="updateVariant('${p.id}','${v.id}','stock',this.value)"></td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteVariant('${p.id}','${v.id}')">✕</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="btn btn-line btn-sm" style="margin-top:8px;" onclick="addVariant('${p.id}')">+ Add Weight Option</button>
      <div style="font-size:11.5px;color:var(--muted);margin-top:8px;">Live rating: ${p.rating} ★ from ${p.ratingCount} customer review(s).</div>
    </div>`).join('');
}

async function updateProduct(id, field, value) {
  const payload = {}; payload[field] = value;
  try { await API.put('/api/products/' + id, payload, 'owner'); await renderAdmin(); showToast('Saved.'); }
  catch (e) { showToast(e.message); }
}
async function toggleTag(id, tag, on) {
  const p = PRODUCTS.find(x => x.id === id);
  let tags = p.tags.filter(t => t !== tag);
  if (on) tags.push(tag);
  try { await API.put('/api/products/' + id, { tags }, 'owner'); await renderAdmin(); }
  catch (e) { showToast(e.message); }
}
async function deleteProduct(id) {
  if (!confirm('Delete this product permanently?')) return;
  try { await API.del('/api/products/' + id, 'owner'); await renderAdmin(); showToast('Product deleted.'); }
  catch (e) { showToast(e.message); }
}

async function updateVariant(productId, variantId, field, value) {
  const p = PRODUCTS.find(x => x.id === productId);
  const variants = p.variants.map(v => v.id === variantId ? { ...v, [field]: ['price', 'mrp', 'stock'].includes(field) ? Number(value) || 0 : value } : v);
  try { await API.put('/api/products/' + productId, { variants }, 'owner'); await renderAdmin(); showToast('Saved.'); }
  catch (e) { showToast(e.message); }
}
async function addVariant(productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  const variants = [...p.variants, { id: 'v' + Date.now(), label: 'New size', price: 0, mrp: 0, stock: 0 }];
  try { await API.put('/api/products/' + productId, { variants }, 'owner'); await renderAdmin(); }
  catch (e) { showToast(e.message); }
}
async function deleteVariant(productId, variantId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (p.variants.length <= 1) { showToast('A product needs at least one weight option.'); return; }
  const variants = p.variants.filter(v => v.id !== variantId);
  try { await API.put('/api/products/' + productId, { variants }, 'owner'); await renderAdmin(); }
  catch (e) { showToast(e.message); }
}

/* ---------- helpers for Add Product multiple weights ---------- */
function createWeightRowHTML() {
  return `
    <tr>
      <td><input class="np-weight" placeholder="e.g. 100g" value="100g"></td>
      <td><input class="np-price" type="number" placeholder="Price" value=""></td>
      <td><input class="np-mrp" type="number" placeholder="MRP" value=""></td>
      <td><input class="np-stock" type="number" placeholder="Stock" value="50"></td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`;
}

function addNewProductWeightRow() {
  const tbody = document.getElementById('np-variants-body');
  if (tbody) {
    tbody.insertAdjacentHTML('beforeend', createWeightRowHTML());
  }
}

async function addProduct() {
  const name = document.getElementById('np-name').value.trim();
  const color = document.getElementById('np-color')?.value.trim() || '#4C7A3D';
  const desc = document.getElementById('np-desc').value.trim() || 'A pure Sunvora product.';
  const fileInput = document.getElementById('np-image');

  if (!name) {
    showToast('Please enter a product name.');
    return;
  }

  // Collect all weight rows from the new table
  const weightRows = document.querySelectorAll('#np-variants-body tr');
  const variants = [];

  weightRows.forEach(row => {
    const label = row.querySelector('.np-weight')?.value.trim();
    const price = Number(row.querySelector('.np-price')?.value) || 0;
    const mrp   = Number(row.querySelector('.np-mrp')?.value) || price;
    const stock = Number(row.querySelector('.np-stock')?.value) || 0;

    if (label && price > 0) {
      variants.push({
        id: 'v' + Date.now() + Math.random().toString(36).slice(2, 6),
        label,
        price,
        mrp,
        stock
      });
    }
  });

  if (variants.length === 0) {
    showToast('Add at least one weight option with a price.');
    return;
  }

  const tags = [];
  if (document.getElementById('np-bestseller')?.checked) tags.push('bestseller');
  if (document.getElementById('np-deal')?.checked) tags.push('deal');
  if (document.getElementById('np-new')?.checked) tags.push('new');
  if (document.getElementById('np-sale')?.checked) tags.push('sale');

  let imageUrl = '';

  // If user selected a file → upload it first
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);

      const token = localStorage.getItem('sunvora_owner_token');
      const res = await fetch('/api/owner/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      imageUrl = data.imageUrl;
    } catch (e) {
      showToast('Image upload failed: ' + e.message);
      return;
    }
  }

  try {
    await API.post('/api/products', {
      name,
      color,
      desc,
      tags,
      imageUrl,
      variants
    }, 'owner');

    // Clear form
    document.getElementById('np-name').value = '';
    document.getElementById('np-desc').value = '';
    if (document.getElementById('np-color')) document.getElementById('np-color').value = '#4C7A3D';
    if (fileInput) fileInput.value = '';
    ['np-bestseller', 'np-deal', 'np-new', 'np-sale'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    // Reset weight table to one empty row
    const tbody = document.getElementById('np-variants-body');
    if (tbody) {
      tbody.innerHTML = createWeightRowHTML();
    }

    await renderAdmin();
    showToast('Product added successfully!');
  } catch (e) {
    showToast(e.message);
  }
}

/* ---------------- reviews ---------------- */
function renderAdminReviews(products, reviews) {
  let html = '';
  products.forEach(p => {
    const revs = reviews.filter(r => r.productId === p.id);
    if (revs.length === 0) return;
    html += `<div class="admin-card"><div class="admin-card-head"><span class="name">${p.name}</span></div>`;
    revs.forEach(r => {
      html += `<div class="review">
        <div class="who">${escapeHtml(r.userName)} <span class="rstars">${starString(r.rating)}</span></div>
        <div class="comment">${escapeHtml(r.comment)}</div>
        <div class="date">${new Date(r.createdAt).toLocaleDateString()}</div>
        <div class="reply-row">
          <textarea rows="2" placeholder="Reply to this review as Sunvora Foods…" id="reply-${r.id}">${r.ownerReply || ''}</textarea>
          <button class="btn btn-line btn-sm" style="margin-top:6px;" onclick="saveReply('${r.id}')">Save Reply</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  document.getElementById('adminReviewList').innerHTML = html || `<div class="empty-msg">No customer reviews yet.</div>`;
}
async function saveReply(reviewId) {
  const text = document.getElementById('reply-' + reviewId).value.trim();
  try { await API.post(`/api/reviews/${reviewId}/reply`, { reply: text }, 'owner'); showToast('Reply saved.'); }
  catch (e) { showToast(e.message); }
}
// When visiting /owner directly, open login or go straight into the dashboard
(function () {
  if (window.location.pathname === '/owner' || window.location.pathname === '/owner/') {
    const token = localStorage.getItem('sunvora_owner_token');
    if (token) {
      IS_OWNER = true;
      enterAdmin();
    } else {
      openAdminLoginShortcut();
    }
  }

 function previewNewImage(input) {
  const preview = document.getElementById('np-image-preview');
  const nameSpan = document.getElementById('np-image-name');

  if (input.files && input.files[0]) {
    nameSpan.textContent = input.files[0].name;
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    nameSpan.textContent = 'No file chosen';
    preview.style.display = 'none';
  }
} 
})();