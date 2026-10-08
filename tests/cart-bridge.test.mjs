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
        return { ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => typeof response === 'function' ? response(JSON.parse(options.body)) : response };
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

test('accepts configured properties without public IDs and does not add disabled Description', async () => {
  for (const cartProperties of [{}, { 'Stone Shape': 'Asscher' }, { Description: 'Server description' }]) {
    const h = harness({ response: { ...product, cartPropertiesVersion: 1, cartProperties } });
    await h.send();
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.requests[1].body.items[0].properties, cartProperties);
    assert.equal(h.window.location.href, '/cart');
  }
});

test('rejects invalid configured responses even when public IDs are optional', async () => {
  for (const response of [
    { ...product, cartPropertiesVersion: 1, modelId: 'wrong', cartProperties: {} },
    { ...product, cartPropertiesVersion: 1, orderId: 'wrong', cartProperties: {} },
    { ...product, cartPropertiesVersion: 1, sku: 'wrong', cartProperties: {} },
    { ...product, cartPropertiesVersion: 1, cartProperties: { 'Pencil Design ID': 'wrong' } },
    { ...product, cartPropertiesVersion: 1, cartProperties: { 'Pencil Order ID': 'wrong' } },
    { ...product, cartPropertiesVersion: 1, cartProperties: { 'Ring Size': 7 } },
    { ...product, cartPropertiesVersion: 1, cartProperties: null },
    { ...product, cartPropertiesVersion: 1, cartProperties: [] },
    { ...product, cartPropertiesVersion: 2 },
    { ...product, cartProperties: {} },
  ]) {
    const h = harness({ response });
    await h.send();
    assert.equal(h.requests.length, 1);
    assert.equal(h.alerts.length, 1);
  }
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

test('keeps different saved configurations separate', async () => {
  const h = harness({ response: request => ({
    ...product, modelId: request.modelId, orderId: request.orderId, sku: request.modelId,
    cartProperties: { ...properties, 'Pencil Design ID': request.modelId, 'Pencil Order ID': request.orderId },
  }) });
  await h.send();
  await h.send({ ...design, modelId: 'snapshot-2', orderId: 'order-2' });
  const carts = h.requests.filter(request => request.url.endsWith('/cart/add.js'));
  assert.equal(carts.length, 2);
  assert.equal(carts[0].body.items[0].properties['Pencil Design ID'], 'snapshot');
  assert.equal(carts[1].body.items[0].properties['Pencil Design ID'], 'snapshot-2');
  assert.equal(carts[1].body.items[0].properties['Pencil Order ID'], 'order-2');
});

test('does not add mismatched or non-string cart properties', async () => {
  for (const cartProperties of [{ ...properties, 'Pencil Order ID': 'other' }, { ...properties, 'Ring Size': 7 }]) {
    const h = harness({ response: { ...product, cartProperties } });
    await h.send();
    assert.equal(h.requests.length, 1);
    assert.equal(h.alerts.length, 1);
  }
});

test('stops after exhausted availability retries and allows another attempt', async () => {
  const h = harness({ cartStatuses: [422] });
  await h.send();
  assert.equal(h.requests.length, 6);
  assert.equal(h.alerts.length, 1);
  assert.equal(h.overlay.style.display, 'none');
  await h.send();
  assert.equal(h.requests.length, 12);
});

test('does not automatically retry other cart errors', async () => {
  const h = harness({ cartStatuses: [500] });
  await h.send();
  assert.equal(h.requests.length, 2);
  assert.equal(h.alerts.length, 1);
});
