# Bunny Deluxe shop

A one-page Bunny Deluxe shop with a server-owned six-product catalogue and Stripe Checkout. The browser never sets the price, SKU, or fulfilment request.

## What is live in the code

- £28 per shirt, with UK tracked delivery included, six Creator 2.0 designs and S–XXXL variants.
- Stripe Checkout is created server-side using only the selected design and size.
- A verified Stripe webhook submits a paid order to Inkthreadable, using the exact Creator 2.0 product number and the dedicated 300ppi upload file.
- A small local fulfilment journal prevents an event retry from making a duplicate submission.

The site deliberately starts with checkout disabled. Copy `.env.example` to `.env` and set every required value before deploying:

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- public `SITE_URL`
- Inkthreadable `AppId` and API secret
- the exact `INKTHREADABLE_LABEL_NAME` from the Bunny Deluxe Brand Profile

`PRINT_FILE_DIRECTORY` defaults to the existing `../BunnyDeluxe-Print-Production/inkthreadable-upload` files. These are the supplier upload copies, not the protected print masters. On the public host, the six files must be deployed at that path or supplied at the equivalent configured location because Inkthreadable receives public URLs from `/print-files/`. Upload `Bunny Deluxe - Neck Label - Bunny Mark.png` to the Bunny Deluxe Brand Profile, then use its exact label name for `INKTHREADABLE_LABEL_NAME`; Inkthreadable applies that Brand Profile label to the API order.

`ORDER_JOURNAL_PATH` must be on persistent storage in production. It is the deliberately conservative duplicate-submission guard between Stripe retries and Inkthreadable; do not run this fulfilment endpoint on an ephemeral/serverless filesystem unless that journal is moved to durable storage first.

Install and run locally:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Before real sales, configure the Stripe webhook endpoint as `https://your-domain/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then run a Stripe test payment through to the Inkthreadable test/order-review path. Do not enable production keys until that single end-to-end test is verified.

The display images in `assets/` are web mockups only. Print masters remain protected in `../BunnyDeluxe-Print-Production/final-print/`.
