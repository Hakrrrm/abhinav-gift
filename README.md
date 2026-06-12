# TV Media Player

A simple website that loops images and videos fullscreen on a TV browser, with an
admin page to upload, delete, and reorder the media.

- **`/`** — the TV player. Open this on the TV browser. It plays the playlist on a
  loop (videos play to the end, images show for a configurable number of seconds)
  and automatically picks up playlist changes within ~1 minute.
- **`/admin`** — password-protected admin page: upload media, reorder with ↑/↓,
  delete, and set how long images are shown.

Media files and the playlist are stored in **Vercel Blob**, so everything persists
across deploys.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo (it must be the repo root, or set the
   project's *Root Directory* in Vercel to this folder).
2. Go to [vercel.com](https://vercel.com), **Add New → Project**, and import the
   repo. The Next.js defaults are fine.
3. In the project, open **Storage → Create Database → Blob** and connect it.
   This automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable.
4. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` with the
   password you want for the admin page.
5. Redeploy (Deployments → ⋯ → Redeploy) so the new env vars take effect.
6. Open `https://your-project.vercel.app/admin`, log in, and upload media.
7. Open `https://your-project.vercel.app/` on the TV browser.

### Free tier limits (Vercel Hobby)

- Blob storage: ~1 GB stored, ~10 GB bandwidth per month. Fine for a handful of
  showcase videos; keep videos compressed (1080p H.264 MP4 is the safest format
  for TV browsers).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in ADMIN_PASSWORD and BLOB_READ_WRITE_TOKEN
npm run dev
```

The Blob token can be copied from the Vercel dashboard (Storage → your Blob
store → `.env.local` tab). Without it the player still renders, but uploads and
playlist saves are disabled.

## TV notes

- Videos play **muted** — most TV/embedded browsers block autoplay with sound.
- If the TV browser blocks autoplay entirely, the player shows a
  "Tap / press OK to start playback" overlay once; after that it loops unattended.
- The player hides the cursor and uses `object-fit: contain`, so media is
  letterboxed rather than cropped.
