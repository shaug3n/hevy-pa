# Hevy Coach

Hevy Coach is a read-only personal fitness coach. Users create an account, connect their own Hevy developer key, track goals and plans, and chat with an OpenAI-powered coach. Production state is stored in Neon Postgres; no application state is written to the Vercel filesystem.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to a dedicated Neon development database or branch, plus `OPENAI_API_KEY`, `OPENAI_MODEL`, and `HEVY_ENCRYPTION_KEY`. Generate the encryption key with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
3. Apply checked-in schema changes with `pnpm db:migrate`.
4. Run `pnpm install` and `pnpm dev`.

The migration command uses `DATABASE_URL_UNPOOLED` when supplied, otherwise `DATABASE_URL`. It is deliberately separate from `pnpm build`: builds must not mutate a production database. Hevy keys are supplied only during onboarding and are encrypted before persistence; never commit `.env.local` or real credentials.

## Deploy to Vercel with Neon

1. Create a Neon project or branch and connect it through the Vercel Neon integration, or set its pooled `DATABASE_URL` manually in Vercel.
2. Set `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and a stable `HEVY_ENCRYPTION_KEY` in the Vercel **Production** environment. Set separate values for Preview and Development; do not clone production encrypted credentials into previews.
3. Run `pnpm db:migrate` once with the target database URL before the first deployment and whenever a new migration is added.
4. Import this GitHub repository into Vercel. Standard Next.js detection is sufficient; no `vercel.json` is required.

Use Neon’s pooled URL for the serverless application runtime. Migrations may use `DATABASE_URL_UNPOOLED` if Neon provides one. Changing Vercel environment variables only affects future deployments, so redeploy after updates.

## Verify

Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Tests use an isolated in-memory adapter only under `NODE_ENV=test`; the production runtime requires `DATABASE_URL` and does not fall back to filesystem storage. The Hevy MCP integration remains GET-only and no test performs a live Hevy or OpenAI call.
