// Thin wrapper around fetch() for talking to our own backend (server.js).
const API = {
  base: '', // same origin — server.js serves both the API and this frontend

  customerToken() { return localStorage.getItem('sunvora_customer_token'); },
  ownerToken() { return localStorage.getItem('sunvora_owner_token'); },

  async request(method, url, body, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth === 'customer' && this.customerToken()) headers['Authorization'] = 'Bearer ' + this.customerToken();
    if (auth === 'owner' && this.ownerToken()) headers['Authorization'] = 'Bearer ' + this.ownerToken();
    const res = await fetch(this.base + url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  },

  get(url, auth) { return this.request('GET', url, undefined, auth); },
  post(url, body, auth) { return this.request('POST', url, body, auth); },
  put(url, body, auth) { return this.request('PUT', url, body, auth); },
  del(url, auth) { return this.request('DELETE', url, undefined, auth); }
};
