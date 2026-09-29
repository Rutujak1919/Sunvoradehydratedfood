/* =========================================================
   Sunvora Foods — storefront frontend
   No customer accounts: browsing, reviews and checkout all
   work as a guest (just a name + email, saved with the order).
   ========================================================= */

let PRODUCTS = [];
let CART = JSON.parse(localStorage.getItem('sunvora_cart') || '{}'); // key: `${productId}__${variantId}` -> qty
let GUEST = JSON.parse(localStorage.getItem('sunvora_guest') || 'null'); // {name,email} remembered for convenience only
let CURRENT_FILTER = 'all';
let MODAL_PRODUCT_ID = null;
let MODAL_VARIANT_ID = null;
let MODAL_QTY = 1;
let SELECTED_STARS = 0;
let searchDebounce = null;

async function init() {
  const savedLang = localStorage.getItem('sunvora_lang') || 'en';
  document.getElementById('langSelect').value = savedLang;
  applyLanguage(savedLang);
  document.getElementById('langSelect').addEventListener('change', e => applyLanguage(e.target.value));

  // (hero jar illustration removed — background photo used instead)

  await loadProducts();
  updateAccountUI();
  updateCartUI();


  // ===== SEARCH =====
  const searchInput = document.getElementById('searchInput');

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideSuggestions();
      runSearch();
    }
    if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  // Optional: show suggestions while typing (but do NOT search yet)
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(showSearchSuggestions, 200);
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.searchbar')) {
      hideSuggestions();
    }
  });
    document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(runSearch, 300);
  });
  document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(searchDebounce); runSearch(); } });
}

async function loadProducts() {
  try {
    PRODUCTS = await API.get('/api/products');
    renderAll();
  } catch (e) {
    showToast('Could not reach the server. Is it running? (npm start)');
  }
}

/* ================= helpers ================= */
function cheapestVariant(p) { return p.variants.slice().sort((a, b) => a.price - b.price)[0]; }
function totalStock(p) { return p.variants.reduce((s, v) => s + v.stock, 0); }
function cartKey(productId, variantId) { return productId + '__' + variantId; }

/* ================= RENDER PRODUCTS ================= */
function productCard(p) {
  const cheapest = cheapestVariant(p);
  const inStock = totalStock(p) > 0;

  let badge = "";
  if (!inStock) badge = `<span class="badge stockout">Out of Stock</span>`;
  else if (p.tags.includes('deal')) badge = `<span class="badge deal">Deal</span>`;
  else if (p.tags.includes('bestseller')) badge = `<span class="badge">Bestseller</span>`;
  else if (p.tags.includes('new')) badge = `<span class="badge">New</span>`;

  const options = p.variants.map(v => 
    `<option value="${v.id}" ${v.id === cheapest.id ? 'selected' : ''} ${v.stock === 0 ? 'disabled' : ''}>
      ${v.label}
    </option>`
  ).join('');

  return `
  <div class="card" data-product-id="${p.id}">
    <div class="card-img" onclick="openProduct('${p.id}')">
      ${badge}
      ${jarSVG(p.color, p.name, p.imageUrl)}
    </div>
    <div class="card-body">
      <div class="name" onclick="openProduct('${p.id}')">${p.name}</div>
      <div class="stars">${starString(p.rating)} <span class="count">${p.rating} (${p.ratingCount})</span></div>

      <div class="weight-row">
        <select class="weight-select" onchange="onCardVariantChange(this, '${p.id}')">
          ${options}
        </select>
      </div>

      <div class="price-row">
        <span class="now" id="price-${p.id}">₹${cheapest.price}</span>
        <span class="mrp" id="mrp-${p.id}" style="${cheapest.mrp > cheapest.price ? '' : 'display:none'}">₹${cheapest.mrp}</span>
        <span class="off" id="off-${p.id}" style="${cheapest.mrp > cheapest.price ? '' : 'display:none'}">
          ${cheapest.mrp > cheapest.price ? Math.round(100 - (cheapest.price / cheapest.mrp * 100)) + '% off' : ''}
        </span>
      </div>

      <div class="stock-note" id="stock-${p.id}">${inStock ? 'In stock' : 'Currently unavailable'}</div>

      <button class="btn btn-dark btn-sm" 
              id="btn-${p.id}"
              onclick="event.stopPropagation(); addSelectedToCart('${p.id}')"
              ${!inStock ? 'disabled style="opacity:.5;"' : ''}>
        Add to Cart
      </button>
    </div>
  </div>`;
}

function onCardVariantChange(selectEl, productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return;

  const variantId = selectEl.value;
  const v = p.variants.find(x => x.id === variantId);
  if (!v) return;

  document.getElementById(`price-${productId}`).textContent = `₹${v.price}`;

  const mrpEl = document.getElementById(`mrp-${productId}`);
  const offEl = document.getElementById(`off-${productId}`);

  if (v.mrp > v.price) {
    mrpEl.style.display = '';
    mrpEl.textContent = `₹${v.mrp}`;
    offEl.style.display = '';
    offEl.textContent = Math.round(100 - (v.price / v.mrp * 100)) + '% off';
  } else {
    mrpEl.style.display = 'none';
    offEl.style.display = 'none';
  }

  const stockEl = document.getElementById(`stock-${productId}`);
  if (v.stock === 0) {
    stockEl.textContent = 'Out of stock';
    stockEl.classList.add('low');
  } else if (v.stock < 10) {
    stockEl.textContent = `Only ${v.stock} left`;
    stockEl.classList.add('low');
  } else {
    stockEl.textContent = 'In stock';
    stockEl.classList.remove('low');
  }
}

function addSelectedToCart(productId) {
  const select = document.querySelector(`.card[data-product-id="${productId}"] .weight-select`);
  if (!select) return;

  const variantId = select.value;
  const p = PRODUCTS.find(x => x.id === productId);
  const v = p.variants.find(x => x.id === variantId);

  if (!v || v.stock === 0) {
    showToast('This size is currently out of stock');
    return;
  }

  const key = cartKey(productId, variantId);
  CART[key] = (CART[key] || 0) + 1;
  saveCart();
  showToast(`${p.name} (${v.label}) added to cart`);
}

function renderAll() {
  document.getElementById('gridBestsellers').innerHTML = PRODUCTS.filter(p => p.tags.includes('bestseller')).map(productCard).join('') || `<div class="empty-msg">No bestsellers yet.</div>`;
  document.getElementById('gridDeals').innerHTML = PRODUCTS.filter(p => p.tags.includes('deal')).map(productCard).join('') || `<div class="empty-msg">No deals right now.</div>`;
  document.getElementById('gridNew').innerHTML = PRODUCTS.filter(p => p.tags.includes('new')).map(productCard).join('') || `<div class="empty-msg">No new releases yet.</div>`;
  renderFiltered();
  updateCartUI();
}
function renderFiltered() {
  let list = PRODUCTS;
  let title = "All Products";
  if (CURRENT_FILTER === 'bestseller') { list = PRODUCTS.filter(p => p.tags.includes('bestseller')); title = "Bestsellers"; }
  else if (CURRENT_FILTER === 'deal') { list = PRODUCTS.filter(p => p.tags.includes('deal')); title = "Today's Deals"; }
  else if (CURRENT_FILTER === 'new') { list = PRODUCTS.filter(p => p.tags.includes('new')); title = "New Releases"; }
  else if (CURRENT_FILTER === 'sale') { list = PRODUCTS.filter(p => p.tags.includes('sale')); title = "Sale"; }
  document.getElementById('allTitle').textContent = title;
  document.getElementById('gridAll').innerHTML = list.map(productCard).join('') || `<div class="empty-msg">No products found.</div>`;
}
function filterCat(cat) {
  CURRENT_FILTER = cat;
  document.getElementById('searchInput').value = '';
  renderFiltered();
  document.getElementById('allProductsSection').scrollIntoView({ behavior: 'smooth' });
}
/* ================= LIVE SEARCH SUGGESTIONS ================= */
function showSearchSuggestions() {
  const input = document.getElementById('searchInput');
  const box = document.getElementById('searchSuggestions');
  if (!box) return;

  const q = input.value.trim().toLowerCase();

  if (!q) {
    hideSuggestions();
    return;
  }

  const matches = PRODUCTS.filter(p => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.desc || '').toLowerCase();
    const tags = (p.tags || []).join(' ').toLowerCase();
    return name.includes(q) || desc.includes(q) || tags.includes(q);
  }).slice(0, 8);

  if (matches.length === 0) {
    box.innerHTML = `<div class="no-result">No products found</div>`;
    box.classList.add('show');
    return;
  }

  box.innerHTML = matches.map(p => {
    const tag = p.tags?.includes('bestseller') ? 'Bestseller' :
                p.tags?.includes('deal') ? 'Deal' :
                p.tags?.includes('new') ? 'New' : '';
    return `
      <div class="suggestion-item" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
        <span class="s-name">${escapeHtml(p.name)}</span>
        ${tag ? `<span class="s-tag">${tag}</span>` : ''}
      </div>`;
  }).join('');

  box.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const name = item.dataset.name;
      input.value = name;
      hideSuggestions();
      openProduct(id);
    });
  });

  box.classList.add('show');
}

function hideSuggestions() {
  const box = document.getElementById('searchSuggestions');
  if (box) box.classList.remove('show');
}
async function runSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  
  if (!q) {
    CURRENT_FILTER = 'all';
    renderFiltered();
    return;
  }

  const results = PRODUCTS.filter(p => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.desc || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  document.getElementById('allTitle').textContent = `Results for "${q}"`;
  document.getElementById('gridAll').innerHTML = results.map(productCard).join('') || 
    `<div class="empty-msg">No products match your search.</div>`;

  document.getElementById('allProductsSection').scrollIntoView({ behavior: 'smooth' });
}
function goHome() {
  CURRENT_FILTER = 'all';
  document.getElementById('searchInput').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderFiltered();
}

/* ================= PRODUCT MODAL ================= */
async function openProduct(id) {
  MODAL_PRODUCT_ID = id; MODAL_QTY = 1; SELECTED_STARS = 0;
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  MODAL_VARIANT_ID = cheapestVariant(p).id;

  document.getElementById('pmImgWrap').innerHTML = jarSVG(p.color, p.name, p.imageUrl);
  document.getElementById('pmName').textContent = p.name;
  document.getElementById('pmStars').innerHTML = `${starString(p.rating)} <span style="color:var(--muted);">${p.rating} · ${p.ratingCount} reviews</span>`;
  document.getElementById('pmDesc').textContent = p.desc;
  const badgeEl = document.getElementById('pmBadge');
  if (p.tags.length) { badgeEl.style.display = 'inline-block'; badgeEl.textContent = p.tags[0] === 'bestseller' ? 'Bestseller' : p.tags[0] === 'deal' ? 'Deal' : p.tags[0] === 'new' ? 'New Release' : 'Sale'; }
  else { badgeEl.style.display = 'none'; }

  renderVariantPicker(p);
  updateModalPriceUI(p);

  document.getElementById('reviewsList').innerHTML = `<div class="loading-msg">Loading reviews…</div>`;
  document.getElementById('starsInput').querySelectorAll('span').forEach(s => s.classList.remove('active'));
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewName').value = GUEST ? GUEST.name : '';
  document.getElementById('reviewEmail').value = GUEST ? GUEST.email : '';
  showModal('productModal');

  try {
    const revs = await API.get(`/api/products/${id}/reviews`);
    renderReviews(revs);
  } catch (e) {
    document.getElementById('reviewsList').innerHTML = `<div class="empty-msg">Couldn't load reviews right now.</div>`;
  }
}
function renderVariantPicker(p) {
  document.getElementById('pmVariants').innerHTML = p.variants.map(v => `
    <button type="button" class="variant-pill ${v.id === MODAL_VARIANT_ID ? 'active' : ''}" ${v.stock === 0 ? 'disabled' : ''}
      onclick="selectVariant('${p.id}','${v.id}')">${v.label}${v.stock === 0 ? ' (out of stock)' : ''}</button>
  `).join('');
}
function selectVariant(productId, variantId) {
  MODAL_VARIANT_ID = variantId;
  MODAL_QTY = 1;
  const p = PRODUCTS.find(x => x.id === productId);
  renderVariantPicker(p);
  updateModalPriceUI(p);
}
function updateModalPriceUI(p) {
  const v = p.variants.find(x => x.id === MODAL_VARIANT_ID);
  document.getElementById('pmPrice').textContent = `₹${v.price}` + (v.mrp > v.price ? `  ` : '');
  document.getElementById('pmStock').textContent = v.stock === 0 ? 'Currently unavailable in this size' : (v.stock < 10 ? `Only ${v.stock} left in stock` : 'In stock, ready to ship');
  document.getElementById('pmQty').textContent = MODAL_QTY;
}
function pmQty(delta) {
  const p = PRODUCTS.find(x => x.id === MODAL_PRODUCT_ID);
  const v = p.variants.find(x => x.id === MODAL_VARIANT_ID);
  MODAL_QTY = Math.max(1, Math.min(v.stock, MODAL_QTY + delta));
  document.getElementById('pmQty').textContent = MODAL_QTY;
}
function renderReviews(revs) {
  const wrap = document.getElementById('reviewsList');
  if (!revs || revs.length === 0) { wrap.innerHTML = `<div class="empty-msg">No reviews yet — be the first to share your experience.</div>`; return; }
  wrap.innerHTML = revs.map(r => `
    <div class="review">
      <div class="who">${escapeHtml(r.userName)}</div>
      <div class="rstars">${starString(r.rating)}</div>
      <div class="comment">${escapeHtml(r.comment)}</div>
      <div class="date">${new Date(r.createdAt).toLocaleDateString()}</div>
      ${r.ownerReply ? `<div class="owner-reply"><b>Sunvora Foods:</b> ${escapeHtml(r.ownerReply)}</div>` : ''}
    </div>`).join('');
}
async function submitReview() {
  const name = document.getElementById('reviewName').value.trim();
  const email = document.getElementById('reviewEmail').value.trim();
  const comment = document.getElementById('reviewComment').value.trim();
  if (!name) { showToast('Please enter your name.'); return; }
  if (SELECTED_STARS === 0 || !comment) { showToast('Add a star rating and a short comment.'); return; }
  try {
    await API.post(`/api/products/${MODAL_PRODUCT_ID}/reviews`, { name, email, rating: SELECTED_STARS, comment });
    GUEST = { name, email }; localStorage.setItem('sunvora_guest', JSON.stringify(GUEST));
    const revs = await API.get(`/api/products/${MODAL_PRODUCT_ID}/reviews`);
    renderReviews(revs);
    await loadProducts();
    document.getElementById('reviewComment').value = '';
    SELECTED_STARS = 0;
    document.getElementById('starsInput').querySelectorAll('span').forEach(s => s.classList.remove('active'));
    showToast('Thanks! Your review has been posted.');
  } catch (e) {
    showToast(e.message);
  }
}

/* ================= CART ================= */
function saveCart() { localStorage.setItem('sunvora_cart', JSON.stringify(CART)); updateCartUI(); }
function quickAdd(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p || totalStock(p) === 0) return;
  const v = cheapestVariant(p);
  const key = cartKey(id, v.id);
  CART[key] = (CART[key] || 0) + 1;
  saveCart();
  showToast(`${p.name} (${v.label}) added to cart`);
}
function addToCartFromModal() {
  const p = PRODUCTS.find(x => x.id === MODAL_PRODUCT_ID);
  const v = p.variants.find(x => x.id === MODAL_VARIANT_ID);
  if (!v || v.stock === 0) return;
  const key = cartKey(p.id, v.id);
  CART[key] = (CART[key] || 0) + MODAL_QTY;
  saveCart();
  showToast(`${p.name} (${v.label}) added to cart`);
  closeModal('productModal');
}
function updateCartUI() {
  const keys = Object.keys(CART).filter(k => CART[k] > 0);
  const count = keys.reduce((a, k) => a + CART[k], 0);
  document.getElementById('cartCount').textContent = count;
  const wrap = document.getElementById('cartItemsWrap');
  if (keys.length === 0) { 
    wrap.innerHTML = `<div class="empty-msg">Your cart is empty.<br>Explore our range and add something you love.</div>`; 
    document.getElementById('cartTotal').textContent = '₹0'; 
    return; 
  }
  let total = 0;
  wrap.innerHTML = keys.map(key => {
    const [productId, variantId] = key.split('__');
    const p = PRODUCTS.find(x => x.id === productId);
    if (!p) return '';
    const v = p.variants.find(x => x.id === variantId);
    if (!v) return '';
    const qty = CART[key];
    total += v.price * qty;
    return `<div class="cart-item">
      <div class="jarwrap">${jarSVG(p.color, p.name, p.imageUrl)}</div>
      <div class="info">
        <div class="name">${p.name} <span style="color:var(--muted);font-weight:500;">(${v.label})</span></div>
        <div class="price">₹${v.price}</div>
        <div class="qty-ctrl">
          <button onclick="changeQty('${key}',-1)">−</button>
          <span>${qty}</span>
          <button onclick="changeQty('${key}',1)">+</button>
          <button class="bin-btn" onclick="removeFromCart('${key}')" title="Remove item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = `₹${total}`;
}
function changeQty(key, delta) {
  const [productId, variantId] = key.split('__');
  const p = PRODUCTS.find(x => x.id === productId);
  const v = p ? p.variants.find(x => x.id === variantId) : null;
  CART[key] = Math.max(0, Math.min((CART[key] || 0) + delta, (v && v.stock) || 99));
  if (CART[key] === 0) delete CART[key];
  saveCart();
}
function removeFromCart(key) { delete CART[key]; saveCart(); }

function openCart() {
  document.getElementById('cartDrawer').classList.add('show');
  document.getElementById('cartOverlay').classList.add('show');
}
function backToCartFromCheckout() {
  closeModal('checkoutModal');
  openCart();
}

function goToPaymentStep() {
  const name = document.getElementById('checkoutName').value.trim();
  const email = document.getElementById('checkoutEmail').value.trim();

  if (!name) {
    showToast('Please enter your full name');
    return;
  }
  if (!email) {
    showToast('Please enter your email');
    return;
  }

  const address = document.getElementById('checkoutAddress').value.trim();
if (!address) {
  showToast('Please enter your delivery address');
  return;
}

  // Copy total to step 2
  document.getElementById('checkoutTotalAmount2').textContent =
    document.getElementById('checkoutTotalAmount').textContent;

  // Switch to payment step
  document.getElementById('checkoutStep1').style.display = 'none';
  document.getElementById('checkoutStep2').style.display = 'block';
  document.getElementById('checkoutTitle').textContent = 'Payment Method';
  document.getElementById('checkoutSubtitle').textContent = 'Choose how you want to pay';

  // Show/hide UPI details when radio changes
  document.querySelectorAll('input[name="paymentMethod"]').forEach(function(radio) {
    radio.onchange = function() {
      document.getElementById('upiDetails').style.display =
        this.value === 'upi' ? 'block' : 'none';
    };
  });
}

function backToDetailsStep() {
  document.getElementById('checkoutStep2').style.display = 'none';
  document.getElementById('checkoutStep1').style.display = 'block';
  document.getElementById('checkoutTitle').textContent = 'Complete Your Order';
  document.getElementById('checkoutSubtitle').textContent = 'Enter your details to place the order';
}

function checkout() {
  const keys = Object.keys(CART).filter(k => CART[k] > 0);
  if (keys.length === 0) {
    showToast('Your cart is empty.');
    return;
  }

  // Calculate total + build order summary
  let total = 0;
  let summaryHTML = '<div class="summary-title">Your Order</div>';

  keys.forEach(key => {
    const [productId, variantId] = key.split('__');
    const p = PRODUCTS.find(x => x.id === productId);
    const v = p?.variants.find(x => x.id === variantId);
    if (!p || !v) return;

    const qty = CART[key];
    const lineTotal = v.price * qty;
    total += lineTotal;

    summaryHTML += `
      <div class="summary-item">
        <div class="summary-info">
          <div class="summary-name">${p.name} <span>(${v.label})</span></div>
          <div class="summary-qty">Qty: ${qty}</div>
        </div>
        <div class="summary-price">₹${lineTotal}</div>
      </div>`;
  });

  document.getElementById('checkoutSummary').innerHTML = summaryHTML;
  document.getElementById('checkoutTotalAmount').textContent = `₹${total}`;
  
  // Prefill if guest info exists
  document.getElementById('checkoutName').value = GUEST ? GUEST.name : '';
  document.getElementById('checkoutEmail').value = GUEST ? GUEST.email : '';
  document.getElementById('checkoutPhone').value = '';

  closeCart();
  showModal('checkoutModal');
}


async function placeOrder() {
  const name = document.getElementById('checkoutName').value.trim();
  const email = document.getElementById('checkoutEmail').value.trim();
  const countryCode = document.getElementById('checkoutCountryCode').value;
  const phoneRaw = document.getElementById('checkoutPhone').value.trim().replace(/\s+/g, '');
  const address = document.getElementById('checkoutAddress').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod';

  // Validation
  if (!name || !email) {
    showToast('Please fill your name and email');
    backToDetailsStep();
    return;
  }

  if (!address) {
    showToast('Delivery address is compulsory');
    backToDetailsStep();
    return;
  }

  if (!phoneRaw) {
    showToast('Mobile number is compulsory');
    backToDetailsStep();
    return;
  }

  // Country-wise mobile length validation
  const lengthRules = {
    '+91': 10,   // India
    '+1': 10,    // USA / Canada
    '+44': 10,   // UK
    '+971': 9,   // UAE
    '+61': 9,    // Australia
    '+65': 8,    // Singapore
    '+977': 10,  // Nepal
    '+94': 9,    // Sri Lanka
    '+880': 10   // Bangladesh
  };

  const expectedLength = lengthRules[countryCode] || 10;

  if (phoneRaw.length !== expectedLength) {
    showToast(`Mobile number for ${countryCode} must be exactly ${expectedLength} digits`);
    backToDetailsStep();
    return;
  }

  if (!/^\d+$/.test(phoneRaw)) {
    showToast('Mobile number should contain only digits');
    backToDetailsStep();
    return;
  }

  const phone = countryCode + ' ' + phoneRaw;

  const keys = Object.keys(CART).filter(k => CART[k] > 0);
  const items = keys.map(key => {
    const [productId, variantId] = key.split('__');
    return { productId, variantId, qty: CART[key] };
  });

  try {
    const order = await API.post('/api/orders', {
      items,
      name,
      email,
      phone,
      address,          // ← this is important
      paymentMethod
    });

    GUEST = { name, email };
    localStorage.setItem('sunvora_guest', JSON.stringify(GUEST));

    CART = {};
    saveCart();
    await loadProducts();
    closeModal('checkoutModal');
    backToDetailsStep();

    // Success modal
    document.getElementById('successOrderId').textContent = order.id;
    document.getElementById('successEmail').textContent = email;

    let summaryHTML = '';
    order.items.forEach(i => {
      summaryHTML += `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13.5px;border-bottom:1px solid #ebe6d8;">
          <div>
            <div style="font-weight:600;">${i.name} <span style="color:#6b7568;font-weight:500;">(${i.variantLabel})</span></div>
            <div style="font-size:12px;color:#6b7568;">Qty: ${i.qty}</div>
          </div>
          <div style="font-weight:700;">₹${i.price * i.qty}</div>
        </div>`;
    });
    summaryHTML += `
      <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:800;font-size:15px;">
        <span>Total</span>
        <span>₹${order.total}</span>
      </div>
      <div style="margin-top:8px;font-size:13px;color:#555;">
        Payment: <b>${paymentMethod === 'upi' ? 'UPI' : 'Cash on Delivery'}</b>
      </div>`;

    document.getElementById('successOrderSummary').innerHTML = summaryHTML;
    showModal('orderSuccessModal');

  } catch (e) {
    showToast(e.message || 'Failed to place order');
  }
}

/* ================= TRACK ORDER ================= */
function openAuth() {
  document.getElementById('trackEmail').value = GUEST ? GUEST.email : '';
  document.getElementById('trackResults').innerHTML = '';
  showModal('trackModal');
}
async function lookupOrders() {
  const email = document.getElementById('trackEmail').value.trim();
  const wrap = document.getElementById('trackResults');
  if (!email) { wrap.innerHTML = `<div class="auth-note">Enter the email you used at checkout.</div>`; return; }
  wrap.innerHTML = `<div class="loading-msg">Looking up your orders…</div>`;
  try {
    const orders = await API.get('/api/orders/lookup?email=' + encodeURIComponent(email));
    if (orders.length === 0) { wrap.innerHTML = `<div class="empty-msg">No orders found for that email.</div>`; return; }
    wrap.innerHTML = orders.map(o => `
      <div class="review">
        <div class="who">${o.id} — ₹${o.total}</div>
        <div class="comment">${o.items.map(i => `${i.name} (${i.variantLabel}) ×${i.qty}`).join(', ')}</div>
        <div class="date">${new Date(o.createdAt).toLocaleString()} · ${o.status}</div>
      </div>`).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="empty-msg">${e.message}</div>`;
  }
}
function openMyOrders() { openAuth(); }
function updateAccountUI() {
  const drawerAuthBtn = document.getElementById('drawerAuthBtn');
  if (drawerAuthBtn) { drawerAuthBtn.textContent = 'Track My Order'; drawerAuthBtn.onclick = openAuth; }
  const drawerWho = document.getElementById('drawerWho');
  if (drawerWho) drawerWho.textContent = 'Welcome';
}

/* ================= NEWSLETTER ================= */
async function subscribe() {
  const email = document.getElementById('subEmail').value.trim();
  try {
    await API.post('/api/subscribe', { email });
    document.getElementById('subEmail').value = '';
    showToast('Subscribed! Welcome to the Sunvora family.');
  } catch (e) { showToast(e.message); }
}

/* ================= UI HELPERS ================= */
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openDrawer() { document.getElementById('sideDrawer').classList.add('show'); document.getElementById('drawerOverlay').classList.add('show'); }
function closeDrawer() { document.getElementById('sideDrawer').classList.remove('show'); document.getElementById('drawerOverlay').classList.remove('show'); }
function closeCart() { document.getElementById('cartDrawer').classList.remove('show'); document.getElementById('cartOverlay').classList.remove('show'); }
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function addNewVariantRow() {
  const list = document.getElementById('np-variants-list');
  const row = document.createElement('div');
  row.className = 'np-variant-row';
  row.style.cssText = 'display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr auto; gap:10px; margin-bottom:8px; align-items:center;';
  row.innerHTML = `
    <input class="np-weight" placeholder="e.g. 250g">
    <input class="np-price" type="number" placeholder="Price">
    <input class="np-mrp" type="number" placeholder="MRP">
    <input class="np-stock" type="number" placeholder="Stock">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

async function addProduct() {
  const name = document.getElementById('np-name').value.trim();
  const color = document.getElementById('np-color').value.trim() || '#4C7A3D';
  const desc = document.getElementById('np-desc').value.trim() || 'A pure Sunvora product.';
  const fileInput = document.getElementById('np-image');

  if (!name) {
    showToast('Please enter product name');
    return;
  }

  // Collect all weight rows
  const rows = document.querySelectorAll('#np-variants-list .np-variant-row');
  const variants = [];

  rows.forEach((row, i) => {
    const label = row.querySelector('.np-weight').value.trim() || '100g';
    const price = Number(row.querySelector('.np-price').value) || 0;
    const mrp = Number(row.querySelector('.np-mrp').value) || price;
    const stock = Number(row.querySelector('.np-stock').value) || 0;

    if (price > 0) {
      variants.push({
        id: 'v' + (i + 1),
        label,
        price,
        mrp,
        stock
      });
    }
  });

  if (variants.length === 0) {
    showToast('Please add at least one weight with price');
    return;
  }

  const tags = [];
  if (document.getElementById('np-bestseller').checked) tags.push('bestseller');
  if (document.getElementById('np-deal').checked) tags.push('deal');
  if (document.getElementById('np-new').checked) tags.push('new');
  if (document.getElementById('np-sale').checked) tags.push('sale');

  let imageUrl = '';

  // Upload image if selected
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
    document.getElementById('np-color').value = '#4C7A3D';
    document.getElementById('np-desc').value = '';
    if (fileInput) fileInput.value = '';
    document.getElementById('np-image-name').textContent = 'No file chosen';
    document.getElementById('np-image-preview').style.display = 'none';

    ['np-bestseller', 'np-deal', 'np-new', 'np-sale'].forEach(id => {
      document.getElementById(id).checked = false;
    });

    // Reset variants to one row
    document.getElementById('np-variants-list').innerHTML = `
      <div class="np-variant-row" style="display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr auto; gap:10px; margin-bottom:8px; align-items:center;">
        <input class="np-weight" value="100g" placeholder="100g">
        <input class="np-price" type="number" value="199" placeholder="Price">
        <input class="np-mrp" type="number" value="249" placeholder="MRP">
        <input class="np-stock" type="number" value="50" placeholder="Stock">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
      </div>
    `;

    await renderAdmin();
    showToast('Product added successfully!');
  } catch (e) {
    showToast(e.message);
  }
}

init();