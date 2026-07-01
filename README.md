# OmniWhore

# OmniView — Asset Intelligence

**A self-contained, cryptographically verified asset ledger in a single HTML file.**

OmniView is a decentralized, offline-capable CMDB (Configuration Management Database) that tracks servers, laptops, routers, phones—any network asset—by IP address. Every change is appended as a signed block to an Ed25519‑secured ledger. Peer ledgers can be imported and merged without conflicts, with full signature verification. A built-in map view shows asset locations, and optional WebAuthn passkey binding anchors your identity to a hardware authenticator.

No backend, no build step, no CDN dependency for cryptography: Noble Ed25519 is bundled inline. Works offline, in any modern browser, with zero configuration.

---

## Features

- **🔐 Ed25519 Identity** – A keypair is generated locally on first run. Every ledger entry is signed with your private key.
- **📒 Immutable Ledger** – All asset operations (create, update, enroll, retire) are recorded in a cryptographically linked, append‑only log.
- **🔄 Peer Merge** – Import another user's signed ledger. Blocks are merged idempotently by `(author, index, hash)`, and the entire merged chain is re‑verified before commit.
- **🗺️ Asset Map** – Geolocated assets are plotted on an interactive map (powered by Leaflet).
- **🔍 Faceted Search** – Filter by status, country, service, organisation, or peer origin.
- **🛡️ WebAuthn Anchor** – Bind a passkey to your Ed25519 identity. Peers can verify that your public key is backed by a physical authenticator.
- **🔑 Key Backup & Restore** – Export your identity (private key) as a file, and restore it on another machine.
- **📤 Signed Exports** – Export the full ledger as a self‑contained proof, including a Merkle root and envelope signature. Archive attempts are made automatically.
- **💾 Atomic Durable Storage** – localStorage writes use a temp → verify → commit pattern with crash recovery.
- **🎨 Dark & Light Themes** – Toggle with a single click.

---

## Quick Start

1. **Open `index.html`** in any modern browser (Chrome, Firefox, Edge, Safari).
   - No server required. The file can even be opened directly from your disk (`file://`).

2. **Your identity is created automatically** the first time you load the page.

3. **Start adding assets** – click `＋ Add Asset`, enter an IP address and optional details, and hit **Create & Sign**.

4. **Browse, filter, and manage** your inventory on the **Results** tab.

5. **Share your data** – export your ledger and give the file to a colleague. They can import it, and their ledger will merge with yours.

---

## Usage Guide

### Identity
- Your Ed25519 public key is shown in the **Ledger** view and in the **Help** section.
- **Backup your identity** immediately (`🔑 Backup key` in the Ledger view). Store the `.json` file in a safe place; anyone with this file can sign on your behalf.
- **Restore** on another machine using `🔓 Restore key`. The ledger will follow you (existing local assets will be preserved).

### Adding & Managing Assets
- Use the `＋ Add Asset` button. Fill in IP, hostnames, department, country code, ports (as JSON), tags, and optionally coordinates.
- Each creation, update, enrollment, or retirement is recorded as a signed block in the ledger.
- Enrolling an asset marks it as verified (`active`). Retirement marks it as `decommissioned`.

### Importing a Peer Ledger
1. Obtain an OmniView proof file (`.json`) from a peer.
2. Click `⤒ Import` (in the Results toolbar) or `⤒ Import peer` (in the Ledger view).
3. The file undergoes **five cryptographic checks**:
   - Envelope signature and body integrity
   - Per‑author subchain verification (genesis, links, signatures)
   - Merkle root match
   - Optional WebAuthn anchor validation
4. Valid blocks are merged into your ledger. The merged whole is re‑verified before being saved.
5. Peer assets appear in your registry tagged with their origin (e.g., “peer a1b2c3d…”).

### Map View
- Switch to the **Maps** tab. Assets with valid coordinates are displayed as colour‑coded circles.
- Hover over a marker to see details. The map automatically adjusts to show all visible assets.

### Passkey Binding (Optional)
- In the **Ledger** view, click `🔐 Bind passkey` to register a FIDO2/WebAuthn authenticator.
- The authenticator signs a challenge derived from your Ed25519 public key. This proves to peers that your identity is anchored to a hardware token.
- Use `✔ Assert` to test that you still possess the authenticator.

---

## Security & Cryptography

- **Ed25519** signatures are performed using the audited [Noble Ed25519](https://github.com/paulmillr/noble-ed25519) library, embedded directly in the page. No external CDN is required for crypto.
- **SHA‑256** is used for block hashing, Merkle trees, and canonical JSON hashing.
- **Genesis Block**: All OmniView nodes share the same fixed genesis block with a deterministic hash, providing a common root of trust.
- **Canonical JSON**: Keys are sorted recursively before hashing, ensuring identical output across browsers and machines.
- **Sig‑gated Replay**: The asset registry is built *only* from a fully verified ledger. Tampered or unsigned blocks cannot affect the displayed inventory.
- **Import Verification**: Peer proof files are checked for:
  1. Envelope signature validity (signed by the exporter).
  2. Body hash integrity.
  3. Full chain verification (genesis → all subchains).
  4. Merkle root of all non‑genesis blocks.
  5. Optional WebAuthn anchor binding.

---

## Storage & Backup

All data is stored in your browser’s `localStorage` under the origin where the page is served.

| Item | Key | Purpose |
|------|-----|---------|
| Identity | `ov_identity_v5` | Your Ed25519 private + public key |
| Ledger | `ov_ledger_v5` | All signed blocks |
| Settings | `ov_settings_v5` | Theme preference |
| WebAuthn | `ov_webauthn_v5` | Passkey binding information |

**To move your entire workspace to another browser/machine:**
1. Export your identity (`🔑 Backup key`).
2. Export your ledger (`⤓ Export proof`).
3. On the new machine, restore your identity, then import the proof file.

> ⚠️ **Never share your identity file** (it contains your private key). Only share **proof exports** (which contain only public data and signatures).

---

## Deployment

OmniView is a single static HTML file. You can deploy it anywhere:

- **GitHub Pages**: Push the file to a `gh-pages` branch or configure the main branch for Pages.
- **Cloudflare Pages**: Drag and drop the HTML file into the dashboard.
- **Netlify / Vercel**: Deploy from a Git repository or via CLI.
- **Local file**: Just open `index.html` in your browser. (Map tiles may require an internet connection; the rest works offline.)

No build step, no npm install, no server.

### Optional: Self‑host Leaflet tiles
The map uses free CartoDB dark tiles. For heavy use or complete offline capability, you can bundle your own tile set or switch to OSM standard tiles by editing the `L.tileLayer` URL in the source.

---

## Technical Overview

- **Architecture**: The application is a single-page web app with no frameworks. All logic (crypto, ledger, UI, map) lives in one `<script>` tag.
- **Ledger Model**: Multiple authors each extend their own linear subchain from a common genesis. Blocks are keyed by `(author, index, hash)`. Merging is a simple set union; verification checks each subchain independently.
- **Proof Format**: Exports are JSON files with a well‑defined `format: "omniview-proof"` schema, containing the full block array, Merkle root, chain validity flag, and an Ed25519 envelope signature.
- **Map**: Leaflet.js is loaded from CDN; the map itself is not required for core functionality.

---

## License

MIT – use it freely. See `LICENSE` for details.

---

## Contributing

This is a personal tool grown out of real operational needs. Bug reports, suggestions, and pull requests are welcome. Open an issue to discuss any significant changes.

---

*Built with AI on a sidewalk.... 💾, 🖊️, and a lot of skimming*
