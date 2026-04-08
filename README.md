# i400_final_project

Static frontend pages for a debate team website, now wired for Supabase auth/data and Render deployment.

## Pages

- index.html: login page (Supabase email/password sign-in)
- profiles.html: admin-only profile directory (search students/judges/coaches)
- user-history.html: admin-only page for viewing a selected user's debate history
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

## Render setup (Web Service)

This repo includes render.yaml configured as a Render Node Web Service so npm install/npm start succeed.

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Render should auto-detect render.yaml and use:
	- buildCommand: npm install
	- startCommand: npm start
4. Set environment variables in Render:
	- SUPABASE_URL
	- SUPABASE_ANON_KEY
	- Optional: RENDER_API_BASE_URL

Notes:

- server.js serves static files and also serves /supabase-config.js from Render environment variables.
- The local supabase-config.js file is optional for local static testing.

## Local run

Because this app uses module/CDN scripts and auth redirects, run it from a local web server instead of opening files directly.

Example with Python:

python -m http.server 5500

Then open:

http://localhost:5500/index.html