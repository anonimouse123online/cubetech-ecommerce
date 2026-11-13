# Cartlane storefront

React, Vite, and Tailwind CSS storefront for the Phase 1 catalog and Phase 2 customer checkout. Product listing, product details, cart quotes, and saved order confirmations use the backend REST API through Vite's `/api` proxy. Cart contents persist in `localStorage`.

## Run locally

1. Run `npm install` in this folder.
2. Start the backend in its own terminal on port 5001.
3. Run `npm run dev` here. Vite uses port 5173 and forwards `/api` requests to `http://localhost:5001`.

Home, Products, Product Details, Cart, Checkout, and Order Confirmation are implemented. Admin login and dashboard remain placeholders for a later phase.

## Checks

- `npm test` checks cart persistence, duplicate merging, quantity limits, and exact PHP centavo totals.
- `npm run lint` checks the frontend source.
- `npm run build` creates the production bundle.
