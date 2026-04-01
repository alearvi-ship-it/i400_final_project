# i400_final_project

Static frontend pages for a debate team website, now wired for Supabase auth/data and Render deployment.

## Pages

- index.html: login page (Supabase email/password sign-in)
- debates.html: authenticated debates dashboard (reads Debate rows)
- settings.html: authenticated profile settings (upserts Students row)

## Supabase setup

1. Create a new Supabase project.
2. Open SQL Editor and run build.sql.
3. In Authentication, create at least one test user (email/password).
4. Copy your Project URL and anon public key.
5. Update placeholders in supabase-config.js:
	- SUPABASE_URL
	- SUPABASE_ANON_KEY

## Render setup

This repo includes render.yaml configured as a Render Static Site.

1. Push this repo to GitHub.
2. In Render, create a new Static Site from the repo.
3. Render should auto-detect render.yaml.
4. Optional: if you add a separate API service on Render later, set RENDER_API_BASE_URL in:
	- .env.example (for documentation)
	- supabase-config.js (for local/browser runtime)

## Local run

Because this app uses module/CDN scripts and auth redirects, run it from a local web server instead of opening files directly.

Example with Python:

python -m http.server 5500

Then open:

http://localhost:5500/index.html