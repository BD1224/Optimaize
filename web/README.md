# Optimaize web app

The Optimaize chat site: Next.js 16 (App Router), deployed on Vercel. Supabase will hold the data. Until the backend exists, the app runs on an in-memory mock, so nothing is saved between page reloads.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Where things are

| Path | What |
|---|---|
| `src/app/` | Routes: `/` (home), `/c/[id]` (chat), `/savings`, `/learn`, `/settings`, `/welcome` |
| `src/components/shell/` | Sidebar (new chat, search, pinned, recents, savings meter, profile) and top bar |
| `src/components/composer/` | Message box with language chip, Optimize toggle and live token estimate |
| `src/components/home/`, `chat/`, `savings/`, `settings/` | One folder per screen |
| `src/components/ui/` | Stat card, savings badge, shared page styles |
| `src/lib/api/client.ts` | **The only file that talks to the backend.** Swap the mock for real calls here |
| `src/lib/api/mock.ts` | Fake backend with sample chats. Numbers are made up |
| `src/lib/api/types.ts` | Data shapes the UI expects from the backend |
| `src/lib/store.tsx` | App-wide state: profile, models, chat list, this week's stats |
| `src/app/globals.css` | Design tokens (dark theme) |

## Notes

- This Next.js version has Cache Components on. Pages stay mounted (hidden) after you navigate away, and anything that reads the URL on a dynamic route must sit inside `<Suspense>`. Read `node_modules/next/dist/docs/` before relying on older Next.js habits.
- Styling is CSS Modules with the tokens in `globals.css`. There's no CSS framework.
