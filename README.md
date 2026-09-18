# ProofOfClass

A decentralised classroom rewards DApp. Trainers run classrooms backed by their
own ERC-20 points token and ERC-1155 badge collection; trainees join with a
code, earn verifiable points, collect weekly and monthly badges, and compete in
millisecond-accurate live quick-call rounds.

## Architecture

One Next.js process serves the UI, the API and the websockets. Two standalone
scripts handle the chain.

```
MetaMask ──SIWE──► Next.js App Router ──Prisma──► PostgreSQL
    │                     │  ▲                        ▲
    │                     │  └──── Socket.io ─────────┘
    └──writeContract──► ClassroomToken / ClassBadges
                              │
                              └──► scripts/indexer.ts ──► PostgreSQL
```

**Trust model.** The chain is authoritative for balances and badge ownership.
PostgreSQL stores what the chain cannot express cheaply — profiles, join codes,
approvals, award categories, quick-call timings — plus an indexed mirror of
on-chain events used to render leaderboards fast. A point award is written
`PENDING` when its transaction is submitted and promoted to `CONFIRMED` only
once the indexer sees the event.

The platform never holds a minting key. `ClassroomFactory` deploys both
contracts with `msg.sender` as owner, so only the trainer's own wallet can mint.

## Requirements

- Node.js 20.9+ (developed on 24.x)
- PostgreSQL 14+ running locally
- MetaMask in the browser

## Setup

```bash
npm install
cp .env.example .env      # then edit DATABASE_URL, AUTH_SECRET and NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create the schema and demo data:

```bash
npx prisma generate
npm run db:migrate        # applies prisma/migrations
npm run db:seed           # optional demo trainer, trainees and classroom
```

## Run order

Four terminals for the full local stack (for Sepolia, see
[Running on Sepolia](#running-on-sepolia) instead):

```bash
npm run chain              # 1. Hardhat node on :8545
npm run contracts:deploy   # 2. deploy the factory, writes NEXT_PUBLIC_FACTORY_ADDRESS into .env
npm run dev                # 3. Next.js + Socket.io on :3000
npm run indexer            # 4. sync on-chain events into Postgres
```

Add the local network to MetaMask (`http://127.0.0.1:8545`, chain id `31337`) —
the **Switch network** button in the header will offer to add it for you.

Hardhat only pre-funds its own deterministic accounts, so a personal account
shows a zero balance and cannot pay gas. Either import a Hardhat key, or keep
your own address and top it up:

```bash
npm run fund -- 0xYourAddress        # 1000 ETH by default
npm run fund -- 0xYourAddress 50
```

Funding your existing address is usually the better option, since the `User`
row, classroom ownership and contract ownership are all keyed on it.

The seed script uses Hardhat's deterministic accounts:

| Role | Address | Hardhat account |
| --- | --- | --- |
| Trainer | `0xf39F…2266` | #0 |
| Trainee | `0x7099…79C8` | #1 |
| Trainee | `0x3C44…93BC` | #2 |
| Trainee | `0x90F7…b906` | #3 |
| Trainee (pending) | `0x15d3…6A65` | #4 |

Seeded join code: `DEMO24`.

## Resetting the database

Wipes every table, re-applies `prisma/migrations`, and regenerates the client:

```bash
npm run db:reset            # clean slate
npm run db:reset:demo       # clean slate + seeded demo classroom
npm run db:reset -- --force # skip the confirmation prompt
```

`db:reset` deliberately skips the seed: the demo rows use Hardhat's accounts,
which are only useful against the local node. Use `db:reset:demo` when you want
them back.

Reach for this after switching networks — classrooms record the `chainId` they
were created on, so local ones are unusable from Sepolia and vice versa. Note
that a reset also clears `IndexerCursor`, so the indexer rescans each classroom
from its `deployedBlock`; that is safe, since every write is keyed on
`(txHash, logIndex)`.

If your database role lacks permission to drop the schema, use
`npm run db:push -- --force-reset` instead.

## Running on Sepolia

The app reads `NEXT_PUBLIC_CHAIN_ID`, so switching networks is configuration
rather than code. In `.env`:

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
NEXT_PUBLIC_FACTORY_ADDRESS=""            # refilled by contracts:deploy
DEPLOYER_PRIVATE_KEY="0x…"                # a burner key holding Sepolia ETH
INDEXER_POLL_INTERVAL_MS=12000            # ~1 block on Sepolia
```

Two values need care:

- **`DEPLOYER_PRIVATE_KEY`** must be a key you control with Sepolia ETH from a
  [faucet](https://www.alchemy.com/faucets/ethereum-sepolia). The deploy script
  refuses Hardhat's test key on any public chain and aborts on a zero balance
  rather than burning a nonce. Use a burner wallet — this key sits in plaintext.
- **The RPC URL.** Avoid `rpc.sepolia.org` (returns an HTML block page) and
  `1rpc.io/sepolia` (caps `eth_getLogs` at 50 blocks, which starves the
  indexer). The publicnode default works; an Alchemy or Infura key is better if
  you hit rate limits.

Then, with no Hardhat node needed:

```bash
npm run contracts:deploy   # 1. factory -> Sepolia
npm run dev                # 2. restart so Next re-reads .env
npm run indexer            # 3.
```

Notes:

- Classrooms store the `chainId` they were created on. Ones from the local node
  are listed with an "on Hardhat" tag and cannot be used from Sepolia — create a
  fresh classroom after switching, or reset the database.
- Confirmations take ~12s instead of being instant, so points and badges sit in
  `PENDING` visibly longer before the indexer promotes them.
- `npm run fund` is local-only; on a public chain it prints faucet links.
- Transaction and address links in the UI resolve to `sepolia.etherscan.io`.

## Walkthrough

1. Open `http://localhost:3000`, connect MetaMask, and sign in. Signing is free.
2. As a trainer: `/trainer` → create a classroom → open it → **Deploy contracts**.
   One transaction deploys the token and the badge collection to your wallet.
3. Approve join requests on the **Members** tab.
4. **Points** tab: pick a trainee, an amount and a category. This mints on-chain
   and records the hash; the indexer flips the row to confirmed within a poll.
5. **Badges** tab: the winner is prefilled from the matching leaderboard.
6. **Quick-call** tab: fire a question. Every trainee with
   `/dashboard/<id>/quick-call` open gets a buzzer instantly and is ranked by
   server arrival time.
7. Once the call closes, each row in the final ranking gets an **Award** button.
   It jumps to the **Points** tab with the trainee selected and the note filled
   in — for example `Quick-call "What does CREATE2 predict?" — 1st to answer in
   312 ms — correct`. Points, category and note all stay editable, so nothing is
   minted until you submit.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js + Socket.io via `server.ts` |
| `npm run build` / `npm start` | Production build and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run db:reset` | Drop everything, re-apply migrations, no demo data |
| `npm run db:reset:demo` | Same, then run the seed |
| `npm run chain` | Local Hardhat node |
| `npm run fund -- <address> [eth]` | Give a local account gas money |
| `npm run contracts:compile` | Compile Solidity and regenerate `lib/contracts/abis.ts` |
| `npm run contracts:test` | Hardhat test suite (17 tests) |
| `npm run contracts:deploy` | Deploy `ClassroomFactory` via viem |
| `npm run indexer` | Poll and reconcile chain events |

## Contracts

`contracts/`, Solidity 0.8.24, OpenZeppelin v5, Cancun EVM target (OZ 5.6 uses
the `mcopy` opcode).

- **ClassroomToken** — ERC-20 + Ownable. `awardPoints(to, amount, category, note)`
  mints and emits `PointsAwarded` with the category on-chain, so the indexer can
  rebuild history from logs without trusting the client. Plus `batchAwardPoints`.
- **ClassBadges** — ERC-1155 + Ownable. `WEEKLY_BADGE = 1` (cyan hexagon),
  `MONTHLY_BADGE = 2` (gold eight-pointed star). ERC-1155 rather than ERC-721
  because repeat wins should increase a balance, not mint a wall of duplicates.
  `uri(id)` points at `/api/metadata/badges/<id>`, which the app serves along
  with a generated SVG.
- **ClassroomFactory** — `createClassroom(name, symbol, badgeBaseURI)` deploys
  both with `msg.sender` as owner and emits `ClassroomDeployed`.

## Data model

`prisma/schema.prisma`. Notable decisions:

- `PointLog.amountWei` is `Decimal(78,0)`, not `BigInt`: an 18-decimal uint256
  overflows Postgres `bigint`.
- `@@unique([txHash, logIndex])` on `PointLog` and `BadgeAward` makes the
  indexer idempotent — replaying old blocks cannot double-count.
- `@@unique([classroomId, badgeType, periodKey])` on `BadgeAward` is what
  actually enforces one winner per tier per period.
- `User.trainerStatus` is the real trainer gate. `role` may already be
  `TRAINER` while a request is pending, so the applicant can sit on `/trainer`;
  writes still require `APPROVED`.

## Quick-call timing

Ranking uses the server's monotonic clock (`process.hrtime.bigint()`) sampled
when the answer arrives, measured from when the call opened. The browser's
click timestamp is transmitted and stored, but only ever displayed — ranking on
a client-supplied time would be trivially spoofable.

Live state lives in an in-memory map on the server and is flushed to
`QuickCallResponse` in one transaction when the round closes. This is
single-process by design; running multiple instances would need
`@socket.io/redis-adapter` plus a shared store.

## Security notes

- Route handlers never read a wallet address from the request body. The address
  always comes from the signed Auth.js session — see `lib/guards.ts`.
- SIWE messages are bound to the origin and to the Auth.js CSRF token as nonce,
  so a signature captured elsewhere cannot be replayed.
- Signature recovery is local (`recoverMessageAddress`), so sign-in does not
  depend on an RPC. Smart-contract wallets (EIP-1271) are consequently not
  supported.
- The socket handshake decodes the session cookie and re-checks classroom
  membership server-side before joining a room.
- Trainer is not self-assigned. Applying sets `role = TRAINER` with
  `trainerStatus = PENDING`; classroom creation and other trainer writes go
  through `requireApprovedTrainer`, which re-reads the database. The only
  wallet that can move a request to `APPROVED` is
  `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS`, checked against the SIWE session.

## Trainer approval

Anyone can open `/trainer` and send a request. Until the owner approves it they
see a waiting room: they are signed in as a trainer, they cannot create a
classroom, and polling refreshes the page when the decision lands.

The owner signs in with the wallet in `NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS` and
opens `/admin`. Approving is the only code path that sets `trainerStatus` to
`APPROVED`. Declining (or later revoking) sets the role back to `TRAINEE`.
Existing classrooms stay, because the contracts are owned by that wallet, not
by the platform.

Set the owner, migrate, then rebuild so Next inlines the `NEXT_PUBLIC_` value:

```bash
# .env
NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS="0xYourMetaMaskAddress"

npx prisma migrate dev
npm run dev          # or `npm run build && npm start`
```

## Known limitations

- Single-process realtime; no Redis adapter wired up yet.
- The indexer polls rather than subscribing, so confirmation lags by up to
  `INDEXER_POLL_INTERVAL_MS`.
- `ClassBadges.uri()` is set at deploy time from `window.location.origin`. If
  you move hosts, call `setBaseURI` on the contract.
#   p r o o f - o f - c l a s s  
 