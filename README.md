# mockpay

Local mock Paystack and Flutterwave servers for offline/local testing.
Use these as base URLs in development:
- Paystack-like: `http://localhost:4010`
- Flutterwave-like: `http://localhost:4020`

## Install

```bash
npm i -g mockpay
```

## Start

```bash
mockpay start
```

Servers:
- Paystack: http://localhost:4010
- Flutterwave: http://localhost:4020

Hosted checkout (served by mockpay):
- http://localhost:4010/checkout
- http://localhost:4020/checkout

## Integration Goal

Replace live gateway URLs in development:
- Instead of `https://api.paystack.co`, use `http://localhost:4010`
- Instead of `https://api.flutterwave.com/v3`, use `http://localhost:4020`

Initialize payment from your backend, open the returned hosted checkout link, complete payment in the mock checkout UI, then verify from your backend.

## CLI Commands

```bash
mockpay start
mockpay stop
mockpay status
mockpay pay success|fail|cancel
mockpay error 500|timeout|network
mockpay webhook resend
mockpay webhook config --delay 1000 --retry 2 --retry-delay 2000 --duplicate --drop
mockpay reset
mockpay logs
```

## Environment

Copy `.env.example` to `.env` and adjust if needed.

Key settings:
- `MOCKPAY_PAYSTACK_PORT`
- `MOCKPAY_FLUTTERWAVE_PORT`
- `MOCKPAY_FRONTEND_URL`
- `MOCKPAY_DATA_DIR`
- `MOCKPAY_DEFAULT_WEBHOOK_URL`

Webhook controls:
- `MOCKPAY_WEBHOOK_DELAY_MS`
- `MOCKPAY_WEBHOOK_RETRY_COUNT`
- `MOCKPAY_WEBHOOK_RETRY_DELAY_MS`
- `MOCKPAY_WEBHOOK_DUPLICATE`
- `MOCKPAY_WEBHOOK_DROP`

## API Coverage

### Paystack
- `POST /transaction/initialize`
- `GET /transaction/verify/:reference`
- `POST /transaction/verify/:reference`
- `POST /transfer`
- `GET /banks`

### Flutterwave
- `POST /payments`
- `GET /transactions/verify_by_reference?tx_ref=...`
- `GET /transactions/:id/verify`
- `POST /transfers`

## Payment Flow

### Paystack-style flow
1. `POST /transaction/initialize`
2. Open `data.authorization_url`
3. Complete payment on checkout (`success` / `failed` / `cancelled`)
4. Verify on your backend with `/transaction/verify/:reference`

### Flutterwave-style flow
1. `POST /payments`
2. Open `data.link`
3. Complete payment on checkout (`success` / `failed` / `cancelled`)
4. Verify on your backend using:
   - `/transactions/verify_by_reference?tx_ref=...` or
   - `/transactions/:id/verify`

## Example Requests

Paystack initialize:

```bash
curl -X POST http://localhost:4010/transaction/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "email": "test@example.com",
    "name": "Ada Lovelace",
    "callback_url": "http://localhost:3000/paystack/callback"
  }'
```

Paystack verify:

```bash
curl http://localhost:4010/transaction/verify/PSK_1234567890_abcdef
```

Flutterwave payments:

```bash
curl -X POST http://localhost:4020/payments \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "customer": {
      "email": "test@example.com",
      "name": "Ada Lovelace"
    },
    "redirect_url": "http://localhost:3000/flutterwave/callback"
  }'
```

Flutterwave verify by reference:

```bash
curl "http://localhost:4020/transactions/verify_by_reference?tx_ref=FLW_1234567890_abcdef"
```

Flutterwave verify by id:

```bash
curl "http://localhost:4020/transactions/<transaction_id>/verify"
```

## Development

```bash
npm install
npm run dev
```

## Building the hosted checkout

The checkout UI is in `template/` and should be built before publishing:

```bash
npm --prefix template install
npm --prefix template run build
```

## Notes

- ChronoDB is used for file-based persistence. Data is stored under `MOCKPAY_DATA_DIR` (default `.mockpay/data`).
- `mockpay pay success|fail|cancel` controls the next payment outcome.
- `mockpay error 500|timeout|network` simulates a one-time failure.
- `mockpay logs` streams live logs over SSE.
- Hosted checkout URLs include transaction details (`ref`, `amount`, `currency`, `email`, `name`, provider).