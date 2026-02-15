# DNS Manager

Minimal Cloudflare DNS record manager — fast, local, no clutter.

## Features

- Browse all DNS records with filtering by type and search
- Add new records of any type (A, AAAA, CNAME, MX, TXT, SRV, etc.)
- Edit existing records inline
- Delete records with confirmation
- Pagination for large zones
- Proxied always off by default — no proxy toggle clutter

## Usage

1. Open `index.html` in a browser (or deploy to Vercel)
2. On first load, you'll see a settings modal
3. Enter your configuration:
   - **Domain**: Your domain name (e.g., `example.com`)
   - **Zone ID**: Found in Cloudflare dashboard (see below)
   - **API Token**: Create one with Zone.DNS edit permissions (see below)
4. Click Save — settings are stored in browser localStorage

**Getting your API Token:**
- Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
- Profile → API Tokens → Create Token
- Use **Edit zone DNS** template or custom token with `Zone → DNS → Edit` permission

**Getting your Zone ID:**
- Go to your domain's overview in Cloudflare dashboard
- Find Zone ID in the right sidebar under "API"

**Settings button:** Click the ⚙ icon in the header to change config anytime.

## Deployment

Deployed on [Vercel](https://vercel.com).

## Tech Stack

- Plain HTML5
- CSS3 (custom properties, no preprocessor)
- Vanilla JavaScript (ES6+)

## Design System

This project uses [Elouan's Design System](https://e5g.dev/css).

## License

MIT
