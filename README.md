# mockpay

Local mock Paystack and Flutterwave servers for offline testing. Provides a CLI and two Express servers that mimic key endpoints.

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
- `POST /transaction/verify/:reference`
- `POST /transfer`
- `GET /banks`

### Flutterwave
- `POST /payments`
- `POST /transfers`

## Example Requests

Paystack initialize:

```bash
curl -X POST http://localhost:4010/transaction/initialize \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "email": "test@example.com", "callback_url": "http://localhost:3000/webhook"}'
```

Flutterwave payments:

```bash
curl -X POST http://localhost:4020/payments \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "currency": "NGN", "customer": {"email": "test@example.com"}, "redirect_url": "http://localhost:3000/webhook"}'
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
