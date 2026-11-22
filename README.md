# Home Sweet Home Online API — BY NONGCHE

API server project adapted from the supplied HSH ONLINE server source and rebranded for **Home Sweet Home Online**. Built with Node.js, Express, and MongoDB; deployable to Render.

> **Compatibility notice:** The supplied source was originally structured for Survive OBT2. This package changes the server branding and maintains the existing `/live` game routes (plus the `/hshs` compatibility prefix). It has not been verified against a real Home Sweet Home Online client/protocol. Test with a copy of the game and compare request/response payloads before using it publicly.

## Features currently implemented

- Player authentication endpoint and expiring session tokens stored in MongoDB.
- Player documents stored persistently in the `players` collection.
- SaveData returns a complete client-facing snapshot (progression, inventory, slots, profile, currencies, treasure, mailbox, and purchase history) and accepts writes only for approved progression fields.
- Inventory, character slots, profile, sticker slots, player stats, currencies, and gameplay result updates are persisted through their respective game endpoints.
- Store catalogue and shelf listing from static JSON or MongoDB-seeded collections.
- Store purchases with server-side price lookup, currency validation, quantity limits, atomic currency debit, inventory grants, purchase history, and a transaction record.
- Admin endpoints for grants, bundles, settings, and logs.
- Static game data can be imported into MongoDB using `npm run seed`.

### Important save/security rules

The client cannot directly overwrite currency balances, ban state, roles, purchase history, or server-owned rewards through `/savedata/save`. Those values must be changed by trusted server-side game flows or authenticated admin operations. This prevents a modified client from simply saving itself unlimited currency or paid items.

## Requirements

- Node.js 20 or newer
- MongoDB Atlas or a local MongoDB server
- npm

## Local setup

1. Extract this ZIP.
2. Copy `.env.example` to `.env`.
3. Edit `.env` and set `MONGODB_URI`, `MONGO_DB_NAME`, and a long random `ADMIN_KEY`.
4. Install dependencies and seed the game catalogue:

```bash
npm install
npm run seed
npm start
```

The server listens on `http://localhost:18080` by default. Check:

- `http://localhost:18080/`
- `http://localhost:18080/api/health`

For a temporary local-only test without MongoDB, set `DB_DRIVER=memory` in `.env` and run `npm start`. **Memory mode loses all data when the process stops** and must not be used for a live server.

## Environment variables

| Variable | Example | Description |
|---|---|---|
| `PORT` | `18080` | Port; Render supplies this automatically |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `production` | Runtime environment |
| `DB_DRIVER` | `mongo` | `mongo` for persistent DB; `memory` for local testing only |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string |
| `MONGO_DB_NAME` | `hsho_online` | Database name |
| `ADMIN_KEY` | long random secret | Required to access admin routes |
| `CORS_ORIGIN` | `*` | Allowed browser origin; set your actual client domain where possible |

The included `.env` is configured for **memory-only local testing**. It does not contain MongoDB credentials and is not suitable for production. `.env` is excluded from Git by `.gitignore`. Use `.env.example` as the template for a real MongoDB setup.

## Deploy to Render

1. Push the project to a private GitHub repository.
2. In Render, create a Blueprint using `render.yaml`.
3. Add your real `MONGODB_URI` in the Render environment settings.
4. Set a strong `ADMIN_KEY` (Render can generate one).
5. Deploy and verify `/api/health`.
6. Run the seed command once from Render Shell: `node scripts/seed.js`.

Blueprint settings:
- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`
- Database: `hsho_online`

## API routes

The original game route layout is retained. Game endpoints are mounted at `/live`; the same routes are also available under `/hshs/live` for compatibility.

### Player (`/live/player`)

| Method | Path |
|---|---|
| POST | `/authen` |
| GET/POST | `/inventory/getAll` |
| POST | `/inventory/addItem`, `/inventory/removeItem` |
| GET/POST | `/characterslot/get` |
| POST | `/characterslot/edit` |
| POST | `/profile/edit`, `/sticker/edit` |
| GET/POST | `/playerstat/get` |
| POST | `/savedata/get`, `/savedata/save` |
| GET/POST | `/curserelic/get`, `/getban` |
| GET/POST | `/gameplay/checkversion`, `/gameplay/authenstatus`, `/gameplay/endgamestatus` |
| POST | `/gameplay/callback`, `/gameplay/endgameresult`, `/logout` |

### Store (`/live`)

- `/productlisting/list`
- `/item/listall`
- `/store/list`
- `/store/productlisting/list/tag`
- `/store/purchase`
- `/store/admin/reload` (requires a valid game session)
- `/store/debug/balance` (requires a valid game session)

### Other game systems

- `/live/immortal/*`
- `/live/lootboxgo/api/*`
- `/live/bonus/api/get_bonus_data`
- `/live/mailbox/get`
- `/live/gacha/static/api/banner`
- `/live/treasure/api/progress/get`
- `/logapi/v1/*`

### System and admin (`/api`)

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public |
| GET | `/players` | Admin key |
| POST | `/admin/grant` | Admin key |
| PUT | `/admin/bundles` | Admin key |
| POST | `/admin/bundles/reload` | Admin key |
| PUT | `/admin/settings` | Admin key |
| GET | `/admin/logs` | Admin key |

Send the admin key in the `X-Admin-Key` header.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `players` | Player profile, currencies, inventory, progression, slots, and purchase history |
| `sessions` | Session tokens with TTL expiry index |
| `products` | Product catalogue |
| `items` | Item catalogue |
| `stores` | Store shelves |
| `bundles` | Custom bundles |
| `taglists`, `pots`, `templates` | Game static data |
| `settings` | Server settings |
| `logs` | API/game telemetry |
| `transactions` | Store purchase transaction records |

## Custom store bundles

Edit `data/custom/bundles.json` before seeding, or use the admin endpoint:

```http
PUT /api/admin/bundles
X-Admin-Key: YOUR_ADMIN_KEY
Content-Type: application/json

{
  "bundles": [
    {
      "enabled": true,
      "shortCode": "Bundle_Starter",
      "title": "Starter Bundle",
      "items": [{ "shortCode": "Default_Gacha", "amount": 5 }],
      "currency": "coin",
      "price": 1000,
      "shelf": "recommend_store"
    }
  ]
}
```

Supported in-game currencies: `coin`, `amethyst`, and `amulet`. Real-money payment processing is not implemented.

## Project credit

**BY PHUPHA HEE YAI**
