# Sleep Early!

Expo (React Native) + Supabase app that asks why you're still up and gives you one action to wind down.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key.
3. In the Supabase SQL editor, run every file in `supabase/migrations/` in order (`001`, then `002`).
4. In Supabase → Authentication → Providers, enable **Anonymous sign-ins**.
5. `npx expo start`

The anon key is public by design (row-level security protects data). Never commit a `service_role` key.
