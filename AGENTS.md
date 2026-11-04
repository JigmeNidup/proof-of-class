# ProofOfClass — agent context

Hybrid classroom DApp: Next.js 16 App Router + custom `server.ts` (Socket.io on
the same HTTP server), Prisma/PostgreSQL, Hardhat/OpenZeppelin contracts,
SIWE via Auth.js v5, wagmi/viem.

Production: `https://class.jigmenidup.site` on Amazon Lightsail. nginx
terminates TLS on 443 and proxies to Node on **port 3050**.

## Do not

- Run or tell the user to run `next dev` / `next start`. Scripts are
  `npm run dev` and `npm start`, both of which execute `server.ts`. Without
  that process, Quick-call is permanently offline.
- Put `next()` in front of `/api/socket.io`. `server.ts` must skip that path
  so Engine.IO owns polling and the websocket upgrade.
- Treat JWT `role` as trainer authority. `requireApprovedTrainer` re-reads
  `User.role` + `User.trainerStatus` from Postgres. Only
  `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS` (SIWE session) can approve.
- Use Hardhat account #0 as `DEPLOYER_PRIVATE_KEY` on Sepolia. The deploy
  script refuses it.
- Rank quick-call answers on `clientClickAt`. Ranking is server
  `process.hrtime.bigint()` latency.
- Unmount `QuickCallPanel` when switching trainer tabs. Final results exist
  only in that component’s state after `endQuickCall` drops the in-memory call.

## Auth and trainers

- Identity is the SIWE session cookie, never a body `address` acting as the
  caller (`lib/guards.ts`).
- Apply → `role=TRAINER`, `trainerStatus=PENDING` (waiting room on `/trainer`).
  Approve on `/admin` → `APPROVED`. JWT trainer fields are refreshed from the
  DB in `auth.ts` `jwt` callback so a stale cookie does not hide the dashboard.
- `AUTH_URL` is the **public** origin (`https://class.jigmenidup.site` on the
  VPS, not `http://localhost:3050`). `PORT` is only the listen port.
- Socket handshake tries `__Secure-` and non-secure Auth.js cookies.

## Chain

- `NEXT_PUBLIC_CHAIN_ID`: `31337` Hardhat, `11155111` Sepolia.
- Classrooms store `chainId`. Do not reuse a local classroom on Sepolia.
- Factory address comes from `npm run contracts:deploy` into
  `NEXT_PUBLIC_FACTORY_ADDRESS`. Rebuild after changing any `NEXT_PUBLIC_*`.
- Indexer: `scripts/indexer.ts`, idempotent on `(txHash, logIndex)`.

## UI / API conventions

- App Router: `params` / `searchParams` are Promises (Next 16).
- Prisma 6 (`prisma-client-js`). Wagmi v3: `useConnection`, `mutate` on
  `useSwitchChain`.
- API routes: wrap with `route()` from `lib/api.ts`; serialize BigInt there.
- Award-from-quick-call: `lib/quick-call-award.ts`, note cap 200 chars.

## Production websocket

nginx `location /` needs `proxy_http_version 1.1`,
`Upgrade $http_upgrade`, `Connection "upgrade"`, `X-Forwarded-Proto $scheme`,
and `proxy_read_timeout 120s`. Firewall: 80/443 only.
