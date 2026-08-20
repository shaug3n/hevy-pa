# Hevy Coach

Local, read-only Hevy personal-coach MVP. Users create an account, complete a secure setup, connect their own Hevy developer key, track goals, and chat with an OpenAI-powered coach.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `HEVY_ENCRYPTION_KEY` (a base64-encoded 32-byte key). Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
3. Run `pnpm install` then `pnpm dev` and open `http://localhost:3000`.

Hevy keys are entered only in onboarding—never in environment files. `HEVY_API_BASE_URL` is optional and supports a synthetic local provider for development/testing; production uses the official HTTPS endpoint. `DATA_STORE_PATH` is optional; Windows defaults to `%LOCALAPPDATA%\\hevy-pa\\store.json`.

The Hevy MCP integration is GET-only: it can read account info and recent workouts, and exposes no mutation tools. Chat deliberately returns `503` when OpenAI is not configured; there is no mock-success fallback. Never commit `.env.local` or any real credentials.

## Verify

Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Stop the dev server before a production build; the build safely clears only this project’s generated `.next` directory.
