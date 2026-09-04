# Staging (Firebase Hosting preview channels)

## What this is

Firebase Hosting supports **preview channels** — temporary, isolated deploys
of the built `dist/` folder that live at their own auto-generated URL
(e.g. `https://eg-connect--staging-xxxxxxx.web.app`) and never touch the
production site served from the `live` channel. Preview channels are a free
feature of the **Spark plan** — no Blaze upgrade is needed to use them.

This gives us a real, shareable staging environment (running against the
same Firebase project's live Firestore/Auth/Storage — it is not an
emulator) without any risk of overwriting production hosting.

## How to deploy to staging

```bash
npm run deploy:staging
```

This runs:

```bash
npm run build && npx firebase-tools hosting:channel:deploy staging --expires 30d
```

1. `npm run build` — builds the current working tree into `dist/` (same
   build Vite produces for production).
2. `firebase hosting:channel:deploy staging` — uploads `dist/` to a channel
   named `staging` instead of the `live` channel, printing a temporary
   preview URL in the terminal output.
3. `--expires 30d` — the channel (and its URL) self-destructs 30 days after
   the deploy if nobody redeploys to it sooner. Firebase's max is 30 days for
   channel expiry; re-running the command resets the clock.

Every time you run `npm run deploy:staging` it redeploys to the **same**
`staging` channel/URL (channel names are stable — only the content behind
the URL changes), so it's safe to share the link with reviewers and keep
reusing it across iterations.

### Requirements

- The Firebase CLI must be authenticated on the machine running the command
  (`firebase login`, or a `FIREBASE_TOKEN`/service account in CI). This repo
  does not currently run staging deploys from CI — this is a local/manual
  command for now.
- The authenticated account/service account needs access to whichever
  Firebase project is active for `.firebaserc` (currently
  `gen-lang-client-0951010679`).

### Important: the URL is temporary

Do not treat the staging URL as a stable link to bookmark long-term. It is
meant for short-lived review of a specific build (a PR, a pre-release
check, a demo). If you need it to keep working, redeploy periodically before
it expires — `hosting:channel:deploy` also accepts `firebase hosting:channel:open staging`
to look up the current URL, and `firebase hosting:channel:list` to see all
active channels and their expiry.

## How this compares to the current production deploy flow

There is currently **no npm script** for production — production deploys
are done by hand:

```bash
npm run build
npx firebase-tools deploy --only hosting
```

(equivalently `firebase deploy --only hosting` if the CLI is installed
globally). This pushes `dist/` straight to the `live` channel, i.e.
straight to the real, public production URL, immediately, with no preview
step and no expiry.

The staging flow above is the same build artifact and the same underlying
`firebase-tools` command family, just aimed at a disposable channel instead
of `live`. It's a way to sanity-check a real deployed build (routing,
`index.html` rewrites, static asset paths, PWA manifest, etc. — things
`vite build` alone can't fully validate) before it goes to production,
without any risk of it becoming production.

## Verification status (as of this writing)

The Firebase CLI in this environment is authenticated as
`ebanavision@gmail.com`, but `firebase projects:list` under that account
does **not** include this repo's project
(`gen-lang-client-0951010679`, per `.firebaserc`) — only unrelated projects
(`Harmony OS`, `pagina web`, `My First Project`, a second `Harmony-OS`
Studio project) are visible. So a real `hosting:channel:deploy staging`
against this project could not be executed/verified from here — doing so
would fail on a permissions error, not prove anything either way. The
script and this doc are ready for whoever has access to
`gen-lang-client-0951010679` to run and confirm.
