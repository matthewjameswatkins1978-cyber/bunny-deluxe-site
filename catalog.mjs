export const CURRENCY = 'gbp';
// £28 delivered: customer-facing UK tracked delivery is included in the shirt price.
export const UNIT_PRICE_PENCE = 2800;

const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function skuMap(colourCode) {
  return Object.fromEntries([
    ['S', `STTU169-${colourCode}-S`],
    ['M', `STTU169-${colourCode}-M`],
    ['L', `STTU169-${colourCode}-L`],
    ['XL', `STTU169-${colourCode}-XL`],
    ['XXL', `STTU169-${colourCode}-2XL`],
    ['XXXL', `STTU169-${colourCode}-3XL`],
  ]);
}

export const products = [
  {
    id: 'triangle', name: 'Triangle Bunny', code: 'BD-TRI-001', colour: 'Bright Blue',
    note: 'A small triangle. A large bunny. No further questions.', paper: '#f6eee0', acid: '#e9ff52', flash: '#ff4e88', stamp: 'VEY<br>NEIS',
    printFile: 'BD_TRIANGLE_INKTHREADABLE_UPLOAD.png', sizes, skuBySize: skuMap('BBL'),
  },
  {
    id: 'singer', name: 'Singer Bunny', code: 'BD-SNG-002', colour: 'Burgundy',
    note: 'A ballad for people who ruin the party beautifully.', paper: '#b7e9fb', acid: '#ff674a', flash: '#7133c7', stamp: 'LIVE<br>LOUD',
    printFile: 'Bunny Deluxe - Singer Bunny - Front DTG.png', sizes, skuBySize: skuMap('BUR'),
  },
  {
    id: 'bass', name: 'Bass Bunny', code: 'BD-BAS-003', colour: 'Glazed Green',
    note: 'Low frequencies from a very small shed.', paper: '#d4f071', acid: '#ff744e', flash: '#202242', stamp: 'TOO<br>LOW',
    printFile: 'Bunny Deluxe - Bass Bunny - Front DTG.png', sizes, skuBySize: skuMap('GLG'),
  },
  {
    id: 'guitar', name: 'Guitar Bunny', code: 'BD-GTR-004', colour: 'Black',
    note: 'A proper guitar situation. Probably insured.', paper: '#f4d586', acid: '#f64e43', flash: '#3667f5', stamp: 'TUNE<br>UP',
    printFile: 'Bunny Deluxe - Guitar Bunny - Front DTG.png', sizes, skuBySize: skuMap('BLK'),
  },
  {
    id: 'synth', name: 'Synth Bunny', code: 'BD-SYN-005', colour: 'India Ink Grey',
    note: 'Tiny knobs. Huge emotional weather system.', paper: '#c8b5fc', acid: '#00f6bd', flash: '#ff4bb1', stamp: 'BEEP<br>BEEP',
    printFile: 'Bunny Deluxe - Synth Bunny - Front DTG.png', sizes, skuBySize: skuMap('IIG'),
  },
  {
    id: 'drummer', name: 'Drummer Bunny', code: 'BD-DRM-006', colour: 'Ochre',
    note: 'Keeps perfect time. Fires lasers. Normal stuff.', paper: '#ffe5bc', acid: '#ff453c', flash: '#4d6cff', stamp: 'HIT<br>IT',
    printFile: 'Bunny Deluxe - Drummer Bunny - Front DTG.png', sizes, skuBySize: skuMap('OCH'),
  },
];

export function productById(id) {
  return products.find(product => product.id === id);
}
