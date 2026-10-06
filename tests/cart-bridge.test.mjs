import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const template = readFileSync(new URL('../extensions/pencil-shop/blocks/iframe.liquid', import.meta.url), 'utf8');
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1].replaceAll('{{ block.id }}', 'test');
const design = { type: 'SHOP_PAGE_DATA', modelId: 'snapshot', orderId: 'order', productName: 'Ring', price: 1200, description: 'Ring description' };
const properties = { 'Pencil Design ID': 'snapshot', 'Pencil Order ID': 'order', 'Ring Size': '7', 'Band Width': '2 mm' };
const product = { success: true, variantId: '123', modelId: 'snapshot', orderId: 'order', sku: 'snapshot', cartProperties: properties };

function harness({ response = product, productWait, cartStatuses = [200] } = {}) {
  let listener;
  const requests = [];
  const alerts = [];
  const overlay = { style: {} };
  const iframe = { src: 'https://app.example/builder', contentWindow: {}, addEventListener() {} };
  const window = { location: { href: 'https://shop.example/pages/builder' }, addEventListener: (_type, fn) => { listener = fn; } };
  let cartAttempt = 0;
  runInNewContext(script, {
    window, URL, Shopify: { shop: 'shop.myshopify.com' },
    document: { addEventListener: (_type, fn) => fn(), getElementById: id => id.startsWith('iframe-') ? iframe : overlay },
    alert: value => alerts.push(value), console: { log() {}, warn() {}, error() {} },
    setTimeout: fn => fn(),
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.endsWith('/shopify/products')) {
        if (productWait) await productWait;
        return { ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => response };
      }
      const status = cartStatuses[Math.min(cartAttempt++, cartStatuses.length - 1)];
      return { ok: status === 200, status, text: async () => '{}' };
    },
  });
  return {
    requests, alerts, overlay, window,
    send: (data = design, overrides = {}) => listener({ data, origin: 'https://app.example', source: iframe.contentWindow, ...overrides }),
  };
}

test('passes both IDs to Pencil and the server properties to the Shopify cart', async () => {
  const h = harness();
  await h.send();
  assert.equal(h.requests[0].body.orderId, 'order');
  assert.deepEqual(h.requests[1].body.items[0].properties, { ...properties, Description: 'Ring description' });
  assert.equal(h.window.location.href, '/cart');
});

test('ignores informational events and messages from a different window or origin', async () => {
  const h = harness();
  await h.send({ ...design, type: 'PENCIL_ADD_TO_CART' });
  await h.send(design, { origin: 'https://other.example' });
  await h.send(design, { source: {} });
  assert.equal(h.requests.length, 0);
});

test('does not add an older or mismatched API response to the cart', async () => {
  for (const response of [{ variantId: '123' }, { ...product, orderId: 'wrong' }, { ...product, sku: 'wrong' }]) {
    const h = harness({ response });
    await h.send();
    assert.equal(h.requests.length, 1);
    assert.equal(h.alerts.length, 1);
    assert.equal(h.overlay.style.display, 'none');
  }
});

test('requires the saved order ID before creating a Shopify product', async () => {
  const h = harness();
  await h.send({ ...design, orderId: undefined });
  assert.equal(h.requests.length, 0);
  assert.equal(h.alerts.length, 1);
});

test('guards duplicate in-flight messages and releases the guard after failure for a retry', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness({ productWait: wait, response: {} });
  const first = h.send();
  await h.send();
  assert.equal(h.requests.length, 1);
  release();
  await first;
  await h.send();
  assert.equal(h.requests.length, 2);
});

test('retains properties across storefront propagation retries', async () => {
  const h = harness({ cartStatuses: [422, 200] });
  await h.send();
  assert.equal(h.requests.length, 3);
  assert.deepEqual(h.requests[1].body, h.requests[2].body);
  assert.equal(h.window.location.href, '/cart');
});
