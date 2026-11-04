# ProofOfClass

A decentralised classroom rewards DApp. Trainers run classrooms backed by their
own ERC-20 points token and ERC-1155 badge collection; trainees join with a
code, earn verifiable points, collect weekly and monthly badges, and compete in
millisecond-accurate live quick-call rounds.

Production host: `https://class.jigmenidup.site` (Amazon Lightsail + nginx TLS).

## Architecture

One Node process serves the UI, the API and the websockets. Two standalone
scripts handle the chain. **Do not run `next dev` / `next start`.** Socket.io
only exists on the custom server in `server.ts`.

```
MetaMask ──SIWE──► server.ts (Next.js + Socket.io) ──Prisma──► PostgreSQL
    │                     │  ▲                              ▲
    │                     │  └──── /api/socket.io ──────────┘
    └──writeContract──► ClassroomToken / ClassBadges
                              │
                              └──► scripts/indexer.ts ──► PostgreSQL
```

**Trust model.** The chain is authoritative for balances and badge ownership.
PostgreSQL stores what the chain cannot express cheaply — profiles, join codes,
membership and trainer approvals, award categories, quick-call timings — plus
an indexed mirror of on-chain events used to render leaderboards. A point award
is written `PENDING` when its transaction is submitted and promoted to
`CONFIRMED` only once the indexer sees the event.

The platform never holds a minting key. `ClassroomFactory` deploys both
contracts with `msg.sender` as owner, so only the trainer's own wallet can mint.

Trainer capability is not self-assigned. `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS`
is the only wallet that can approve a request. Applying sets `role = TRAINER`
and `trainerStatus = PENDING`; classroom writes go through
`requireApprovedTrainer`, which re-reads the database (not the JWT).

## Requirements

- Node.js 20.9+ (developed on 24.x)
- PostgreSQL 14+
- MetaMask in the browser
- For production: nginx with WebSocket upgrade headers (see
  [Deploying on Lightsail](#deploying-on-lightsail))

## Setup

```bash
npm install
cp .env.example .env
```

Edit at least:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `AUTH_SECRET` | Auth.js JWT encryption. Generate with the command below |
| `AUTH_URL` | **Public** origin the browser uses (`http://localhost:3000` locally, `https://class.jigmenidup.site` on the VPS) |
| `PORT` | Internal listen port (`3000` local, `3050` on Lightsail) |
| `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS` | MetaMask address that can open `/admin` and approve trainers |
| `NEXT_PUBLIC_CHAIN_ID` | `31337` Hardhat, `11155111` Sepolia |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Written by `npm run contracts:deploy` |

`AUTH_URL` is the browser URL, not `http://127.0.0.1:$PORT`. SIWE, cookies and
Socket.io all bind to it. A localhost `AUTH_URL` on the live domain will look
like a failed `wss://…/api/socket.io` handshake.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create the schema:

```bash
npx prisma generate
npm run db:migrate
npm run db:seed            # optional; Hardhat demo accounts only
```

## Run order

### Local Hardhat

```bash
npm run chain              # 1. Hardhat node on :8545
npm run contracts:deploy   # 2. factory → writes NEXT_PUBLIC_FACTORY_ADDRESS
npm run dev                # 3. Next.js + Socket.io (PORT from .env)
npm run indexer            # 4. sync on-chain events into Postgres
```

Add the local network to MetaMask (`http://127.0.0.1:8545`, chain id `31337`) —
the **Switch network** button in the header will offer to add it.

Hardhat only pre-funds its own accounts. A personal MetaMask address starts at
zero. Keep that address (classrooms are keyed on it) and top it up:

```bash
npm run fund -- 0xYourAddress        # 1000 ETH by default
npm run fund -- 0xYourAddress 50
```

Seeded accounts (join code `DEMO24`):

| Role | Address | Hardhat account |
| --- | --- | --- |
| Trainer | `0xf39F…2266` | #0 |
| Trainee | `0x7099…79C8` | #1 |
| Trainee | `0x3C44…93BC` | #2 |
| Trainee | `0x90F7…b906` | #3 |
| Trainee (pending) | `0x15d3…6A65` | #4 |

### Sepolia

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
DEPLOYER_PRIVATE_KEY="0x…"          # burner with Sepolia ETH, never Hardhat #0
INDEXER_POLL_INTERVAL_MS=12000
```

Then `npm run contracts:deploy && npm run indexer` — no Hardhat node. Avoid
`rpc.sepolia.org` (HTML block page) and `1rpc.io/sepolia` (`eth_getLogs` capped
at 50 blocks). Classrooms store `chainId`; local ones cannot be used on Sepolia.

## Deploying on Lightsail

The VPS runs nginx on 443 and Node on **3050**. Use production mode:

```bash
npm run build
PORT=3050 AUTH_URL="https://class.jigmenidup.site" npm start
```

(`pm2` or systemd should run `npm start`, never `npm run dev`. Dev mode serves
`/_next/hmr`, which nginx and Socket.io both fight over.)

nginx **must** forward the WebSocket upgrade. Without these headers the browser
reports `wss://class.jigmenidup.site/api/socket.io/?EIO=4&transport=websocket failed`
and Quick-call stays **offline**. Site file
(`/etc/nginx/sites-available/class.jigmenidup.site`):

```nginx
server {
    server_name class.jigmenidup.site;

    location / {
        proxy_pass http://127.0.0.1:3050;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/class.jigmenidup.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/class.jigmenidup.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = class.jigmenidup.site) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name class.jigmenidup.site;
    return 404;
}
```

Lightsail firewall: open 80 and 443 only. Leave 3050 bound to localhost.

On the VPS `.env`:

```bash
PORT=3050
AUTH_URL="https://class.jigmenidup.site"
NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS="0xYourMetaMaskAddress"
```

Rebuild after any `NEXT_PUBLIC_*` change — Next inlines those at build time.
Then `sudo nginx -t && sudo systemctl reload nginx`, restart Node, sign in
again (stale `authjs.session-token` cookies from an old `AUTH_SECRET` also
break the socket handshake).

`next.config.ts` lists `class.jigmenidup.site` in `allowedDevOrigins` only so
`npm run dev` behind that host can use HMR. Production does not need it.

## Walkthrough

1. Open the app, connect MetaMask, sign in. Signing is free.
2. Trainers: `/trainer` → apply. Until the platform owner approves on `/admin`,
   the page is a waiting room — signed in as trainer, cannot create classrooms.
   After approval, create a classroom → open it → **Deploy contracts**.
3. Approve join requests on the **Members** tab.
4. **Points** tab: pick a trainee, an amount and a category. This mints
   on-chain and records the hash; the indexer flips the row to confirmed.
5. **Badges** tab: the winner is prefilled from the matching leaderboard.
6. **Quick-call** tab: fire a question. Trainees on
   `/dashboard/<id>/quick-call` get a buzzer and are ranked by **server**
   arrival time. The pill is `offline` until Socket.io is connected (custom
   server + nginx upgrade + valid session cookie).
7. After the call closes, **Award** on a result row jumps to **Points** with
   the trainee selected and a note like
   `Quick-call "What does CREATE2 predict?" — 1st to answer in 312 ms — correct`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Custom server in watch mode (`server.ts`) |
| `npm run build` / `npm start` | Production build and run via `server.ts` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run db:reset` | Drop everything, re-apply migrations, no demo data |
| `npm run db:reset:demo` | Same, then seed |
| `npm run chain` | Local Hardhat node |
| `npm run fund -- <address> [eth]` | Local gas only; prints faucet links on Sepolia |
| `npm run contracts:compile` | Compile Solidity and regenerate `lib/contracts/abis.ts` |
| `npm run contracts:test` | Hardhat test suite |
| `npm run contracts:deploy` | Deploy `ClassroomFactory` via viem |
| `npm run indexer` | Poll and reconcile chain events |

## Contracts

`contracts/`, Solidity 0.8.24, OpenZeppelin v5, Cancun EVM (`mcopy`).

- **ClassroomToken** — ERC-20 + Ownable. `awardPoints(to, amount, category, note)`
  mints and emits `PointsAwarded`. Also `batchAwardPoints`.
- **ClassBadges** — ERC-1155 + Ownable. `WEEKLY_BADGE = 1` (cyan hexagon),
  `MONTHLY_BADGE = 2` (gold star). Repeat wins increase balance.
  `uri(id)` → `/api/metadata/badges/<id>` plus a generated SVG.
- **ClassroomFactory** — `createClassroom(name, symbol, badgeBaseURI)` deploys
  both with `msg.sender` as owner and emits `ClassroomDeployed`.

## Data model

`prisma/schema.prisma`. Notable decisions:

- `PointLog.amountWei` is `Decimal(78,0)`: an 18-decimal uint256 overflows
  Postgres `bigint`.
- `@@unique([txHash, logIndex])` on `PointLog` and `BadgeAward` makes the
  indexer idempotent.
- `@@unique([classroomId, badgeType, periodKey])` enforces one winner per tier
  per period.
- `User.trainerStatus` is the trainer gate (`NONE | PENDING | APPROVED |
  REJECTED`). `role` may already be `TRAINER` while pending; writes still
  require `APPROVED`. The JWT is re-read from the database on each session
  check so an approval in another tab does not require a fresh sign-in.

## Quick-call timing

Ranking uses `process.hrtime.bigint()` at server arrival, measured from when
the call opened. `clientClickAt` is stored for display only.

Live state is an in-memory map on this process and is flushed to
`QuickCallResponse` when the round closes. Multiple Node instances would need
`@socket.io/redis-adapter` plus a shared store.

`server.ts` must not pass `/api/socket.io` into the Next.js request handler, or
polling returns HTML and the websocket upgrade never completes.

## Security notes

- Route handlers never take a wallet address from the body as the actor. The
  signed Auth.js session is the identity — `lib/guards.ts`.
- SIWE is bound to the origin and the Auth.js CSRF token as nonce.
- Signature recovery is local (`recoverMessageAddress`). No EIP-1271.
- The socket handshake decodes the session cookie and re-checks classroom
  membership before joining a room. Try both `__Secure-` and plain cookie names
  so HTTPS-behind-nginx still authenticates if `AUTH_URL` was wrong at issue.
- Only `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS` can set `trainerStatus` to
  `APPROVED`.

## Resetting the database

```bash
npm run db:reset            # clean slate, no seed
npm run db:reset:demo       # plus Hardhat demo classroom
npm run db:reset -- --force # skip confirmation
```

Use `db:reset` after switching chains. It also clears `IndexerCursor`; rescan
from each classroom's `deployedBlock` is safe because writes are keyed on
`(txHash, logIndex)`.

## Known limitations

- Single-process realtime; no Redis adapter.
- The indexer polls, so confirmation lags by up to `INDEXER_POLL_INTERVAL_MS`.
- `ClassBadges.uri()` is set at deploy from `window.location.origin`. After a
  host change, call `setBaseURI` on the contract.
- Quick-call results live in the trainer panel's React state after close. That
  panel stays mounted (CSS-hidden) across trainer tabs so Award still works.
