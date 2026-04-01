const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 10000;
const rootDir = __dirname;

app.get("/supabase-config.js", (_req, res) => {
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL || "https://YOUR_PROJECT_REF.supabase.co",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY",
        RENDER_API_BASE_URL: process.env.RENDER_API_BASE_URL || "https://YOUR_RENDER_SERVICE.onrender.com"
    };

    res.type("application/javascript");
    res.send(`window.APP_CONFIG = ${JSON.stringify(config, null, 4)};`);
});

app.use(express.static(rootDir));

app.get("/", (_req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, () => {
    console.log(`DebateHub listening on port ${port}`);
});
