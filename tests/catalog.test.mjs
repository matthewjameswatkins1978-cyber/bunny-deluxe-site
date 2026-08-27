import assert from 'node:assert/strict';
import test from 'node:test';
import { products, UNIT_PRICE_PENCE } from '../catalog.mjs';
import { buildInkthreadableOrder, validateItems } from '../server.mjs';

test('the Bunny Deluxe catalogue exposes six £28 delivered Creator 2.0 shirts in S through XXXL', () => {
  assert.equal(products.length, 6);
  assert.equal(UNIT_PRICE_PENCE, 2800);
  const productNumbers = new Set();
  for (const product of products) {
    assert.deepEqual(product.sizes, ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
    for (const size of product.sizes) {
      assert.match(product.skuBySize[size], /^STTU169-[A-Z]{3}-((S|M|L|XL)|2XL|3XL)$/);
      productNumbers.add(product.skuBySize[size]);
    }
  }
  assert.equal(productNumbers.size, 36);
});

test('checkout accepts exactly one valid design and size', () => {
  const [item] = validateItems([{ productId: 'triangle', size: 'XXXL' }]);
  assert.equal(item.product.name, 'Triangle Bunny');
  assert.equal(item.size, 'XXXL');
  assert.throws(() => validateItems([{ productId: 'triangle', size: 'XXXL' }, { productId: 'bass', size: 'M' }]));
  assert.throws(() => validateItems([{ productId: 'unknown', size: 'M' }]));
  assert.throws(() => validateItems([{ productId: 'triangle', size: 'XS' }]));
});

test('paid checkout data becomes the matching Inkthreadable front-DTG line with the Bunny Deluxe neck label', () => {
  const order = buildInkthreadableOrder({
    id: 'cs_test_bunny_deluxe',
    payment_status: 'paid',
    metadata: { product_id: 'drummer', size: 'XL' },
    customer_details: { name: 'Matthew Watkins', email: 'matthew@example.test', phone: '07123456789' },
    collected_information: {
      shipping_details: {
        name: 'Matthew Watkins',
        address: { line1: '1 Bunny Lane', line2: '', city: 'Bangor', state: '', postal_code: 'LL57 1AA' },
      },
    },
  }, {
    siteUrl: 'https://shop.example.test',
    inkthreadableBrand: 'Bunny Deluxe',
    inkthreadableLabelName: 'Bunny Deluxe - Bunny Mark',
    inkthreadableShippingMethod: 'regular',
  });

  assert.equal(order.items[0].pn, 'STTU169-OCH-XL');
  assert.equal(order.items[0].qty, 1);
  assert.equal(order.items[0].retailPrice, '28.00');
  assert.deepEqual(order.items[0].label, { type: 'printed', name: 'Bunny Deluxe - Bunny Mark' });
  assert.equal(order.items[0].designs.front, 'https://shop.example.test/print-files/Bunny%20Deluxe%20-%20Drummer%20Bunny%20-%20Front%20DTG.png');
  assert.equal(order.shipping_address.countryCode, 'GB');
});
