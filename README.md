# Lex Fridman — Design Showcase (Static Site)

A static rebuild of a Webflow design for portfolio hosting on Cloudflare Pages. This is a design recreation, not the official [lexfridman.com](https://lexfridman.com).

## Commands

```bash
npm install
npm run build   # reads data/*.csv → outputs dist/
npm run dev     # serve dist/ locally
npm run verify  # check pages, links, and CMS content counts
```

## URL map

The site has **17 HTML pages** — not one page per CMS item.

### Main pages (5)

| URL | File | Description |
|---|---|---|
| `/` | `index.html` | Home |
| `/podcast` | `podcast.html` | Podcast listing (12 sample conversations) |
| `/research` | `research.html` | Research listing (10 papers, all inline) |
| `/deep-learning` | `deep-learning.html` | Teaching videos listing (26 videos, all inline) |
| `/404` | `404.html` | Not found |

### Podcast detail pages (12)

Each episode has a designed detail page linked from the **DETAILS** button on the podcast list.

| URL | Episode |
|---|---|
| `/podcast/100` | #100 — My Dad, the Plasma Physicist |
| `/podcast/18` | #18 — Tesla Autopilot |
| `/podcast/41` | #41 — Quantum Mechanics, String Theory, and Black Holes |
| `/podcast/47` | #47 — Quantum Mechanics and Many-Worlds |
| `/podcast/48` | #48 — C++ |
| `/podcast/53` | #53 — Language, Cognition, and Deep Learning |
| `/podcast/62` | #62 — Algorithms, TeX, Life, and The Art of Computer Programming |
| `/podcast/85` | #85 — Physics of Consciousness and the Infinite Universe |
| `/podcast/87` | #87 — Evolution, Intelligence, Simulation, and Memes |
| `/podcast/88` | #88 — Geometric Unity and the Call for New Ideas, Leaders & Institutions |
| `/podcast/89` | #89 — Cellular Automata, Computation, and Physics |
| `/podcast/91` | #91 — Square, Cryptocurrency, and Artificial Intelligence |

### No per-item pages for

- **Research** (10 items) — cards on `/research` link externally (Paper, Video, Scholar, BibTeX)
- **Deep Learning Videos** (26 items) — cards on `/deep-learning` link externally (SLIDES, Video)

## Project structure

```
├── data/           # Webflow CMS CSV exports
├── src/            # HTML templates and assets
│   └── templates/podcast-detail.html
├── scripts/
│   ├── build.mjs
│   └── verify-links.mjs
└── dist/           # build output (deploy this)
```

## Cloudflare (Applications / Workers)

Cloudflare now deploys static sites via **Workers & Pages → Create application → Connect Git**, not the old standalone Pages flow.

### Dashboard settings

Use these values on the **Set up your application** screen:

| Setting | Value |
|---|---|
| Repository | `akshaykhurana/webflow-lex-fridman` |
| Project name | `webflow-lex-fridman` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

The repo includes [`wrangler.jsonc`](wrangler.jsonc), which tells Wrangler to upload `./dist` as static assets after the build step. Without this file, `npx wrangler deploy` will fail looking for Worker script entry point.

### After deploy

Your site will be live at `https://webflow-lex-fridman.<your-subdomain>.workers.dev` (or a custom domain if configured).

Test these URLs:
- `/` — home
- `/podcast` — podcast list
- `/podcast/100` — sample detail page
- `/research` — research list
- `/deep-learning` — teaching videos

Cloudflare Workers serves extensionless URLs automatically (e.g. `podcast.html` → `/podcast`).

### Custom domain (optional)

Application → **Settings** → **Domains & routes** → add your domain.

### Troubleshooting

- **Deploy fails: no entry point** — confirm `wrangler.jsonc` is committed and `assets.directory` is `./dist`.
- **Build fails on image download** — build needs network access (default on Cloudflare).
- **Node version** — `.node-version` pins Node 22 (required by Wrangler 4.x).
