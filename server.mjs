import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Stripe from 'stripe';
import { CURRENCY, productById, products, UNIT_PRICE_PENCE } from './catalog.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set(products.map(product => product.printFile));

function environment(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function checkoutConfig() {
  // Railway deploys the supplier upload copies with this service. Local
  // production workspaces can still override the directory explicitly.
  const printDirectory = path.resolve(here, environment('PRINT_FILE_DIRECTORY', './print-files'));
  const required = [
    ['STRIPE_SECRET_KEY', environment('STRIPE_SECRET_KEY')],
    ['STRIPE_WEBHOOK_SECRET', environment('STRIPE_WEBHOOK_SECRET')],
    ['SITE_URL', environment('SITE_URL')],
    ['INKTHREADABLE_APP_ID', environment('INKTHREADABLE_APP_ID')],
    ['INKTHREADABLE_SECRET_KEY', environment('INKTHREADABLE_SECRET_KEY')],
    ['INKTHREADABLE_LABEL_NAME', environment('INKTHREADABLE_LABEL_NAME')],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (!products.every(product => existsSync(path.join(printDirectory, product.printFile)))) missing.push('six print files');

  return {
    ready: missing.length === 0,
    missing,
    printDirectory,
    siteUrl: environment('SITE_URL').replace(/\/$/, ''),
    stripeKey: environment('STRIPE_SECRET_KEY'),
    webhookSecret: environment('STRIPE_WEBHOOK_SECRET'),
    inkthreadableAppId: environment('INKTHREADABLE_APP_ID'),
    inkthreadableSecret: environment('INKTHREADABLE_SECRET_KEY'),
    inkthreadableBrand: environment('INKTHREADABLE_BRAND_NAME', 'Bunny Deluxe'),
    inkthreadableLabelName: environment('INKTHREADABLE_LABEL_NAME'),
    inkthreadableShippingMethod: environment('INKTHREADABLE_SHIPPING_METHOD', 'regular'),
    fulfilmentEnabled: environment('FULFILMENT_ENABLED', 'false').toLowerCase() === 'true',
    journalPath: path.resolve(here, environment('ORDER_JOURNAL_PATH', './data/fulfilment-journal.json')),
  };
}

function stripeClient(config) {
  return new Stripe(config.stripeKey, { apiVersion: '2026-07-29.dahlia' });
}

function randomLetters(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from(randomBytes(length), byte => alphabet[byte % alphabet.length]).join('');
}

export function validateItems(items) {
  if (!Array.isArray(items) || items.length !== 1) throw new Error('Choose one T-shirt and one size.');
  const { productId, size } = items[0] ?? {};
  const product = productById(productId);
  if (!product || !product.sizes.includes(size) || !product.skuBySize[size]) throw new Error('That shirt or size is not available.');
  return [{ product, size }];
}

function checkoutLineItem(product, size) {
  return {
    price_data: {
      currency: CURRENCY,
      unit_amount: UNIT_PRICE_PENCE,
      product_data: {
        name: `Bunny Deluxe — ${product.name}`,
        description: `${product.colour} Stanley/Stella Creator 2.0 · front DTG · size ${size}`,
        metadata: { bunny_deluxe_design: product.code, size },
      },
    },
    quantity: 1,
  };
}

export async function createCheckoutSession(items, config = checkoutConfig()) {
  if (!config.ready) throw new Error('Checkout is not configured yet.');
  const [{ product, size }] = validateItems(items);
  const stripe = stripeClient(config);
  const integrationIdentifier = `bunny_deluxe_checkout_${randomLetters()}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [checkoutLineItem(product, size)],
    shipping_address_collection: { allowed_countries: ['GB'] },
    billing_address_collection: 'auto',
    success_url: `${config.siteUrl}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/?checkout=cancelled`,
    metadata: { product_id: product.id, product_code: product.code, size },
    integration_identifier: integrationIdentifier,
  });
  return session;
}

function publicPrintUrl(config, printFile) {
  return `${config.siteUrl}/print-files/${encodeURIComponent(printFile)}`;
}

export function buildInkthreadableOrder(session, config = checkoutConfig()) {
  const product = productById(session.metadata?.product_id);
  const size = session.metadata?.size;
  const address = session.collected_information?.shipping_details?.address ?? session.shipping_details?.address;
  const recipient = session.collected_information?.shipping_details?.name ?? session.shipping_details?.name ?? session.customer_details?.name;
  if (!product || !size || !product.skuBySize[size] || !address || !recipient) throw new Error('Paid session is missing fulfilment details.');

  const shippingAddress = {
    firstName: recipient.split(/\s+/)[0],
    lastName: recipient.split(/\s+/).slice(1).join(' ') || '-',
    address1: address.line1,
    address2: address.line2 || '',
    town: address.city,
    county: address.state || '',
    postcode: address.postal_code,
    country: 'United Kingdom',
    countryCode: 'GB',
    telephone: session.customer_details?.phone || '',
    email: session.customer_details?.email || '',
  };
  const externalId = BigInt(`0x${createHash('sha256').update(session.id).digest('hex').slice(0, 15)}`).toString();
  return {
    external_id: externalId,
    brand: config.inkthreadableBrand,
    shipping_address: shippingAddress,
    shipping: { shippingMethod: config.inkthreadableShippingMethod },
    items: [{
      pn: product.skuBySize[size],
      qty: 1,
      retailPrice: (UNIT_PRICE_PENCE / 100).toFixed(2),
      label: { type: 'printed', name: config.inkthreadableLabelName },
      designs: { front: publicPrintUrl(config, product.printFile) },
    }],
  };
}

async function readJournal(journalPath) {
  try { return JSON.parse(await fs.readFile(journalPath, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeJournal(journalPath, journal) {
  await fs.mkdir(path.dirname(journalPath), { recursive: true });
  const temporary = `${journalPath}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(journal, null, 2));
  await fs.rename(temporary, journalPath);
}

export async function sendToInkthreadable(order, config = checkoutConfig()) {
  const body = JSON.stringify(order);
  const signature = createHash('sha1').update(body + config.inkthreadableSecret).digest('hex');
  const url = new URL('https://www.inkthreadable.co.uk/api/orders.php');
  url.searchParams.set('AppId', config.inkthreadableAppId);
  url.searchParams.set('Signature', signature);
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok || payload?.error || payload?.errors) throw new Error('Inkthreadable did not accept the fulfilment order.');
  return payload;
}

export async function fulfilPaidSession(session, config = checkoutConfig()) {
  if (!config.ready) throw new Error('Fulfilment is not configured yet.');
  if (session.payment_status !== 'paid') return { skipped: true };
  if (!config.fulfilmentEnabled) return { skipped: true, reason: 'Fulfilment is disabled.' };
  const journal = await readJournal(config.journalPath);
  if (journal[session.id]?.status === 'submitted') return { duplicate: true };
  if (journal[session.id]?.status === 'pending') throw new Error('This fulfilment attempt is already pending. Manual review is required.');

  journal[session.id] = { status: 'pending', startedAt: new Date().toISOString() };
  await writeJournal(config.journalPath, journal);
  const order = buildInkthreadableOrder(session, config);
  const result = await sendToInkthreadable(order, config);
  journal[session.id] = { status: 'submitted', submittedAt: new Date().toISOString(), externalId: order.external_id, inkthreadable: result };
  await writeJournal(config.journalPath, journal);
  return { submitted: true, externalId: order.external_id };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const mimeByExtension = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function streamFile(response, filePath, method = 'GET') {
  if (!existsSync(filePath)) return false;
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'content-type': mimeByExtension[extension] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'",
  });
  if (method === 'HEAD') { response.end(); return true; }
  createReadStream(filePath).pipe(response);
  return true;
}

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const config = checkoutConfig();
  if (request.method === 'GET' && url.pathname === '/api/checkout-config') return sendJson(response, 200, { available: config.ready });
  if (request.method === 'POST' && url.pathname === '/api/checkout-sessions') {
    try {
      const { items } = JSON.parse((await requestBody(request)).toString('utf8'));
      const session = await createCheckoutSession(items, config);
      return sendJson(response, 200, { url: session.url });
    } catch (error) {
      return sendJson(response, config.ready ? 400 : 503, { error: error.message === 'Checkout is not configured yet.' ? error.message : 'Unable to start checkout.' });
    }
  }
  if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
    const rawBody = await requestBody(request);
    const signature = request.headers['stripe-signature'];
    if (!config.webhookSecret || !signature) return sendJson(response, 400, { error: 'Invalid webhook signature.' });
    try {
      const event = stripeClient(config).webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await fulfilPaidSession(event.data.object, config);
      return sendJson(response, 200, { received: true });
    } catch (error) {
      return sendJson(response, 500, { error: 'Webhook could not be processed; Stripe will retry.' });
    }
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/print-files/')) {
    const filename = decodeURIComponent(url.pathname.slice('/print-files/'.length));
    if (!publicFiles.has(filename)) return sendJson(response, 404, { error: 'Not found.' });
    const served = await streamFile(response, path.join(config.printDirectory, filename), request.method);
    if (!served) return sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const filePath = path.resolve(here, relativePath);
    if (!filePath.startsWith(`${here}${path.sep}`)) return sendJson(response, 404, { error: 'Not found.' });
    const served = await streamFile(response, filePath, request.method);
    if (served) return;
  }
  return sendJson(response, 404, { error: 'Not found.' });
}

export function createServer() {
  return http.createServer((request, response) => {
    handle(request, response).catch(() => sendJson(response, 500, { error: 'Unexpected server error.' }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(environment('PORT', '4173'));
  createServer().listen(port, () => console.log(`Bunny Deluxe shop running on http://127.0.0.1:${port}`));
}
