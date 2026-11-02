# Kalacar Web Dashboard

Owner dashboard for Kalacar (`kalacar.in`), built with React, Vite, and TypeScript.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

For local development against the Next.js API running on `http://127.0.0.1:3000`, the default Vite proxy automatically forwards `/api`, `/images`, and `/uploads`.

For production deployment, set `VITE_API_BASE_URL` to your production API URL (e.g. `https://kalacar.in`).

### 3. Run Development Server
```bash
npm run dev
```
Accessible at `http://127.0.0.1:5173`.

### 4. Build for Production
```bash
npm run build
```
Build output is generated in `dist/`.
