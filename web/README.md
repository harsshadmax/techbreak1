# TechBreak web app

React 19 + TypeScript + Vite + Tailwind CSS 4. It talks to the API in `../server`.

```bash
npm install
cp .env.example .env     # optional: point VITE_API_BASE_URL at another API
npm run dev              # http://localhost:5173
npm run typecheck && npm test
npm run build            # static files in dist/
```

Layout: `src/lib` (API client, auth, pure logic, hooks), `src/ui` (faces, icons, shared components), `src/pages` (one file per screen).
Design tokens live in `src/index.css` (`@theme`).
