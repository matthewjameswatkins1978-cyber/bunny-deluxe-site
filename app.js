import { products } from './catalog.mjs';

const refs = {
  root: document.documentElement,
  art: document.querySelector('#hero-art'),
  name: document.querySelector('#product-name'),
  note: document.querySelector('#product-note'),
  code: document.querySelector('#product-code'),
  stamp: document.querySelector('#stamp'),
  transmission: document.querySelector('#transmission'),
  index: document.querySelector('#current-index'),
  thumbs: document.querySelector('#thumbs'),
  sizes: document.querySelector('#sizes'),
  buy: document.querySelector('#get-one'),
  cart: document.querySelector('#cart'),
  cartButton: document.querySelector('#cart-button'),
  cartClose: document.querySelector('#cart-close'),
  cartContent: document.querySelector('#cart-content'),
  cartCount: document.querySelector('#cart-count'),
  checkout: document.querySelector('#checkout'),
  checkoutNote: document.querySelector('#checkout-note'),
};

let selectedProduct = products[0];
let selectedSize = null;
let checkoutAvailable = false;
let checkoutBusy = false;

function setPurchaseState() {
  const ready = Boolean(selectedSize && checkoutAvailable && !checkoutBusy);
  refs.buy.disabled = !selectedSize || checkoutBusy;
  refs.buy.textContent = checkoutBusy ? 'opening secure checkout…' : selectedSize ? 'get one' : 'choose a size';
  refs.checkout.disabled = !ready;
  refs.checkout.textContent = checkoutBusy ? 'opening secure checkout…' : selectedSize ? 'secure checkout' : 'choose a size first';
}

function setProduct(product, index) {
  selectedProduct = product;
  selectedSize = null;
  refs.art.classList.remove('hero-art');
  void refs.art.offsetWidth;
  refs.art.src = `assets/${product.id}-shirt-ai-v3.webp`;
  refs.art.alt = `${product.name} T-shirt mockup`;
  refs.art.classList.add('hero-art');
  refs.name.textContent = product.name;
  refs.note.textContent = product.note;
  refs.code.textContent = product.code;
  refs.stamp.innerHTML = product.stamp;
  refs.transmission.textContent = `NORTH WALES // CHANNEL ${String(index + 1).padStart(2, '0')}`;
  refs.index.textContent = `${String(index + 1).padStart(2, '0')} / 06`;
  refs.root.style.setProperty('--paper', product.paper);
  refs.root.style.setProperty('--acid', product.acid);
  refs.root.style.setProperty('--flash', product.flash);
  refs.sizes.querySelectorAll('button').forEach(button => button.classList.remove('selected'));
  refs.thumbs.querySelectorAll('.thumb').forEach(button => button.classList.toggle('active', button.dataset.id === product.id));
  renderCart();
  setPurchaseState();
}

function renderThumbs() {
  const template = document.querySelector('#thumb-template');
  products.forEach((product, index) => {
    const button = template.content.firstElementChild.cloneNode(true);
    button.dataset.id = product.id;
    button.setAttribute('aria-label', `Choose ${product.name}`);
    button.querySelector('img').src = `assets/${product.id}-shirt-ai-thumb-v3.webp`;
    button.querySelector('img').alt = '';
    button.querySelector('span').textContent = product.name.replace(' Bunny', '');
    button.addEventListener('click', () => setProduct(product, index));
    refs.thumbs.append(button);
  });
}

function openCart(open) {
  refs.cart.classList.toggle('open', open);
  refs.cart.setAttribute('aria-hidden', String(!open));
  refs.cartButton.setAttribute('aria-expanded', String(open));
}

function renderCart() {
  refs.cartCount.textContent = selectedSize ? '1' : '0';
  refs.cartContent.innerHTML = selectedSize
    ? `<div class="cart-item"><p><strong>${selectedProduct.name}</strong></p><p>${selectedProduct.colour} · ${selectedSize} · £28.00 · UK tracked delivery included</p></div>`
    : '<p class="empty-cart">Pick a shirt and size. It will appear here.</p>';
}

async function startCheckout() {
  if (!selectedSize || !checkoutAvailable || checkoutBusy) return;
  checkoutBusy = true;
  setPurchaseState();
  try {
    const response = await fetch('/api/checkout-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: selectedProduct.id, size: selectedSize }] }),
    });
    const result = await response.json();
    if (!response.ok || !result.url) throw new Error(result.error || 'Checkout is not available yet.');
    window.location.assign(result.url);
  } catch (error) {
    checkoutBusy = false;
    refs.checkoutNote.textContent = error.message || 'Checkout is not available yet.';
    setPurchaseState();
  }
}

async function checkCheckoutAvailability() {
  try {
    const response = await fetch('/api/checkout-config');
    const result = await response.json();
    checkoutAvailable = Boolean(result.available);
    refs.checkoutNote.textContent = checkoutAvailable
      ? '£28.00 includes UK tracked delivery. Secure checkout next.'
      : 'Checkout is being prepared. You can still choose your shirt and size.';
  } catch {
    refs.checkoutNote.textContent = 'Checkout is being prepared. You can still choose your shirt and size.';
  }
  setPurchaseState();
}

refs.sizes.addEventListener('click', event => {
  const button = event.target.closest('button[data-size]');
  if (!button) return;
  selectedSize = button.dataset.size;
  refs.sizes.querySelectorAll('button').forEach(item => item.classList.toggle('selected', item === button));
  renderCart();
  setPurchaseState();
});

refs.buy.addEventListener('click', () => {
  if (!selectedSize) return;
  renderCart();
  openCart(true);
});
refs.checkout.addEventListener('click', startCheckout);
refs.cartButton.addEventListener('click', () => openCart(true));
refs.cartClose.addEventListener('click', () => openCart(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') openCart(false); });

renderThumbs();
renderCart();
setProduct(products[0], 0);
checkCheckoutAvailability();
