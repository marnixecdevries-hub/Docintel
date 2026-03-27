# DocIntel — AI Document Intelligence Dashboard

A team-facing PDF analysis dashboard powered by Claude AI.

## Deploy to Vercel (recommended)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create docintel --public --push
```

### 2. Import to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Add environment variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from https://console.anthropic.com
4. Click **Deploy**

That's it — Vercel will give you a shareable URL for your team.

---

## Deploy to Netlify

### 1. Push to GitHub (same as above)

### 2. Import to Netlify
1. Go to https://app.netlify.com/start
2. Connect your GitHub repo
3. Set build command: `npm run build`
4. Set publish directory: `.next`
5. Add environment variable `ANTHROPIC_API_KEY` in Site Settings → Environment Variables
6. Deploy

---

## Run locally

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000

## How it works

- PDFs are read in the browser and sent as base64 to `/api/analyse`
- The Next.js API route adds your secret API key and calls Claude
- Results (summary, stats, insights, table) are rendered in the dashboard
- Your API key is never exposed to the browser
