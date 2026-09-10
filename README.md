# USDT/Naira Exchange — PostgreSQL Edition

## Render
The included render.yaml can create/connect a PostgreSQL database.

Web service:
- Build: `npm install`
- Start: `npm start`

Environment variables:
- `DATABASE_URL` — supplied by the Render PostgreSQL database
- `ADMIN_PASSWORD` — set this yourself in Render

Admin:
`/admin.html`

The server automatically creates the `settings` and `orders` tables on first startup.
