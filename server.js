const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 10000;
const rootDir = __dirname;

app.disable("x-powered-by");

app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    next();
});

app.get("/supabase-config.js", (_req, res) => {
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL || "https://YOUR_PROJECT_REF.supabase.co",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY",
        RENDER_API_BASE_URL: process.env.RENDER_API_BASE_URL || "https://YOUR_RENDER_SERVICE.onrender.com"
    };

    res.type("application/javascript");
    res.setHeader("Cache-Control", "no-store");
    res.send(`window.APP_CONFIG = ${JSON.stringify(config, null, 4)};`);
});

app.use(express.static(rootDir));

app.get("/", (_req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, () => {
    console.log(`DebateHub listening on port ${port}`);
});
