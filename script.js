const toggleButton = document.querySelector("[data-toggle-password]");

if (toggleButton) {
    toggleButton.addEventListener("click", () => {
        const inputId = toggleButton.getAttribute("aria-controls");
        const passwordInput = inputId ? document.getElementById(inputId) : null;

        if (!passwordInput) {
            return;
        }

        const shouldShow = passwordInput.type === "password";
        passwordInput.type = shouldShow ? "text" : "password";
        toggleButton.textContent = shouldShow ? "Hide" : "Show";
        toggleButton.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    });
}

function getSupabaseClient() {
    const config = window.APP_CONFIG || {};
    const url = config.SUPABASE_URL;
    const anonKey = config.SUPABASE_ANON_KEY;

    if (!url || !anonKey || url.includes("YOUR_PROJECT_REF") || anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
        return null;
    }

    if (!window.supabase || !window.supabase.createClient) {
        return null;
    }

    return window.supabase.createClient(url, anonKey);
}

const supabaseClient = getSupabaseClient();

function setMessage(target, message, isError) {
    if (!target) {
        return;
    }

    target.textContent = message;
    target.style.color = isError ? "#a11" : "#165b33";
}

async function handleLoginForm() {
    const loginForm = document.querySelector("[data-login-form]");
    const messageEl = document.querySelector("[data-auth-message]");

    if (!loginForm) {
        return;
    }

    if (!supabaseClient) {
        setMessage(messageEl, "Supabase is not configured yet. Update supabase-config.js placeholders.", true);
        return;
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = loginForm.querySelector('input[name="email"]')?.value?.trim();
        const password = loginForm.querySelector('input[name="password"]')?.value || "";

        if (!email || !password) {
            setMessage(messageEl, "Email and password are required.", true);
            return;
        }

        setMessage(messageEl, "Signing in...", false);

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            setMessage(messageEl, error.message, true);
            return;
        }

        setMessage(messageEl, "Signed in. Redirecting...", false);
        window.location.href = "debates.html";
    });
}

function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return { firstName, lastName };
}

async function requireAuthenticatedUser() {
    if (!supabaseClient) {
        return { user: null, error: new Error("Supabase client is not configured.") };
    }

    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
        return { user: null, error: error || new Error("No active session.") };
    }

    return { user: data.user, error: null };
}

async function preloadSettingsForm() {
    const settingsForm = document.querySelector("[data-settings-form]");
    if (!settingsForm || !supabaseClient) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        return;
    }

    settingsForm.querySelector('input[name="email"]').value = user.email || settingsForm.querySelector('input[name="email"]').value;

    const { data } = await supabaseClient
        .from("Students")
        .select("first_name,last_name,graduation_year")
        .eq("email", user.email)
        .maybeSingle();

    if (!data) {
        return;
    }

    settingsForm.querySelector('input[name="full-name"]').value = [data.first_name, data.last_name].filter(Boolean).join(" ");
    if (data.graduation_year) {
        settingsForm.querySelector('input[name="grad-year"]').value = data.graduation_year;
    }
}

async function handleSettingsForm() {
    const settingsForm = document.querySelector("[data-settings-form]");
    const messageEl = document.querySelector("[data-settings-message]");

    if (!settingsForm) {
        return;
    }

    if (!supabaseClient) {
        setMessage(messageEl, "Supabase is not configured yet. Update supabase-config.js placeholders.", true);
        return;
    }

    await preloadSettingsForm();

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = settingsForm.querySelector('input[name="full-name"]')?.value || "";
        const email = settingsForm.querySelector('input[name="email"]')?.value?.trim() || "";
        const gradYearRaw = settingsForm.querySelector('input[name="grad-year"]')?.value || "";
        const gradYear = gradYearRaw ? Number(gradYearRaw) : null;
        const { firstName, lastName } = splitName(fullName);

        if (!email || !firstName) {
            setMessage(messageEl, "Full name and email are required.", true);
            return;
        }

        const { user, error: userError } = await requireAuthenticatedUser();
        if (userError || !user) {
            setMessage(messageEl, "Please sign in again before saving profile changes.", true);
            return;
        }

        setMessage(messageEl, "Saving profile...", false);

        const payload = {
            first_name: firstName,
            last_name: lastName,
            email,
            graduation_year: Number.isFinite(gradYear) ? gradYear : null,
            auth_user_id: user.id
        };

        const { error } = await supabaseClient
            .from("Students")
            .upsert(payload, { onConflict: "email" });

        if (error) {
            setMessage(messageEl, error.message, true);
            return;
        }

        setMessage(messageEl, "Profile saved.", false);
    });
}

function formatDateLabel(isoDate) {
    if (!isoDate) {
        return "TBD";
    }

    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function createUpcomingCard(debate) {
    const article = document.createElement("article");
    article.className = "debate-card debate-card--upcoming";

    const eventName = debate.topic || "Debate";
    const status = debate.status || "Registered";
    const when = formatDateLabel(debate.debate_date);
    const location = debate.room || "Location TBD";

    article.innerHTML = `
        <div class="debate-card-head">
            <div>
                <span class="tag tag--event">${eventName}</span>
                <span class="tag tag--upcoming">${status}</span>
            </div>
            <time class="debate-date">${when}</time>
        </div>
        <h4 class="debate-title">${debate.team_a_name || "Team A"} vs ${debate.team_b_name || "Team B"}</h4>
        <p class="debate-meta">${location}</p>
        <div class="debate-card-foot">
            <a class="primary-button debate-button" href="#">View prep materials</a>
            <a class="ghost-button debate-button" href="#">Tournament info</a>
        </div>
    `;

    return article;
}

function createPastCard(debate) {
    const article = document.createElement("article");
    article.className = "past-card";

    const status = (debate.status || "Completed").toLowerCase();
    const isWin = status.includes("win");
    const badgeClass = isWin ? "result-badge result-badge--win" : "result-badge result-badge--loss";
    const badgeText = isWin ? "Win" : "Completed";
    const when = formatDateLabel(debate.debate_date);

    article.innerHTML = `
        <div class="past-card-left">
            <span class="${badgeClass}">${badgeText}</span>
            <div>
                <h4 class="debate-title">${debate.topic || "Debate Round"}</h4>
                <p class="debate-meta">${when} &bull; ${debate.team_a_name || "Team A"} vs ${debate.team_b_name || "Team B"}</p>
            </div>
        </div>
        <div class="past-card-right">
            <div class="past-card-actions">
                <a class="ghost-button" href="#">View ballots</a>
            </div>
        </div>
    `;

    return article;
}

async function handleDebatesPage() {
    const upcomingList = document.querySelector("[data-upcoming-list]");
    const pastList = document.querySelector("[data-past-list]");
    const upcomingCount = document.querySelector("[data-upcoming-count]");
    const pastCount = document.querySelector("[data-past-count]");

    if (!upcomingList || !pastList) {
        return;
    }

    if (!supabaseClient) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        window.location.href = "index.html";
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const upcomingResponse = await supabaseClient
        .from("Debate")
        .select("debate_id,debate_date,topic,room,status,team_a_name,team_b_name")
        .gte("debate_date", today)
        .order("debate_date", { ascending: true })
        .limit(10);

    const pastResponse = await supabaseClient
        .from("Debate")
        .select("debate_id,debate_date,topic,status,team_a_name,team_b_name")
        .lt("debate_date", today)
        .order("debate_date", { ascending: false })
        .limit(10);

    if (upcomingResponse.error || pastResponse.error) {
        return;
    }

    const upcomingDebates = upcomingResponse.data || [];
    const pastDebates = pastResponse.data || [];

    upcomingList.replaceChildren(...upcomingDebates.map(createUpcomingCard));
    pastList.replaceChildren(...pastDebates.map(createPastCard));

    if (upcomingCount) {
        upcomingCount.textContent = String(upcomingDebates.length);
    }

    if (pastCount) {
        pastCount.textContent = String(pastDebates.length);
    }
}

async function setupSignOut() {
    const signOut = document.querySelector("[data-signout]");
    if (!signOut || !supabaseClient) {
        return;
    }

    signOut.addEventListener("click", async (event) => {
        event.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });
}

handleLoginForm();
handleSettingsForm();
handleDebatesPage();
setupSignOut();
