# BOTdreams: keep your dreams on BOT Chain

Every wallet gets its own list of dreams. Add a dream, tick it off when you achieve it, remove it, and share
your list with a link. It's free to use apart from network fees, there's no owner or admin, and the
contract never holds any money. The site is one plain page.

BOTdreams is a sibling of BOTwish: the same tested design under a new name, with its own contract, so its
lists are completely separate. Its look differs only in accent color (violet) and tab icon (a crescent moon).

The BOT Chain website (https://www.botchain.ai) and BOT Scan (https://scan.botchain.ai/) are linked in
the header and footer, and the footer links the deployed contract on BOT Scan.

## Read this first: everything here is public

A blockchain is a public record. Anyone can read any wallet's dreams, and the site says so.

- **Removing a dream hides it, it doesn't erase it.** The contract clears the text from its storage and
  marks the dream removed, but the original text was already written into transaction data and event
  logs, and that history can't be deleted.
- Don't put anything private or sensitive in a dream.

## What it does

- `addDream(text)`: up to 140 characters on the site (the contract allows up to 420 bytes, which covers
  140 characters even with accents and symbols).
- `setAchieved(id, true/false)`: tick or untick a dream as achieved.
- `removeDream(id)`: hide a dream. Dream ids never change, so the rest of your list is unaffected.
- `getDreams(address)`: anyone can read anyone's list. This is how share links work: `?list=0x...`
  opens that wallet's list read-only.
- Each wallet can create up to 1,000 entries over its lifetime (removed dreams count toward this).

Every write acts on the caller's own list, so nobody can edit, tick, or remove another wallet's dreams.
The contract has no payable function, so sending BOT to it fails. Tests check both of these, and they
assert the contract's exact list of functions, so an admin or upgrade hook can't be added unnoticed.

## Configure (top of the `<script>` in `index.html`)

| Constant | Meaning |
|---|---|
| `CONTRACT_ADDRESS` | Paste the deployed address. Until set, the wallet connects but lists can't load. |
| `NETWORK` | `"mainnet"` (BOT Chain, id 677) or `"testnet"` (id 968). One word to switch. |
| `DEMO` | Leave `false`. The preview copy sets it to `true` to simulate a wallet and chain. |

## Deploy

```bash
npm install
cp .env.example .env        # add the deployer wallet's private key
npm run compile
npm test                    # 21 tests
npm run deploy:mainnet      # or deploy:testnet; prints the contract address
```

1. Paste the address into `CONTRACT_ADDRESS` in `index.html`.
2. Push the folder to GitHub and import it into Vercel as a static site (no build command).
   There's nothing else to configure: no API keys, no server code.

## Testing notes (what was and wasn't verified)

- **Contract:** 21 tests pass, covering adding, length limits (including multi-byte characters), the
  1,000-entry cap, ticking, removing, per-wallet isolation, public reads, and the structural guarantees.
- **Site, simulated:** every flow was exercised in a headless DOM against the demo adapter, including
  that dream text is shown as plain text, never as HTML.
- **Site, real path:** the real page (not demo mode) was driven against the real contract on a local
  chain: connect, add (including emoji), tick and untick, remove, the share link, a second wallet
  viewing the first wallet's list read-only, a wallet on the wrong network that declines and then
  accepts the switch, a rejected transaction, and a visitor with no wallet.
- **Not verified:** how it looks in a real browser or on phones (no browser was available), behavior
  with specific wallets, and live behavior against BOT Chain's public RPC. One thing to check once live:
  a visitor with no wallet opening a share link relies on the browser being allowed to call
  `rpc.botchain.ai` directly. If that's blocked, they see "Connect a wallet to view it", and everything
  still works once they connect.
- Unaudited. The contract is deliberately tiny, which keeps the risk low, but it hasn't been reviewed
  by a third party.
