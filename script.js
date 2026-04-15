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

const TABLES = {
    students: "students",
    judges: "judges",
    coaches: "coaches",
    administrator: "administrator",
    debate: "debate",
    tournament: "tournament",
    tournamentRound: "tournament_round",
    studentParticipation: "s_participation"
};

const PROFILE_CONFIG = {
    student: {
        accountType: "student",
        table: TABLES.students,
        idColumn: "student_id",
        selectColumns: "student_id,auth_user_id,first_name,last_name,school,email,graduation_year,phone,emergency_contact"
    },
    coach: {
        accountType: "coach",
        table: TABLES.coaches,
        idColumn: "coach_id",
        selectColumns: "coach_id,auth_user_id,first_name,last_name,school,email,phone,emergency_contact,years_experience"
    },
    judge: {
        accountType: "judge",
        table: TABLES.judges,
        idColumn: "judge_id",
        selectColumns: "judge_id,auth_user_id,first_name,last_name,school,email,phone,emergency_contact,certification"
    },
    admin: {
        accountType: "admin",
        table: TABLES.administrator,
        idColumn: "admin_id",
        selectColumns: "admin_id,auth_user_id,first_name,last_name,school,email,phone,role_title"
    }
};

const ACCOUNT_TYPE_LABELS = {
    student: "Student",
    coach: "Coach",
    judge: "Judge",
    admin: "Administrator"
};

const DIRECTORY_TABS = {
    students: {
        accountType: "student",
        idColumn: "student_id",
        table: TABLES.students,
        label: "Students",
        title: "Student profiles",
        emptyMessage: "No student profiles matched your search.",
        selectColumns: "student_id,first_name,last_name,school,email,phone,graduation_year"
    },
    judges: {
        accountType: "judge",
        idColumn: "judge_id",
        table: TABLES.judges,
        label: "Judges",
        title: "Judge profiles",
        emptyMessage: "No judge profiles matched your search.",
        selectColumns: "judge_id,first_name,last_name,school,email,phone,certification"
    },
    coaches: {
        accountType: "coach",
        idColumn: "coach_id",
        table: TABLES.coaches,
        label: "Coaches",
        title: "Coach profiles",
        emptyMessage: "No coach profiles matched your search.",
        selectColumns: "coach_id,first_name,last_name,school,email,phone,years_experience"
    }
};

const NETWORK_TABS = ["student", "judge", "coach"];

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

async function requireAuth() {
    if (!supabaseClient) {
        return false;
    }

    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
        window.location.replace("index.html");
        return false;
    }

    return true;
}

async function getAdminProfile(user) {
    if (!supabaseClient || !user) {
        return null;
    }

    const byAuthUser = await supabaseClient
        .from(TABLES.administrator)
        .select("admin_id,auth_user_id,first_name,last_name,school,email,role_title,phone")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (byAuthUser.data) {
        return byAuthUser.data;
    }

    if (!user.email) {
        return null;
    }

    const byEmail = await supabaseClient
        .from(TABLES.administrator)
        .select("admin_id,auth_user_id,first_name,last_name,school,email,role_title,phone")
        .eq("email", user.email)
        .maybeSingle();

    return byEmail.data || null;
}

async function isAdminUser(user) {
    const adminProfile = await getAdminProfile(user);
    return Boolean(adminProfile?.admin_id);
}

async function getDefaultPageForUser(user) {
    return (await isAdminUser(user)) ? "profiles.html" : "debates.html";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeText(value, maxLength = 255) {
    const trimmed = String(value ?? "").trim();
    const withoutControlChars = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
    return withoutControlChars.slice(0, maxLength);
}

function sanitizeEmail(value) {
    return sanitizeText(value, 254).toLowerCase();
}

function sanitizeSearchInput(value) {
    const raw = sanitizeText(value, 80);
    return raw.replace(/[^a-zA-Z0-9@._+%\-\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizePhone(value) {
    const raw = sanitizeText(value, 40);
    return raw.replace(/[^0-9+()\-\s.]/g, "").trim();
}

function sanitizeUuid(value) {
    const normalized = sanitizeText(value, 64);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)
        ? normalized
        : "";
}

function isValidEmail(value) {
    return /^[a-z0-9](?:[a-z0-9._+%-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(String(value || ""));
}

function toPositiveInt(value, fallback = null) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function setMessage(target, message, isError) {
    if (!target) {
        return;
    }

    target.textContent = message;
    target.style.color = isError ? "#a11" : "#165b33";
}

function updateSidebarNavigation(isAdmin) {
    document.querySelectorAll("[data-nav-admin-only]").forEach((item) => {
        item.hidden = !isAdmin;
    });
}

function normalizeRoleType(value) {
    const roleType = String(value || "").trim().toLowerCase();
    return NETWORK_TABS.includes(roleType) ? roleType : "student";
}

function setFormDisabled(formElement, disabled) {
    if (!formElement) {
        return;
    }

    formElement.querySelectorAll("input, select, textarea, button").forEach((control) => {
        if (control.type === "hidden") {
            return;
        }
        control.disabled = disabled;
    });
}

function navigateToProfileSettings(profileType, profileId) {
    try {
        sessionStorage.setItem("settingsTarget", JSON.stringify({ profileType, profileId }));
    } catch {}
    window.location.href = "settings.html";
}

function navigateToUserHistory(type, id, name) {
    try {
        sessionStorage.setItem("historyTarget", JSON.stringify({ type, id, name }));
    } catch {}
    window.location.href = "user-history.html";
}

function getSettingsQueryTarget() {
    try {
        const stored = sessionStorage.getItem("settingsTarget");
        if (stored) {
            sessionStorage.removeItem("settingsTarget");
            const parsed = JSON.parse(stored);
            const profileType = normalizeRoleType(String(parsed.profileType || ""));
            const profileId = String(parsed.profileId || "").trim();
            if (profileId) {
                return { profileType, profileId };
            }
        }
    } catch {}
    return null;
}

function formatRoleSpecificValue(roleType, profile) {
    if (roleType === "student") {
        return {
            label: "Graduation year",
            value: profile.graduation_year ? String(profile.graduation_year) : "Not set"
        };
    }

    if (roleType === "judge") {
        return {
            label: "Certification",
            value: profile.certification || "Not set"
        };
    }

    return {
        label: "Experience",
        value: Number.isFinite(profile.years_experience)
            ? `${profile.years_experience} years`
            : "Not set"
    };
}

function updateText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = value;
    }
}

function getInitials(fullName) {
    const letters = String(fullName || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");

    return letters || "DH";
}

function normalizeAccountType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return PROFILE_CONFIG[normalized] ? normalized : "student";
}

function getRoleLabel(accountType) {
    return ACCOUNT_TYPE_LABELS[normalizeAccountType(accountType)] || "Student";
}

function getDisplayName(profile, user) {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return fullName || profile?.email || user?.email || `${getRoleLabel(profile?.accountType || user?.user_metadata?.account_type)} Account`;
}

function withoutEmergencyContactColumn(selectColumns) {
    return String(selectColumns || "")
        .split(",")
        .map((column) => column.trim())
        .filter((column) => column && column !== "emergency_contact")
        .join(",");
}

async function runProfileSingleQuery(profileConfig, builder) {
    const primaryResponse = await builder(profileConfig.selectColumns);
    if (!primaryResponse?.error) {
        return primaryResponse;
    }

    const missingColumnError = String(primaryResponse.error?.message || "").toLowerCase();
    if (!missingColumnError.includes("emergency_contact") && !missingColumnError.includes("column")) {
        return primaryResponse;
    }

    const fallbackColumns = withoutEmergencyContactColumn(profileConfig.selectColumns);
    if (!fallbackColumns) {
        return primaryResponse;
    }

    const fallbackResponse = await builder(fallbackColumns);
    if (!fallbackResponse.error && fallbackResponse.data) {
        fallbackResponse.data = { ...fallbackResponse.data, emergency_contact: null };
    }
    return fallbackResponse;
}

async function getProfileByType(user, accountType) {
    if (!supabaseClient || !user) {
        return null;
    }

    const profileConfig = PROFILE_CONFIG[normalizeAccountType(accountType)];
    if (!profileConfig) {
        return null;
    }

    const byAuthUser = await runProfileSingleQuery(profileConfig, (columns) => {
        return supabaseClient
            .from(profileConfig.table)
            .select(columns)
            .eq("auth_user_id", user.id)
            .maybeSingle();
    });

    if (byAuthUser.error) {
        console.error(`[getProfileByType] Query by auth_user_id failed for ${accountType}:`, byAuthUser.error);
    }

    if (byAuthUser.data) {
        console.debug(`[getProfileByType] Found ${accountType} profile by auth_user_id:`, Object.keys(byAuthUser.data));
        return { ...byAuthUser.data, accountType: profileConfig.accountType };
    }

    if (!user.email) {
        return null;
    }

    const byEmail = await runProfileSingleQuery(profileConfig, (columns) => {
        return supabaseClient
            .from(profileConfig.table)
            .select(columns)
            .eq("email", user.email)
            .maybeSingle();
    });

    if (byEmail.error) {
        console.error(`[getProfileByType] Query by email failed for ${accountType}:`, byEmail.error);
    }

    if (byEmail.data) {
        console.debug(`[getProfileByType] Found ${accountType} profile by email:`, Object.keys(byEmail.data));
    }

    return byEmail.data ? { ...byEmail.data, accountType: profileConfig.accountType } : null;
}

async function getCurrentProfile(user) {
    const preferredType = normalizeAccountType(user?.user_metadata?.account_type);
    const lookupOrder = [
        preferredType,
        ...Object.keys(PROFILE_CONFIG).filter((accountType) => accountType !== preferredType)
    ];

    console.debug(`[getCurrentProfile] Looking up profile for user ${user?.email} (preferred type: ${preferredType})`);

    for (const accountType of lookupOrder) {
        const profile = await getProfileByType(user, accountType);
        if (profile) {
            console.debug(`[getCurrentProfile] Successfully found profile as ${accountType}`);
            return profile;
        }
    }

    console.warn(`[getCurrentProfile] No profile found for user ${user?.email} after checking all types`);
    return null;
}

async function getProfileByIdentifier(accountType, accountId) {
    if (!supabaseClient || !accountId) {
        return null;
    }

    const profileConfig = PROFILE_CONFIG[normalizeAccountType(accountType)];
    if (!profileConfig) {
        return null;
    }

    const response = await runProfileSingleQuery(profileConfig, (columns) => {
        return supabaseClient
            .from(profileConfig.table)
            .select(columns)
            .eq(profileConfig.idColumn, accountId)
            .maybeSingle();
    });

    if (response.error) {
        console.error(`[getProfileByIdentifier] Query failed for ${accountType}/${accountId}:`, response.error);
    }

    return response.data ? { ...response.data, accountType: profileConfig.accountType } : null;
}

async function getProfileByEmail(email) {
    if (!supabaseClient || !email) {
        return null;
    }

    for (const accountType of Object.keys(PROFILE_CONFIG)) {
        const profileConfig = PROFILE_CONFIG[accountType];
        const response = await runProfileSingleQuery(profileConfig, (columns) => {
            return supabaseClient
                .from(profileConfig.table)
                .select(columns)
                .eq("email", email)
                .maybeSingle();
        });

        if (response.error) {
            console.error(`[getProfileByEmail] Query failed for ${accountType}/${email}:`, response.error);
            continue;
        }

        if (response.data) {
            return { ...response.data, accountType: profileConfig.accountType };
        }
    }

    return null;
}

function setGraduationFieldVisibility(settingsForm, accountType) {
    const gradYearField = settingsForm?.querySelector('input[name="grad-year"]')?.closest(".field");
    if (gradYearField) {
        gradYearField.hidden = normalizeAccountType(accountType) !== "student";
    }
}

async function handleLoginForm() {
    const loginForm = document.querySelector("[data-login-form]");
    const messageEl = document.querySelector("[data-auth-message]");
    const headingEl = document.querySelector("[data-login-heading]");
    const subheadingEl = document.querySelector("[data-login-subheading]");
    const confirmField = document.querySelector("[data-confirm-field]");
    const accountTypeField = document.querySelector("[data-account-type-field]");
    const submitBtn = loginForm?.querySelector('button[type="submit"]');
    const authTabs = document.querySelectorAll("[data-auth-tab]");

    if (!loginForm) {
        return;
    }

    if (!supabaseClient) {
        setMessage(messageEl, "Account services are not available right now. Please try again later.", true);
        return;
    }

    const currentUser = await requireAuthenticatedUser();
    if (currentUser.user) {
        const nextPage = await getDefaultPageForUser(currentUser.user);
        window.location.href = nextPage;
        return;
    }

    // Clear stale local tokens so the page does not keep bouncing between routes.
    await supabaseClient.auth.signOut();

    let isSignUp = false;

    function setMode(signUp) {
        isSignUp = signUp;
        if (headingEl) {
            headingEl.textContent = signUp ? "Create an account" : "Welcome back";
        }
        if (subheadingEl) {
            subheadingEl.textContent = signUp
            ? "Enter your email and choose a password to join the team portal."
            : "Use your team credentials to continue to practice plans, pairings, and feedback.";
        }
        if (confirmField) {
            confirmField.hidden = !signUp;
            confirmField.setAttribute("aria-hidden", signUp ? "false" : "true");
            const confirmInput = confirmField.querySelector("input");
            if (confirmInput) {
                confirmInput.required = signUp;
                if (!signUp) {
                    confirmInput.value = "";
                }
            }
        }
        if (accountTypeField) {
            accountTypeField.hidden = !signUp;
            accountTypeField.setAttribute("aria-hidden", signUp ? "false" : "true");
            const accountTypeInput = accountTypeField.querySelector("select");
            if (accountTypeInput) {
                accountTypeInput.required = signUp;
                if (!accountTypeInput.value) {
                    accountTypeInput.value = "student";
                }
            }
        }
        const passwordInput = loginForm.querySelector('input[name="password"]');
        if (passwordInput) {
            passwordInput.autocomplete = signUp ? "new-password" : "current-password";
        }
        if (submitBtn) {
            submitBtn.textContent = signUp ? "Create account" : "Enter team portal";
        }
        authTabs.forEach((tab) => {
            const active = tab.getAttribute("data-auth-tab") === (signUp ? "signup" : "login");
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
        });
        setMessage(messageEl, "", false);
    }

    authTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            setMode(tab.getAttribute("data-auth-tab") === "signup");
        });
    });

    setMode(false);

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = sanitizeEmail(loginForm.querySelector('input[name="email"]')?.value || "");
        const password = loginForm.querySelector('input[name="password"]')?.value || "";

        if (!email || !password) {
            setMessage(messageEl, "Email and password are required.", true);
            return;
        }

        if (!isValidEmail(email)) {
            setMessage(messageEl, "Please enter a valid email address.", true);
            return;
        }

        if (password.length > 256) {
            setMessage(messageEl, "Password is too long.", true);
            return;
        }

        if (isSignUp) {
            const confirmPassword = loginForm.querySelector('input[name="confirm-password"]')?.value || "";
            const accountType = loginForm.querySelector('select[name="account-type"]')?.value || "student";
            if (password !== confirmPassword) {
                setMessage(messageEl, "Passwords do not match.", true);
                return;
            }

            if (password.length < 8) {
                setMessage(messageEl, "Password must be at least 8 characters.", true);
                return;
            }

            setMessage(messageEl, "Creating account...", false);
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        account_type: accountType
                    }
                }
            });
            if (error) {
                setMessage(messageEl, error.message, true);
                return;
            }
            if (data?.session) {
                setMessage(messageEl, "Account created. Redirecting...", false);
                const nextPage = await getDefaultPageForUser(data.user || data.session.user);
                window.location.href = nextPage;
                return;
            }
            setMessage(messageEl, "Account created. Sign in to continue.", false);
            setMode(false);
            return;
        }

        setMessage(messageEl, "Signing in...", false);
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage(messageEl, error.message, true);
            return;
        }
        setMessage(messageEl, "Signed in. Redirecting...", false);
        const signedInUser = await requireAuthenticatedUser();
        const nextPage = await getDefaultPageForUser(signedInUser.user);
        window.location.href = nextPage;
    });
}

function renderDirectoryCard(type, profile) {
    const article = document.createElement("article");
    article.className = "directory-card";

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed profile";
    const school = profile.school || "School not provided";
    const email = profile.email || "No email on file";
    const phone = profile.phone || "No phone on file";

    let metaLabel = "";
    let metaValue = "";

    if (type === "students") {
        metaLabel = "Graduation year";
        metaValue = profile.graduation_year ? String(profile.graduation_year) : "Not set";
    } else if (type === "judges") {
        metaLabel = "Certification";
        metaValue = profile.certification || "Not set";
    } else if (type === "coaches") {
        metaLabel = "Experience";
        metaValue = Number.isFinite(profile.years_experience)
            ? `${profile.years_experience} years`
            : "Not set";
    }

    article.innerHTML = `
        <div class="directory-card-header">
            <div>
                <h4 class="debate-title">${escapeHtml(fullName)}</h4>
                <p class="debate-meta">${escapeHtml(school)}</p>
            </div>
            <span class="tag tag--event">${escapeHtml(DIRECTORY_TABS[type].label)}</span>
        </div>
        <div class="directory-card-body">
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>${escapeHtml(metaLabel)}:</strong> ${escapeHtml(metaValue)}</p>
        </div>
        <button class="ghost-button profile-open-link" type="button">Open profile</button>
    `;

    const navAccountType = DIRECTORY_TABS[type].accountType;
    const navProfileId = profile[DIRECTORY_TABS[type].idColumn];
    article.querySelector(".profile-open-link")?.addEventListener("click", () => {
        navigateToProfileSettings(navAccountType, navProfileId);
    });

    return article;
}

function renderNetworkCard(profile, isAdminMode) {
    const roleType = normalizeRoleType(profile.account_type);
    const article = document.createElement("article");
    article.className = "directory-card";

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed profile";
    const school = profile.school || "School not provided";
    const roleValue = formatRoleSpecificValue(roleType, profile);
    const roleLabel = getRoleLabel(roleType);

    const details = [
        `<p><strong>School:</strong> ${escapeHtml(school)}</p>`,
        `<p><strong>${escapeHtml(roleValue.label)}:</strong> ${escapeHtml(roleValue.value)}</p>`
    ];

    if (isAdminMode) {
        details.push(`<p><strong>Email:</strong> ${escapeHtml(profile.email || "No email on file")}</p>`);
        details.push(`<p><strong>Phone:</strong> ${escapeHtml(profile.phone || "No phone on file")}</p>`);
    }

    const canViewHistory = isAdminMode && profile.can_view_history;
    const historyLinkHtml = canViewHistory
        ? `<button class="ghost-button profile-history-link" type="button">View debate history</button>`
        : `<button class="ghost-button profile-history-link" type="button" disabled aria-disabled="true" title="Only administrators can view debate history.">View debate history</button>`;

    article.innerHTML = `
        <div class="directory-card-header">
            <div>
                <h4 class="debate-title">${escapeHtml(fullName)}</h4>
                <p class="debate-meta">${escapeHtml(roleLabel)}</p>
            </div>
            <span class="tag tag--event">${escapeHtml(roleLabel)}</span>
        </div>
        <div class="directory-card-body">
            ${details.join("\n")}
        </div>
        ${historyLinkHtml}
    `;

    if (canViewHistory) {
        article.querySelector(".profile-history-link")?.addEventListener("click", () => {
            navigateToUserHistory(roleType, profile.account_id, fullName);
        });
    }

    return article;
}

function createHistoryCard(record) {
    const article = document.createElement("article");
    article.className = "past-card";

    const when = formatDateLabel(record.debate_date);
    const status = String(record.debate_status || "scheduled");
    const statusClass = status.toLowerCase() === "completed" ? "result-badge result-badge--win" : "result-badge result-badge--loss";

    article.innerHTML = `
        <div class="past-card-left">
            <span class="${statusClass}">${escapeHtml(status)}</span>
            <div>
                <h4 class="debate-title">${escapeHtml(record.topic || record.tournament_name || "Debate Round")}</h4>
                <p class="debate-meta">${escapeHtml(`${when} • ${record.debate_type || "Debate"} • ${record.round_name || "Round"}`)}</p>
                <p class="debate-meta">${escapeHtml(record.role_context || "No extra context available.")}</p>
                ${record.ruling_consistency_label ? `<p class="debate-meta"><strong>Consistency:</strong> ${escapeHtml(record.ruling_consistency_label)}${record.ruling_consistency_score != null ? ` (${Number(record.ruling_consistency_score).toFixed(3)})` : ''}</p>` : ''}
            </div>
        </div>
        <div class="past-card-right">
            <p class="debate-meta">${escapeHtml(record.room || "Room TBD")}</p>
        </div>
    `;

    return article;
}

async function loadDirectoryProfiles(type, searchText) {
    const directoryConfig = DIRECTORY_TABS[type];
    if (!directoryConfig || !supabaseClient) {
        return { data: [], error: new Error("Directory is unavailable.") };
    }

    const response = await supabaseClient
        .from(directoryConfig.table)
        .select(directoryConfig.selectColumns)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .limit(500);

    if (response.error) {
        return { data: [], error: response.error };
    }

    const trimmed = sanitizeSearchInput(searchText).toLowerCase();
    if (!trimmed) {
        return { data: response.data || [], error: null };
    }

    const filtered = (response.data || []).filter((profile) => {
        const haystack = [
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.school
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(trimmed);
    });

    return { data: filtered, error: null };
}

async function handleAdminDirectoryPage() {
    const pageRoot = document.querySelector("[data-admin-directory]");
    const tabList = document.querySelectorAll("[data-directory-tab]");
    const searchForm = document.querySelector("[data-directory-search-form]");
    const searchInput = document.querySelector("[data-directory-search-input]");
    const listRoot = document.querySelector("[data-directory-results]");
    const messageEl = document.querySelector("[data-directory-message]");
    const titleEl = document.querySelector("[data-directory-title]");
    const countEl = document.querySelector("[data-directory-count]");
    const adminNameEl = document.querySelector("[data-admin-name]");
    const adminRoleEl = document.querySelector("[data-admin-role]");
    const adminAvatarEl = document.querySelector("[data-admin-avatar]");

    if (!pageRoot || !listRoot) {
        return;
    }

    if (!(await requireAuth())) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        window.location.replace("index.html");
        return;
    }

    const adminProfile = await getAdminProfile(user);
    if (!adminProfile?.admin_id) {
        window.location.replace("debates.html");
        return;
    }

    updateSidebarNavigation(true);

    const adminName = getDisplayName({ ...adminProfile, accountType: "admin" }, user);
    if (adminNameEl) {
        adminNameEl.textContent = adminName;
    }
    if (adminRoleEl) {
        adminRoleEl.textContent = adminProfile.role_title || "Administrator";
    }
    if (adminAvatarEl) {
        adminAvatarEl.textContent = getInitials(adminName);
    }

    let activeType = "students";

    async function refreshResults() {
        const directoryConfig = DIRECTORY_TABS[activeType];
        const searchText = searchInput?.value || "";

        if (titleEl) {
            titleEl.textContent = directoryConfig.title;
        }
        setMessage(messageEl, "Loading profiles...", false);

        const { data, error: fetchError } = await loadDirectoryProfiles(activeType, searchText);
        if (fetchError) {
            listRoot.replaceChildren(createEmptyState("Unable to load profile data."));
            if (countEl) {
                countEl.textContent = "0";
            }
            setMessage(messageEl, fetchError.message, true);
            return;
        }

        if (!data.length) {
            listRoot.replaceChildren(createEmptyState(directoryConfig.emptyMessage));
        } else {
            listRoot.replaceChildren(...data.map((profile) => renderDirectoryCard(activeType, profile)));
        }

        if (countEl) {
            countEl.textContent = String(data.length);
        }
        setMessage(messageEl, `Showing ${data.length} ${directoryConfig.label.toLowerCase()} profiles.`, false);
    }

    tabList.forEach((tabButton) => {
        tabButton.addEventListener("click", async () => {
            const requestedType = tabButton.getAttribute("data-directory-tab");
            if (!DIRECTORY_TABS[requestedType] || requestedType === activeType) {
                return;
            }

            activeType = requestedType;
            tabList.forEach((tab) => {
                const isActive = tab.getAttribute("data-directory-tab") === activeType;
                tab.classList.toggle("is-active", isActive);
                tab.setAttribute("aria-selected", isActive ? "true" : "false");
            });

            await refreshResults();
        });
    });

    searchForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await refreshResults();
    });

    searchInput?.addEventListener("input", async () => {
        const raw = searchInput.value;
        const cleaned = raw.replace(/[^a-zA-Z0-9@._+%\-\s]/g, "");
        if (cleaned !== raw) {
            const cursorPos = searchInput.selectionStart - (raw.length - cleaned.length);
            searchInput.value = cleaned;
            searchInput.setSelectionRange(cursorPos, cursorPos);
        }
        await refreshResults();
    });

    await refreshResults();
}

function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return { firstName, lastName };
}

async function requireAuthenticatedUser() {
    if (!supabaseClient) {
        return { user: null, error: new Error("Account services are not available right now.") };
    }

    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
        return { user: null, error: error || new Error("No active session.") };
    }

    return { user: data.user, error: null };
}

async function getStudentProfile(user) {
    return getProfileByType(user, "student");
}

function updateSettingsHeader(profile, user) {
    const fullName = getDisplayName(profile, user);
    const accountType = normalizeAccountType(profile?.accountType || user?.user_metadata?.account_type);
    updateText("[data-settings-name]", fullName);
    updateText("[data-settings-copy]", `${profile?.school || "School not set"} • ${profile?.email || user?.email || "No email on file"} • ${getRoleLabel(accountType)}`);
}

function applySettingsPerspective(viewingOtherProfile) {
    const heroTitle = document.querySelector("[data-settings-hero-title]");
    const heroCopy = document.querySelector("[data-settings-hero-copy]");
    const roleCopy = document.querySelector("[data-settings-role-copy]");
    const notificationCopy = document.querySelector("[data-settings-notification-copy]");
    const securityCopy = document.querySelector("[data-settings-security-copy]");

    if (!viewingOtherProfile) {
        if (heroTitle) {
            heroTitle.textContent = "Manage your profile.";
        }
        if (heroCopy) {
            heroCopy.textContent = "Keep your event preferences, notifications, and team role current so coaches and captains can plan quickly.";
        }
        if (roleCopy) {
            roleCopy.textContent = "Set the formats and responsibilities tied to your account.";
        }
        if (notificationCopy) {
            notificationCopy.textContent = "Choose how you want tournament and practice updates delivered.";
        }
        if (securityCopy) {
            securityCopy.textContent = "Update your password and session protections.";
        }
        return;
    }

    if (heroTitle) {
        heroTitle.textContent = "Manage this profile.";
    }
    if (heroCopy) {
        heroCopy.textContent = "Keep this account's event preferences, notifications, and team role details current for staff visibility.";
    }
    if (roleCopy) {
        roleCopy.textContent = "Set the formats and responsibilities tied to this account.";
    }
    if (notificationCopy) {
        notificationCopy.textContent = "Notification preferences shown here are tied to this account.";
    }
    if (securityCopy) {
        securityCopy.textContent = "Password changes are not available while viewing another account.";
    }
}

function updateSettingsCompletion(profile, user, viewingOtherProfile = false) {
    const progressFill = document.querySelector("[data-settings-progress-fill]");
    const progressCopy = document.querySelector("[data-settings-progress-copy]");

    if (!progressFill || !progressCopy) {
        return;
    }

    const accountType = normalizeAccountType(profile?.accountType || user?.user_metadata?.account_type);
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    const fields = [
        { label: "full name", complete: Boolean(fullName) },
        { label: "email", complete: Boolean(profile?.email || user?.email) },
        { label: "school", complete: Boolean(profile?.school) },
        { label: "phone", complete: Boolean(profile?.phone) }
    ];

    if (accountType !== "admin") {
        fields.push({ label: "emergency contact", complete: Boolean(profile?.emergency_contact) });
    }

    if (accountType === "student") {
        fields.push({ label: "graduation year", complete: Number.isInteger(Number(profile?.graduation_year)) && Number(profile?.graduation_year) > 0 });
    }

    const completedCount = fields.filter((field) => field.complete).length;
    const totalCount = fields.length;
    const percentComplete = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
    const missingFields = fields.filter((field) => !field.complete).map((field) => field.label);
    const fieldNoun = totalCount === 1 ? "field" : "fields";

    progressFill.style.width = `${percentComplete}%`;

    if (!missingFields.length) {
        progressCopy.textContent = `All ${totalCount} required profile ${fieldNoun} are complete.`;
        return;
    }

    const possessiveLabel = viewingOtherProfile ? "this profile's" : "your";

    if (missingFields.length === 1) {
        progressCopy.textContent = `${completedCount} of ${totalCount} required profile ${fieldNoun} are complete. Add ${possessiveLabel} ${missingFields[0]}.`;
        return;
    }

    const finalField = missingFields[missingFields.length - 1];
    const leadingFields = missingFields.slice(0, -1).join(", ");
    progressCopy.textContent = `${completedCount} of ${totalCount} required profile ${fieldNoun} are complete. Add ${possessiveLabel} ${leadingFields} and ${finalField}.`;
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

    const fullNameInput = settingsForm.querySelector('input[name="full-name"]');
    const emailInput = settingsForm.querySelector('input[name="email"]');
    const schoolInput = settingsForm.querySelector('input[name="school"]');
    const phoneInput = settingsForm.querySelector('input[name="phone"]');
    const emergencyContactInput = settingsForm.querySelector('input[name="emergency-contact"]');
    const gradYearInput = settingsForm.querySelector('input[name="grad-year"]');
    const profile = await getCurrentProfile(user);
    const accountType = normalizeAccountType(profile?.accountType || user.user_metadata?.account_type);

    if (fullNameInput) {
        fullNameInput.value = "";
    }
    if (emailInput) {
        emailInput.value = user.email || "";
    }
    if (schoolInput) {
        schoolInput.value = "";
    }
    if (phoneInput) {
        phoneInput.value = "";
    }
    if (emergencyContactInput) {
        emergencyContactInput.value = "";
    }
    if (gradYearInput) {
        gradYearInput.value = "";
    }

    setGraduationFieldVisibility(settingsForm, accountType);

    if (!profile) {
        updateSettingsHeader({ email: user.email, accountType }, user);
        updateSettingsCompletion({ email: user.email, accountType }, user);
        return;
    }

    if (fullNameInput) {
        fullNameInput.value = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    }
    if (emailInput) {
        emailInput.value = profile.email || user.email || "";
    }
    if (schoolInput) {
        schoolInput.value = profile.school || "";
    }
    if (phoneInput) {
        phoneInput.value = profile.phone || "";
    }
    if (emergencyContactInput) {
        emergencyContactInput.value = profile.emergency_contact || "";
    }
    if (gradYearInput && accountType === "student" && profile.graduation_year) {
        gradYearInput.value = profile.graduation_year;
    }

    updateSettingsHeader(profile, user);
    updateSettingsCompletion(profile, user);
}

async function handleSettingsForm() {
    const settingsForm = document.querySelector("[data-settings-form]");
    const messageEl = document.querySelector("[data-settings-message]");
    const contextEl = document.querySelector("[data-settings-context]");
    const saveButton = document.querySelector("[data-settings-save-button]");
    const historyLink = document.querySelector("[data-settings-history-link]");
    const securitySection = document.querySelector("[data-settings-security-section]");

    if (!settingsForm) {
        return;
    }

    if (!(await requireAuth())) {
        return;
    }

    if (!supabaseClient) {
        setMessage(messageEl, "Account services are not available right now. Please try again later.", true);
        return;
    }

    const { user, error: userError } = await requireAuthenticatedUser();
    if (userError || !user) {
        window.location.replace("index.html");
        return;
    }

    const adminProfile = await getAdminProfile(user);
    const isAdminMode = Boolean(adminProfile?.admin_id);
    const target = getSettingsQueryTarget();

    updateSidebarNavigation(isAdminMode);
    applySettingsPerspective(Boolean(target && isAdminMode));

    if (target && !isAdminMode) {
        window.location.replace("settings.html");
        return;
    }

    if (target && isAdminMode) {
        const targetProfile = await getProfileByIdentifier(target.profileType, target.profileId);
        if (!targetProfile) {
            setMessage(messageEl, "The selected profile could not be loaded.", true);
            setFormDisabled(settingsForm, true);
            if (saveButton) {
                saveButton.hidden = true;
            }
            return;
        }

        const fullNameInput = settingsForm.querySelector('input[name="full-name"]');
        const emailInput = settingsForm.querySelector('input[name="email"]');
        const schoolInput = settingsForm.querySelector('input[name="school"]');
        const phoneInput = settingsForm.querySelector('input[name="phone"]');
        const emergencyContactInput = settingsForm.querySelector('input[name="emergency-contact"]');
        const gradYearInput = settingsForm.querySelector('input[name="grad-year"]');

        if (fullNameInput) {
            fullNameInput.value = [targetProfile.first_name, targetProfile.last_name].filter(Boolean).join(" ");
        }
        if (emailInput) {
            emailInput.value = targetProfile.email || "";
        }
        if (schoolInput) {
            schoolInput.value = targetProfile.school || "";
        }
        if (phoneInput) {
            phoneInput.value = targetProfile.phone || "";
        }
        if (emergencyContactInput) {
            emergencyContactInput.value = targetProfile.emergency_contact || "";
        }
        if (gradYearInput) {
            gradYearInput.value = targetProfile.graduation_year || "";
        }

        setGraduationFieldVisibility(settingsForm, targetProfile.accountType);
        updateSettingsHeader(targetProfile, user);
        updateSettingsCompletion(targetProfile, user, true);
        setFormDisabled(settingsForm, true);
        if (securitySection) {
            securitySection.hidden = true;
        }

        if (saveButton) {
            saveButton.hidden = true;
        }

        if (historyLink) {
            const displayName = [targetProfile.first_name, targetProfile.last_name].filter(Boolean).join(" ") || targetProfile.email || "User";
            historyLink.href = "#";
            historyLink.hidden = false;
            historyLink.addEventListener("click", (event) => {
                event.preventDefault();
                navigateToUserHistory(target.profileType, target.profileId, displayName);
            });
        }

        if (contextEl) {
            contextEl.textContent = "Viewing a selected user profile from the admin directory.";
        }

        setMessage(messageEl, "This profile is read-only in admin view mode.", false);
        return;
    }

    if (saveButton) {
        saveButton.hidden = false;
    }
    if (securitySection) {
        securitySection.hidden = false;
    }
    if (historyLink) {
        historyLink.hidden = true;
    }
    if (contextEl) {
        contextEl.textContent = "Editing your own profile information.";
    }

    await preloadSettingsForm();

    const settingsEmailInput = settingsForm.querySelector('input[name="email"]');
    settingsEmailInput?.addEventListener("input", () => {
        const raw = settingsEmailInput.value;
        const cleaned = raw.replace(/[^a-zA-Z0-9@._+%\-]/g, "");
        if (cleaned !== raw) {
            const cursorPos = settingsEmailInput.selectionStart - (raw.length - cleaned.length);
            settingsEmailInput.value = cleaned;
            settingsEmailInput.setSelectionRange(cursorPos, cursorPos);
        }
    });

    const settingsPhoneInput = settingsForm.querySelector('input[name="phone"]');
    settingsPhoneInput?.addEventListener("input", () => {
        const raw = settingsPhoneInput.value;
        const cleaned = raw.replace(/[^0-9+\-]/g, "");
        if (cleaned !== raw) {
            const cursorPos = settingsPhoneInput.selectionStart - (raw.length - cleaned.length);
            settingsPhoneInput.value = cleaned;
            settingsPhoneInput.setSelectionRange(cursorPos, cursorPos);
        }
    });

    const settingsEmergencyInput = settingsForm.querySelector('input[name="emergency-contact"]');
    settingsEmergencyInput?.addEventListener("input", () => {
        const raw = settingsEmergencyInput.value;
        const cleaned = raw.replace(/[^0-9+\-]/g, "");
        if (cleaned !== raw) {
            const cursorPos = settingsEmergencyInput.selectionStart - (raw.length - cleaned.length);
            settingsEmergencyInput.value = cleaned;
            settingsEmergencyInput.setSelectionRange(cursorPos, cursorPos);
        }
    });

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailField = settingsForm.querySelector('input[name="email"]');
        const fullName = sanitizeText(settingsForm.querySelector('input[name="full-name"]')?.value || "", 120);
        const email = sanitizeEmail(emailField?.value || "");
        const schoolValue = sanitizeText(settingsForm.querySelector('input[name="school"]')?.value || "", 120);
        const phoneValue = sanitizePhone(settingsForm.querySelector('input[name="phone"]')?.value || "");
        const emergencyContactValue = sanitizeText(settingsForm.querySelector('input[name="emergency-contact"]')?.value || "", 160);
        const school = schoolValue || null;
        const phone = phoneValue || null;
        const emergencyContact = emergencyContactValue || null;
        const gradYearRaw = settingsForm.querySelector('input[name="grad-year"]')?.value || "";
        const gradYear = gradYearRaw ? toPositiveInt(gradYearRaw, null) : null;
        const newPassword = settingsForm.querySelector('input[name="new-password"]')?.value || "";
        const confirmPassword = settingsForm.querySelector('input[name="confirm-password"]')?.value || "";
        const { firstName, lastName } = splitName(fullName);

        if (!email || !firstName) {
            setMessage(messageEl, "Full name and email are required.", true);
            return;
        }

        if (emailField) {
            emailField.value = email;
            if (!emailField.checkValidity()) {
                setMessage(messageEl, "Please enter a valid email address.", true);
                return;
            }
        }

        if (!isValidEmail(email)) {
            setMessage(messageEl, "Please enter a valid email address.", true);
            return;
        }

        if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
            setMessage(messageEl, "New password and confirmation must match.", true);
            return;
        }

        if (newPassword && newPassword.length < 8) {
            setMessage(messageEl, "New password must be at least 8 characters.", true);
            return;
        }

        if (newPassword.length > 256) {
            setMessage(messageEl, "New password is too long.", true);
            return;
        }

        const { user, error: userError } = await requireAuthenticatedUser();
        if (userError || !user) {
            setMessage(messageEl, "Please sign in again before saving profile changes.", true);
            return;
        }

        const existingProfile = await getCurrentProfile(user);
        const accountType = normalizeAccountType(existingProfile?.accountType || user.user_metadata?.account_type);
        const profileConfig = PROFILE_CONFIG[accountType];
        const existingProfileId = existingProfile?.[profileConfig.idColumn] || null;
        const currentAuthEmail = sanitizeEmail(user.email || "");
        const authEmailChanged = Boolean(email) && email !== currentAuthEmail;

        setMessage(messageEl, "Saving profile...", false);

        const matchingProfile = await getProfileByEmail(email);
        if (matchingProfile) {
            const matchingConfig = PROFILE_CONFIG[normalizeAccountType(matchingProfile.accountType)];
            const matchingProfileId = matchingProfile?.[matchingConfig.idColumn] || null;
            const isSameProfile = Boolean(existingProfileId) && matchingProfileId === existingProfileId;
            const isSameAuthUser = Boolean(matchingProfile.auth_user_id) && matchingProfile.auth_user_id === user.id;

            if (!isSameProfile && !isSameAuthUser) {
                setMessage(messageEl, "That email address is already linked to another account.", true);
                return;
            }
        }

        if (authEmailChanged) {
            const emailUpdate = await supabaseClient.auth.updateUser({ email });
            if (emailUpdate.error) {
                setMessage(messageEl, `Email update failed: ${emailUpdate.error.message}`, true);
                return;
            }
        }

        const payload = {
            auth_user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            email,
            school,
            phone,
        };

        if (accountType !== "admin") {
            payload.emergency_contact = emergencyContact;
        }

        if (accountType === "student") {
            payload.graduation_year = Number.isFinite(gradYear) ? gradYear : null;
        }

        const profileMutation = existingProfileId
            ? supabaseClient
                .from(profileConfig.table)
                .update(payload)
                .eq(profileConfig.idColumn, existingProfileId)
            : supabaseClient
                .from(profileConfig.table)
                .upsert(payload, { onConflict: "email" });

        const { error } = await profileMutation;

        if (error) {
            setMessage(messageEl, error.message, true);
            return;
        }

        if (newPassword) {
            const passwordUpdate = await supabaseClient.auth.updateUser({ password: newPassword });
            if (passwordUpdate.error) {
                setMessage(messageEl, `Profile saved, but password update failed: ${passwordUpdate.error.message}`, true);
                return;
            }
        }

        setMessage(messageEl, "Profile saved.", false);
        setGraduationFieldVisibility(settingsForm, accountType);
        updateSettingsHeader({ ...existingProfile, ...payload, accountType }, user);
        updateSettingsCompletion({ ...existingProfile, ...payload, accountType }, user);
    });
}

async function handleProfileNetworkSection() {
    const section = document.querySelector("[data-network-section]");
    const tabButtons = document.querySelectorAll("[data-network-tab]");
    const searchForm = document.querySelector("[data-network-search-form]");
    const searchInput = document.querySelector("[data-network-search-input]");
    const resultsRoot = document.querySelector("[data-network-results]");
    const messageEl = document.querySelector("[data-network-message]");
    const titleEl = document.querySelector("[data-network-title]");
    const copyEl = document.querySelector("[data-network-copy]");

    if (!section || !resultsRoot) {
        return;
    }

    if (!(await requireAuth()) || !supabaseClient) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        return;
    }

    const adminProfile = await getAdminProfile(user);
    const isAdminMode = Boolean(adminProfile?.admin_id);
    const currentProfile = await getCurrentProfile(user);
    const currentRoleType = normalizeRoleType(currentProfile?.accountType);
    const currentAccountId = currentProfile?.[PROFILE_CONFIG[currentRoleType]?.idColumn] || null;

    if (titleEl) {
        titleEl.textContent = isAdminMode ? "Team account directory" : "Connected profiles";
    }

    if (copyEl) {
        copyEl.textContent = isAdminMode
            ? "As an administrator, you can review account details and open each user's debate history."
            : "You can only see low-sensitivity profile details for users in your active shared debates. Completed debates remove access.";
    }

    let activeTab = "student";
    let cachedProfiles = [];

    function applyFilters() {
        const searchText = sanitizeSearchInput(searchInput?.value || "").toLowerCase();
        const filtered = cachedProfiles.filter((profile) => {
            if (normalizeRoleType(profile.account_type) !== activeTab) {
                return false;
            }

            if (!searchText) {
                return true;
            }

            const searchBlob = [
                profile.first_name,
                profile.last_name,
                profile.school,
                profile.email
            ].filter(Boolean).join(" ").toLowerCase();

            return searchBlob.includes(searchText);
        });

        if (!filtered.length) {
            const emptyMessage = isAdminMode
                ? "No profiles matched this filter."
                : "No connected profiles are available for this tab right now.";
            resultsRoot.replaceChildren(createEmptyState(emptyMessage));
        } else {
            resultsRoot.replaceChildren(...filtered.map((profile) => renderNetworkCard(profile, isAdminMode)));
        }

        setMessage(messageEl, `Showing ${filtered.length} ${getRoleLabel(activeTab).toLowerCase()} profile(s).`, false);
    }

    async function loadProfiles() {
        setMessage(messageEl, "Loading connected profiles...", false);
        const response = await supabaseClient.rpc("get_visible_profiles_for_user");

        if (response.error) {
            resultsRoot.replaceChildren(createEmptyState("Could not load profile visibility data."));
            setMessage(messageEl, response.error.message, true);
            return;
        }

        cachedProfiles = (response.data || []);
        if (!isAdminMode) {
            cachedProfiles = cachedProfiles.filter((profile) => {
                const sameType = normalizeRoleType(profile.account_type) === currentRoleType;
                const sameId = String(profile.account_id || "") === String(currentAccountId || "");
                return !(sameType && sameId);
            });
        }

        applyFilters();
    }

    tabButtons.forEach((tab) => {
        tab.addEventListener("click", () => {
            const requested = normalizeRoleType(tab.getAttribute("data-network-tab"));
            if (requested === activeTab) {
                return;
            }

            activeTab = requested;
            tabButtons.forEach((button) => {
                const isActive = normalizeRoleType(button.getAttribute("data-network-tab")) === activeTab;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-selected", isActive ? "true" : "false");
            });

            applyFilters();
        });
    });

    searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        applyFilters();
    });

    searchInput?.addEventListener("input", applyFilters);

    await loadProfiles();
}

async function handleUserHistoryPage() {
    const pageRoot = document.querySelector("[data-user-history]");
    const resultsRoot = document.querySelector("[data-history-results]");
    const messageEl = document.querySelector("[data-history-message]");
    const titleEl = document.querySelector("[data-history-title]");
    const copyEl = document.querySelector("[data-history-copy]");
    const kickerEl = document.querySelector("[data-history-kicker]");
    const biasPanelEl = document.querySelector("[data-judge-bias-panel]");
    const backLinkEl = document.querySelector("[data-back-link]");
    const pageBackButton = document.querySelector("[data-back-button]");
    const sidebarTitleEl = document.querySelector("[data-sidebar-title]");
    const sidebarBodyEl = document.querySelector("[data-sidebar-body]");
    if (!pageRoot || !resultsRoot) {
        return;
    }

    if (!(await requireAuth()) || !supabaseClient) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        window.location.replace("index.html");
        return;
    }

    const adminProfile = await getAdminProfile(user);
    const isAdmin = Boolean(adminProfile?.admin_id);

    updateSidebarNavigation(isAdmin);

    let paramType = "student";
    let paramId = "";
    let paramName = "User";
    try {
        const stored = sessionStorage.getItem("historyTarget");
        if (stored) {
            sessionStorage.removeItem("historyTarget");
            const parsed = JSON.parse(stored);
            paramType = normalizeRoleType(String(parsed.type || ""));
            paramId = sanitizeUuid(String(parsed.id || ""));
            paramName = sanitizeText(String(parsed.name || "User"), 120);
        }
    } catch {}

    let targetType, targetId, targetName, isSelfView;
    let isAdminManagedHistory = false;

    if (paramId && !isAdmin) {
        window.location.replace("user-history.html");
        return;
    }

    if (paramId && isAdmin) {
        targetType = paramType;
        targetId = paramId;
        targetName = paramName;
        isSelfView = false;
    } else {
        isSelfView = true;
        const ownProfile = await getCurrentProfile(user);

        if (!ownProfile) {
            resultsRoot.replaceChildren(createEmptyState("Your profile could not be found. Make sure your account setup is complete."));
            setMessage(messageEl, "No profile is linked to this account.", true);
            return;
        }

        const ownAccountType = normalizeAccountType(ownProfile.accountType);
        const ownConfig = PROFILE_CONFIG[ownAccountType];

        if (ownAccountType === "admin") {
            isAdminManagedHistory = true;
            targetType = "admin";
            targetId = sanitizeUuid(ownProfile.admin_id || "");
            targetName = getDisplayName(ownProfile, user);
        } else {
            targetType = normalizeRoleType(ownAccountType);
            targetId = sanitizeUuid(ownProfile[ownConfig.idColumn] || "");
            targetName = getDisplayName(ownProfile, user);
        }
    }

    if (!targetId) {
        console.error(`[handleUserHistoryPage] Failed to extract ID. Profile: ${JSON.stringify(ownProfile)}, Config ID column: ${ownConfig.idColumn}`);
        resultsRoot.replaceChildren(createEmptyState("Account details could not be determined."));
        setMessage(messageEl, "Could not resolve profile identifier.", true);
        return;
    }

    if (kickerEl) {
        kickerEl.textContent = isSelfView ? "My History" : "Administrator";
    }

    if (titleEl) {
        titleEl.textContent = isSelfView
            ? (isAdminManagedHistory ? "My managed debate history" : "My debate history")
            : `${targetName}'s debate history`;
    }

    if (copyEl) {
        if (isSelfView && isAdminManagedHistory) {
            copyEl.textContent = "All past debates you created or managed.";
        } else {
            const roleLabel = getRoleLabel(targetType).toLowerCase();
            copyEl.textContent = isSelfView
                ? `All debates linked to your ${roleLabel} account.`
                : `All recorded debates for this ${roleLabel} account.`;
        }
    }

    if (sidebarTitleEl) {
        sidebarTitleEl.textContent = isSelfView ? "Debate history" : "Admin tools";
    }

    if (sidebarBodyEl) {
        if (isSelfView && isAdminManagedHistory) {
            sidebarBodyEl.textContent = "Past debates you created or managed across tournaments.";
        } else {
            sidebarBodyEl.textContent = isSelfView
                ? "Your complete debate record — all rounds from every tournament."
                : "Reviewing the full debate history tied to this account.";
        }
    }

    if (backLinkEl) {
        if (isSelfView) {
            backLinkEl.href = "debates.html";
            backLinkEl.textContent = "Back to my debates";
        } else {
            backLinkEl.href = "#";
            backLinkEl.textContent = "Back to profile";
            backLinkEl.addEventListener("click", (event) => {
                event.preventDefault();
                navigateToProfileSettings(targetType, targetId);
            });
        }
    }

    if (pageBackButton) {
        if (isSelfView) {
            pageBackButton.removeAttribute("data-back-profile-type");
            pageBackButton.removeAttribute("data-back-profile-id");
            pageBackButton.setAttribute("data-back-fallback", "debates.html");
        } else {
            pageBackButton.setAttribute("data-back-profile-type", targetType);
            pageBackButton.setAttribute("data-back-profile-id", targetId);
            pageBackButton.setAttribute("data-back-fallback", "settings.html");
        }
    }

    setMessage(messageEl, "Loading debate history...", false);

    if (isSelfView && isAdminManagedHistory) {
        const managedResult = await getManagedDebatesForAdmin(targetId);
        if (managedResult.error) {
            resultsRoot.replaceChildren(createEmptyState("Debate history could not be loaded."));
            setMessage(messageEl, managedResult.error.message, true);
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const pastManaged = (managedResult.records || [])
            .filter((record) => {
                const status = String(record.status || "").toLowerCase();
                return record.debateDate < today || status === "completed" || status === "finished";
            })
            .reverse()
            .map(mapManagedDebateToHistoryRecord);

        if (!pastManaged.length) {
            resultsRoot.replaceChildren(createEmptyState("No past managed debates are recorded yet."));
            setMessage(messageEl, "No managed debate history records were found.", false);
        } else {
            resultsRoot.replaceChildren(...pastManaged.map(createHistoryCard));
            setMessage(messageEl, `Loaded ${pastManaged.length} managed debate history record(s).`, false);
        }
        return;
    }

    const response = await supabaseClient.rpc("get_user_debate_history", {
        target_account_type: targetType,
        target_account_id: targetId
    });

    if (response.error) {
        resultsRoot.replaceChildren(createEmptyState("Debate history could not be loaded."));
        setMessage(messageEl, response.error.message, true);
        return;
    }

    const records = response.data || [];

    if (!records.length) {
        resultsRoot.replaceChildren(createEmptyState("No debates are recorded for this account yet."));
        setMessage(messageEl, "No debate history records were found.", false);
    } else {
        resultsRoot.replaceChildren(...records.map(createHistoryCard));
        setMessage(messageEl, `Loaded ${records.length} debate history record(s).`, false);
    }

    if (!isSelfView && isAdmin && targetType === "judge" && biasPanelEl) {
        biasPanelEl.hidden = false;

        const biasResponse = await supabaseClient.rpc("get_judge_bias_stats", {
            target_judge_id: targetId
        });

        if (!biasResponse.error && biasResponse.data?.length) {
            renderJudgeBiasPanel(biasPanelEl, biasResponse.data[0]);
        } else {
            const labelEl = biasPanelEl.querySelector("[data-bias-label]");
            if (labelEl) {
                labelEl.textContent = "Bias data is currently unavailable.";
            }
        }
    }
}

function renderJudgeBiasPanel(panelEl, stats) {
    const { decided_count, affirmative_wins, negative_wins, affirmative_pct, consistency_avg, consistency_sd, consistency_label, lean_label } = stats;
    const negPct = decided_count > 0
        ? (100 - Number(affirmative_pct)).toFixed(1)
        : "0.0";

    const set = (selector, value) => {
        const el = panelEl.querySelector(selector);
        if (el) {
            el.textContent = value;
        }
    };

    set("[data-bias-decided]", decided_count);
    set("[data-bias-aff-count]", affirmative_wins);
    set("[data-bias-neg-count]", negative_wins);
    set("[data-bias-aff-pct]", `${affirmative_pct}%`);
    set("[data-bias-neg-pct]", `${negPct}%`);
    set("[data-bias-consistency-avg]", Number(consistency_avg || 0).toFixed(2));
    set("[data-bias-consistency-sd]", Number(consistency_sd || 0).toFixed(2));
    set("[data-bias-consistency-label]", consistency_label || "–");
    set("[data-bias-label]", lean_label);

    const affBar = panelEl.querySelector("[data-bias-bar-aff]");
    const negBar = panelEl.querySelector("[data-bias-bar-neg]");
    if (affBar) { affBar.style.width = `${affirmative_pct}%`; }
    if (negBar) { negBar.style.width = `${negPct}%`; }

    const indicatorEl = panelEl.querySelector("[data-bias-indicator]");
    if (indicatorEl) {
        const pct = Number(affirmative_pct);
        const lean = decided_count === 0 ? "neutral"
            : pct >= 55 ? "aff"
            : pct <= 45 ? "neg"
            : "neutral";
        indicatorEl.className = `bias-lean-dot bias-lean-dot--${lean}`;
    }
}

function formatDateLabel(isoDate) {
    if (!isoDate) {
        return "TBD";
    }

    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLabel(timeValue, scheduledStart) {
    if (scheduledStart) {
        return new Date(scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    if (!timeValue) {
        return "TBD";
    }

    const [hourText = "0", minuteText = "00"] = timeValue.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function createEmptyState(message) {
    const element = document.createElement("div");
    element.className = "empty-state";
    element.textContent = message;
    return element;
}

function getWinnerFromRuling(ruling) {
    const match = String(ruling || "").match(/Team\s+(\d+)/i);
    return match ? Number(match[1]) : null;
}

function getBallotSummary(record) {
    return (record.judging || []).reduce((summary, entry) => {
        const winner = getWinnerFromRuling(entry.ruling);
        if (!winner) {
            return summary;
        }

        if (winner === record.teamNumber) {
            summary.teamWins += 1;
        } else {
            summary.opponentWins += 1;
        }

        return summary;
    }, { teamWins: 0, opponentWins: 0 });
}

function getResultLabel(record) {
    const ballotSummary = getBallotSummary(record);
    if (ballotSummary.teamWins > ballotSummary.opponentWins) {
        return { label: "Win", className: "result-badge result-badge--win" };
    }

    if (ballotSummary.opponentWins > ballotSummary.teamWins) {
        return { label: "Loss", className: "result-badge result-badge--loss" };
    }

    return { label: "Done", className: "result-badge result-badge--loss" };
}

function normalizeParticipationRecord(row) {
    const debate = row.debate || {};
    const tournament = debate.tournament || {};
    const round = debate.tournament_round || {};

    return {
        participationId: row.s_participation_id,
        teamNumber: row.team_number,
        debateStance: row.debate_stance,
        speakingOrder: row.speaking_order,
        isCaptain: row.is_captain,
        debateId: debate.debate_id,
        debateDate: debate.debate_date,
        debateTime: debate.debate_time,
        topic: debate.topic,
        room: debate.room,
        status: debate.status,
        teamAName: debate.team_a_name,
        teamBName: debate.team_b_name,
        tournamentName: tournament.name,
        hostSchool: tournament.host_school,
        location: tournament.location,
        roundName: round.round_name,
        roundNumber: round.round_number,
        debateType: round.debate_type,
        scheduledStart: round.scheduled_start,
        judging: Array.isArray(debate.j_participation) ? debate.j_participation : [],
        coaching: Array.isArray(debate.c_participation) ? debate.c_participation : []
    };
}

function createUpcomingCard(record) {
    const article = document.createElement("article");
    article.className = "debate-card debate-card--upcoming";

    const eventName = record.debateType || "Debate";
    const status = record.status || "Scheduled";
    const when = formatDateLabel(record.debateDate);
    const location = [record.hostSchool, record.location].filter(Boolean).join(" • ") || record.room || "Location TBD";
    const roundLabel = record.roundName || (record.roundNumber ? `Round ${record.roundNumber}` : "Round TBD");
    const coachNote = record.coaching[0]?.notes || "No coach note posted yet.";

    article.innerHTML = `
        <div class="debate-card-head">
            <div>
                <span class="tag tag--event">${escapeHtml(eventName)}</span>
                <span class="tag tag--upcoming">${escapeHtml(status)}</span>
            </div>
            <time class="debate-date">${escapeHtml(when)}</time>
        </div>
        <h4 class="debate-title">${escapeHtml(record.tournamentName || `${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</h4>
        <p class="debate-meta">${escapeHtml(location)}</p>
        <div class="debate-details">
            <div class="debate-detail">
                <span class="detail-label">Matchup</span>
                <span class="detail-value">${escapeHtml(`${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</span>
            </div>
            <div class="debate-detail">
                <span class="detail-label">Round</span>
                <span class="detail-value">${escapeHtml(roundLabel)}</span>
            </div>
            <div class="debate-detail">
                <span class="detail-label">Draw</span>
                <span class="detail-value">${escapeHtml(record.debateStance || "TBD")}</span>
            </div>
            <div class="debate-detail">
                <span class="detail-label">Start</span>
                <span class="detail-value">${escapeHtml(formatTimeLabel(record.debateTime, record.scheduledStart))}</span>
            </div>
        </div>
        <p class="debate-meta">${escapeHtml(coachNote)}</p>
        <div class="debate-card-foot">
            <a class="primary-button debate-button" href="#">View prep materials</a>
            <a class="ghost-button debate-button" href="#">Tournament info</a>
        </div>
    `;

    return article;
}

function createPastCard(record) {
    const article = document.createElement("article");
    article.className = "past-card";

    const result = getResultLabel(record);
    const when = formatDateLabel(record.debateDate);
    const ballotSummary = getBallotSummary(record);
    const feedbackSnippet = record.judging.find((entry) => entry.feedback)?.feedback || "No judge feedback posted yet.";

    article.innerHTML = `
        <div class="past-card-left">
            <span class="${result.className}">${escapeHtml(result.label)}</span>
            <div>
                <h4 class="debate-title">${escapeHtml(record.topic || record.tournamentName || "Debate Round")}</h4>
                <p class="debate-meta">${escapeHtml(`${when} • ${record.debateType || "Debate"} • ${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</p>
                <p class="debate-meta">${escapeHtml(feedbackSnippet)}</p>
            </div>
        </div>
        <div class="past-card-right">
            <div class="score-display">
                <span class="score-big">${ballotSummary.teamWins}</span>
                <span class="score-sep">&ndash;</span>
                <span class="score-big score-opp">${ballotSummary.opponentWins}</span>
            </div>
            <div class="past-card-actions">
                <a class="ghost-button" href="#">View ballots</a>
            </div>
        </div>
    `;

    return article;
}

function normalizeAdminDebateRecord(row) {
    const tournament = row.tournament || {};
    const round = row.tournament_round || {};

    return {
        debateId: row.debate_id,
        debateDate: row.debate_date,
        debateTime: row.debate_time,
        topic: row.topic,
        room: row.room,
        status: row.status,
        teamAName: row.team_a_name,
        teamBName: row.team_b_name,
        tournamentName: tournament.name,
        hostSchool: tournament.host_school,
        location: tournament.location,
        roundName: round.round_name,
        roundNumber: round.round_number,
        debateType: round.debate_type,
        scheduledStart: round.scheduled_start
    };
}

function mapManagedDebateToHistoryRecord(record) {
    return {
        debate_id: record.debateId,
        debate_date: record.debateDate,
        debate_status: record.status || "scheduled",
        tournament_name: record.tournamentName || "Managed debate",
        round_name: record.roundName || (record.roundNumber ? `Round ${record.roundNumber}` : "Round TBD"),
        debate_type: record.debateType || "Debate",
        room: record.room || "TBD",
        topic: record.topic || `${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`,
        role_context: "Managed by administrator"
    };
}

async function getManagedDebatesForAdmin(adminId) {
    if (!adminId) {
        return { records: [], error: null };
    }

    const createdDebatesResponse = await supabaseClient
        .from(TABLES.debate)
        .select(`
            debate_id,
            debate_date,
            debate_time,
            topic,
            room,
            status,
            team_a_name,
            team_b_name,
            tournament!left(
                tournament_id,
                name,
                host_school,
                location,
                created_by_admin_id
            ),
            tournament_round!left(
                round_number,
                round_name,
                debate_type,
                scheduled_start
            )
        `)
        .eq("tournament.created_by_admin_id", adminId)
        .order("debate_date", { ascending: true })
        .order("debate_time", { ascending: true, nullsFirst: false });

    if (createdDebatesResponse.error) {
        return { records: [], error: createdDebatesResponse.error };
    }

    const adminLogResponse = await supabaseClient
        .from("admin_change_log")
        .select("target_record_id")
        .eq("admin_id", adminId)
        .eq("target_table", "debate");

    let managedDebates = createdDebatesResponse.data || [];

    if (!adminLogResponse.error) {
        const managedDebateIds = Array.from(new Set((adminLogResponse.data || [])
            .map((row) => sanitizeUuid(row.target_record_id || ""))
            .filter(Boolean)));

        if (managedDebateIds.length) {
            const touchedDebatesResponse = await supabaseClient
                .from(TABLES.debate)
                .select(`
                    debate_id,
                    debate_date,
                    debate_time,
                    topic,
                    room,
                    status,
                    team_a_name,
                    team_b_name,
                    tournament!left(
                        tournament_id,
                        name,
                        host_school,
                        location,
                        created_by_admin_id
                    ),
                    tournament_round!left(
                        round_number,
                        round_name,
                        debate_type,
                        scheduled_start
                    )
                `)
                .in("debate_id", managedDebateIds)
                .order("debate_date", { ascending: true })
                .order("debate_time", { ascending: true, nullsFirst: false });

            if (!touchedDebatesResponse.error) {
                managedDebates = [...managedDebates, ...(touchedDebatesResponse.data || [])];
            }
        }
    }

    const records = Array.from(
        new Map(managedDebates.map((row) => [row.debate_id, row])).values()
    ).map(normalizeAdminDebateRecord);

    return { records, error: null };
}

function createAdminUpcomingCard(record) {
    const article = document.createElement("article");
    article.className = "debate-card debate-card--upcoming";

    const eventName = record.debateType || "Debate";
    const status = record.status || "Scheduled";
    const when = formatDateLabel(record.debateDate);
    const location = [record.hostSchool, record.location].filter(Boolean).join(" • ") || record.room || "Location TBD";
    const roundLabel = record.roundName || (record.roundNumber ? `Round ${record.roundNumber}` : "Round TBD");

    article.innerHTML = `
        <div class="debate-card-head">
            <div>
                <span class="tag tag--event">${escapeHtml(eventName)}</span>
                <span class="tag tag--upcoming">${escapeHtml(status)}</span>
            </div>
            <time class="debate-date">${escapeHtml(when)}</time>
        </div>
        <h4 class="debate-title">${escapeHtml(record.tournamentName || `${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</h4>
        <p class="debate-meta">${escapeHtml(location)}</p>
        <div class="debate-details">
            <div class="debate-detail">
                <span class="detail-label">Matchup</span>
                <span class="detail-value">${escapeHtml(`${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</span>
            </div>
            <div class="debate-detail">
                <span class="detail-label">Round</span>
                <span class="detail-value">${escapeHtml(roundLabel)}</span>
            </div>
            <div class="debate-detail">
                <span class="detail-label">Start</span>
                <span class="detail-value">${escapeHtml(formatTimeLabel(record.debateTime, record.scheduledStart))}</span>
            </div>
        </div>
        <div class="debate-card-foot">
            <button class="primary-button debate-button" type="button" data-admin-edit-debate>Edit debate</button>
            <a class="ghost-button debate-button" href="#">View details</a>
        </div>
    `;

    const editButton = article.querySelector("[data-admin-edit-debate]");
    editButton?.addEventListener("click", async () => {
        const nextTopic = prompt("Update topic", record.topic || "") ?? null;
        if (nextTopic === null) {
            return;
        }

        const nextRoom = prompt("Update room", record.room || "") ?? null;
        if (nextRoom === null) {
            return;
        }

        const statusInput = prompt("Update status (scheduled, in_progress, or delayed)", (record.status || "scheduled")) ?? null;
        if (statusInput === null) {
            return;
        }

        const nextStatus = sanitizeText(statusInput, 32).toLowerCase();
        if (!["scheduled", "in_progress", "delayed"].includes(nextStatus)) {
            alert("Status must be one of: scheduled, in_progress, delayed.");
            return;
        }

        const updateResponse = await supabaseClient
            .from(TABLES.debate)
            .update({
                topic: sanitizeText(nextTopic, 500) || null,
                room: sanitizeText(nextRoom, 50) || null,
                status: nextStatus
            })
            .eq("debate_id", record.debateId);

        if (updateResponse.error) {
            alert(`Could not update debate: ${updateResponse.error.message}`);
            return;
        }

        window.location.reload();
    });

    return article;
}

function createAdminPastCard(record) {
    const article = document.createElement("article");
    article.className = "past-card";

    const when = formatDateLabel(record.debateDate);
    const roundText = record.roundName || (record.roundNumber ? `Round ${record.roundNumber}` : "Round TBD");
    const statusText = (record.status || "completed").toLowerCase();
    const readOnlyStatus = statusText === "completed" || statusText === "finished" ? "Completed" : "Read-only";

    article.innerHTML = `
        <div class="past-card-left">
            <span class="result-badge result-badge--loss">${escapeHtml(readOnlyStatus)}</span>
            <div>
                <h4 class="debate-title">${escapeHtml(record.topic || record.tournamentName || "Debate Round")}</h4>
                <p class="debate-meta">${escapeHtml(`${when} • ${record.debateType || "Debate"} • ${roundText}`)}</p>
                <p class="debate-meta">${escapeHtml(`${record.teamAName || "Team A"} vs ${record.teamBName || "Team B"}`)}</p>
            </div>
        </div>
        <div class="past-card-right">
            <div class="past-card-actions">
                <span class="ghost-button" aria-disabled="true">Past debates are read-only</span>
            </div>
        </div>
    `;

    return article;
}

function updateDebatesSidebar(profile, records) {
    const fullName = getDisplayName(profile);
    const accountType = normalizeAccountType(profile?.accountType);
    const debateType = records.find((record) => record.debateType)?.debateType || "Debate";
    const isCaptain = records.some((record) => record.isCaptain);
    const completedRecords = records.filter((record) => String(record.status || "").toLowerCase() === "completed");
    const wins = completedRecords.filter((record) => getResultLabel(record).label === "Win").length;
    const losses = completedRecords.filter((record) => getResultLabel(record).label === "Loss").length;
    const roleLabel = accountType === "student"
        ? `${isCaptain ? "Captain" : "Member"} — ${debateType}`
        : `${getRoleLabel(accountType)} account`;

    updateText("[data-user-avatar]", getInitials(fullName));
    updateText("[data-user-name]", fullName);
    updateText("[data-user-role]", roleLabel);
    updateText("[data-rounds-count]", String(records.length));
    updateText("[data-wins-count]", `${accountType === "student" ? wins : 0}W`);
    updateText("[data-losses-count]", `${accountType === "student" ? losses : 0}L`);
}

async function handleDebatesPage() {
    const upcomingList = document.querySelector("[data-upcoming-list]");
    const upcomingCount = document.querySelector("[data-upcoming-count]");
    const messageEl = document.querySelector("[data-debates-message]");
    const kickerEl = document.querySelector("[data-debates-kicker]");
    const titleEl = document.querySelector("[data-debates-title]");
    const copyEl = document.querySelector("[data-debates-copy]");

    if (!upcomingList) {
        return;
    }

    if (!(await requireAuth())) {
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

    const adminProfile = await getAdminProfile(user);
    const viewerIsAdmin = Boolean(adminProfile?.admin_id);
    updateSidebarNavigation(viewerIsAdmin);

    if (viewerIsAdmin) {
        if (kickerEl) {
            kickerEl.textContent = "Administrator";
        }
        if (titleEl) {
            titleEl.textContent = "Debates you manage";
        }
        if (copyEl) {
            copyEl.textContent = "Upcoming debates can be edited here. Past managed debates are in My History.";
        }
    } else if (copyEl) {
        copyEl.textContent = "Upcoming rounds linked to your account. Past rounds are in My History.";
    }

    const profile = await getCurrentProfile(user);
    const fallbackProfile = profile || {
        accountType: normalizeAccountType(user.user_metadata?.account_type),
        email: user.email,
        first_name: "",
        last_name: ""
    };

    updateDebatesSidebar(fallbackProfile, []);

    if (viewerIsAdmin) {
        setMessage(messageEl, "Loading debates you manage...", false);

        const managedResult = await getManagedDebatesForAdmin(adminProfile.admin_id);
        if (managedResult.error) {
            upcomingList.replaceChildren(createEmptyState("Managed debates could not be loaded."));
            if (upcomingCount) {
                upcomingCount.textContent = "0";
            }
            setMessage(messageEl, managedResult.error.message, true);
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const adminRecords = managedResult.records;
        const upcomingDebates = adminRecords.filter((record) => {
            const status = String(record.status || "").toLowerCase();
            return record.debateDate >= today && status !== "completed" && status !== "finished";
        });

        updateDebatesSidebar(profile, adminRecords);

        upcomingList.replaceChildren(...(upcomingDebates.length
            ? upcomingDebates.map(createAdminUpcomingCard)
            : [createEmptyState("No upcoming managed debates were found.")]));

        if (upcomingCount) {
            upcomingCount.textContent = String(upcomingDebates.length);
        }

        setMessage(messageEl, `Loaded ${adminRecords.length} managed debate record(s).`, false);
        return;
    }

    if (!profile) {
        upcomingList.replaceChildren(createEmptyState("No matching profile record was found for this account yet. Complete your profile first."));
        if (upcomingCount) {
            upcomingCount.textContent = "0";
        }
        setMessage(messageEl, "No matching profile record was found for this account.", true);
        return;
    }

    if (profile.accountType !== "student" || !profile.student_id) {
        upcomingList.replaceChildren(createEmptyState(`${getRoleLabel(profile.accountType)} accounts do not have student debate rounds attached to this page.`));
        if (upcomingCount) {
            upcomingCount.textContent = "0";
        }
        setMessage(messageEl, `${getRoleLabel(profile.accountType)} account loaded. No student debate schedule is available for this profile.`, false);
        return;
    }

    const student = profile;

    const today = new Date().toISOString().slice(0, 10);

    setMessage(messageEl, "Loading your debates...", false);

    const participationResponse = await supabaseClient
        .from(TABLES.studentParticipation)
        .select(`
            s_participation_id,
            team_number,
            debate_stance,
            speaking_order,
            is_captain,
            debate!inner(
                debate_id,
                debate_date,
                debate_time,
                topic,
                room,
                status,
                team_a_name,
                team_b_name,
                tournament(
                    name,
                    host_school,
                    location,
                    start_date,
                    end_date,
                    status
                ),
                tournament_round(
                    debate_type,
                    round_number,
                    round_name,
                    scheduled_start,
                    room
                ),
                j_participation(
                    ruling,
                    score,
                    feedback
                ),
                c_participation(
                    notes
                )
            )
        `)
        .eq("student_id", student.student_id);

    if (participationResponse.error) {
        setMessage(messageEl, participationResponse.error.message, true);
        return;
    }

    const records = (participationResponse.data || [])
        .map(normalizeParticipationRecord)
        .sort((left, right) => String(left.debateDate || "").localeCompare(String(right.debateDate || "")));
    const upcomingDebates = records.filter((record) => {
        const status = String(record.status || "").toLowerCase();
        return record.debateDate >= today && status !== "completed" && status !== "finished";
    });

    updateDebatesSidebar(student, records);

    upcomingList.replaceChildren(...(upcomingDebates.length ? upcomingDebates.map(createUpcomingCard) : [createEmptyState("No upcoming rounds are linked to your student profile yet.")]));

    if (upcomingCount) {
        upcomingCount.textContent = String(upcomingDebates.length);
    }

    setMessage(messageEl, `Loaded ${records.length} debate records for ${student.first_name || student.email}.`, false);
}

async function handlePolicySetupPage() {
    const pageRoot = document.querySelector("[data-policy-setup]");
    const form = document.querySelector("[data-policy-form]");
    const messageEl = document.querySelector("[data-policy-message]");
    const studentRowsRoot = document.querySelector("[data-student-rows]");
    const judgeRowsRoot = document.querySelector("[data-judge-rows]");
    const coachRowsRoot = document.querySelector("[data-coach-rows]");
    const tournamentSelect = document.querySelector("[data-policy-tournament]");
    const roundSelect = document.querySelector("[data-policy-round]");
    const adminNameEl = document.querySelector("[data-policy-admin-name]");
    const adminRoleEl = document.querySelector("[data-policy-admin-role]");
    const adminAvatarEl = document.querySelector("[data-policy-admin-avatar]");

    if (!pageRoot || !form || !studentRowsRoot || !judgeRowsRoot || !coachRowsRoot) {
        return;
    }

    if (!(await requireAuth()) || !supabaseClient) {
        return;
    }

    const { user, error } = await requireAuthenticatedUser();
    if (error || !user) {
        window.location.replace("index.html");
        return;
    }

    const adminProfile = await getAdminProfile(user);
    if (!adminProfile?.admin_id) {
        window.location.replace("debates.html");
        return;
    }

    updateSidebarNavigation(true);

    const adminName = getDisplayName({ ...adminProfile, accountType: "admin" }, user);
    if (adminNameEl) {
        adminNameEl.textContent = adminName;
    }
    if (adminRoleEl) {
        adminRoleEl.textContent = adminProfile.role_title || "Administrator";
    }
    if (adminAvatarEl) {
        adminAvatarEl.textContent = getInitials(adminName);
    }

    const studentTemplate = document.getElementById("student-row-template");
    const judgeTemplate = document.getElementById("judge-row-template");
    const coachTemplate = document.getElementById("coach-row-template");

    const addStudentRowBtn = document.querySelector("[data-add-student-row]");
    const addJudgeRowBtn = document.querySelector("[data-add-judge-row]");
    const addCoachRowBtn = document.querySelector("[data-add-coach-row]");
    const resetBtn = document.querySelector("[data-reset-policy-form]");

    const debateDateInput = form.querySelector('input[name="debate_date"]');
    if (debateDateInput && !debateDateInput.value) {
        debateDateInput.value = new Date().toISOString().slice(0, 10);
    }

    setMessage(messageEl, "Loading setup data...", false);

    const [studentsRes, judgesRes, coachesRes, tournamentsRes, roundsRes] = await Promise.all([
        supabaseClient.from(TABLES.students).select("student_id,first_name,last_name,school").order("last_name").order("first_name"),
        supabaseClient.from(TABLES.judges).select("judge_id,first_name,last_name,school").order("last_name").order("first_name"),
        supabaseClient.from(TABLES.coaches).select("coach_id,first_name,last_name,school").order("last_name").order("first_name"),
        supabaseClient.from(TABLES.tournament).select("tournament_id,name,start_date,status").order("start_date", { ascending: false }),
        supabaseClient.from(TABLES.tournamentRound).select("tournament_round_id,tournament_id,debate_type,round_number,round_name,room").order("round_number", { ascending: true })
    ]);

    const loadError = studentsRes.error || judgesRes.error || coachesRes.error || tournamentsRes.error || roundsRes.error;
    if (loadError) {
        setMessage(messageEl, loadError.message || "Could not load setup options.", true);
        return;
    }

    const students = studentsRes.data || [];
    const judges = judgesRes.data || [];
    const coaches = coachesRes.data || [];
    const tournaments = tournamentsRes.data || [];
    const allRounds = (roundsRes.data || []).filter((round) => /policy/i.test(String(round.debate_type || "")));

    const toDisplayName = (record, school) => {
        const full = `${record.first_name || ""} ${record.last_name || ""}`.trim() || "Unnamed";
        return school ? `${full} (${school})` : full;
    };

    function refillTournamentOptions() {
        if (!tournamentSelect) {
            return;
        }

        tournamentSelect.innerHTML = '<option value="">No tournament link</option>';
        tournaments.forEach((tournament) => {
            const option = document.createElement("option");
            option.value = tournament.tournament_id;
            option.textContent = `${tournament.name}${tournament.start_date ? ` (${tournament.start_date})` : ""}`;
            tournamentSelect.append(option);
        });
    }

    function refillRoundOptions() {
        if (!roundSelect) {
            return;
        }

        const selectedTournamentId = String(tournamentSelect?.value || "");
        const rounds = selectedTournamentId
            ? allRounds.filter((round) => String(round.tournament_id) === selectedTournamentId)
            : allRounds;

        roundSelect.innerHTML = '<option value="">No round link</option>';
        rounds.forEach((round) => {
            const option = document.createElement("option");
            option.value = round.tournament_round_id;
            const title = round.round_name || `Round ${round.round_number}`;
            option.textContent = `${title} • ${round.debate_type || "Policy"}${round.room ? ` • ${round.room}` : ""}`;
            roundSelect.append(option);
        });
    }

    function populateSelect(selectEl, options, emptyLabel) {
        if (!selectEl) {
            return;
        }

        selectEl.innerHTML = "";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = emptyLabel;
        selectEl.append(emptyOption);

        options.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            selectEl.append(option);
        });
    }

    function assignWorldviewGroup(row) {
        const groupName = `student-worldview-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        row.querySelectorAll("[data-worldview]").forEach((input) => {
            input.name = groupName;
        });
    }

    function attachRemoveHandler(row) {
        row.querySelector("[data-remove-row]")?.addEventListener("click", () => {
            row.remove();
            updateJudgeBalanceWarning();
        });
    }

    function classifyJudgeLean(score) {
        if (score == null) {
            return "moderate";
        }
        if (score > 0.15) {
            return "liberal";
        }
        if (score < -0.15) {
            return "conservative";
        }
        return "moderate";
    }

    function formatJudgeConsistency(stats) {
        if (!stats || stats.decided_count === 0) {
            return "No consistency data";
        }
        const avg = Number(stats.consistency_avg || 0).toFixed(2);
        return `${stats.consistency_label || "Moderate consistency"} (${avg})`;
    }

    async function refreshJudgeRowConsistency(row) {
        const judgeId = row.querySelector("[data-judge-id]")?.value;
        const consistencyEl = row.querySelector("[data-judge-consistency]");
        if (!judgeId || !consistencyEl || !supabaseClient) {
            if (consistencyEl) {
                consistencyEl.textContent = "Not selected";
            }
            return;
        }

        consistencyEl.textContent = "Loading...";
        const response = await supabaseClient.rpc("get_judge_bias_stats", {
            target_judge_id: judgeId
        });

        if (response.error || !response.data?.length) {
            consistencyEl.textContent = "Consistency unavailable";
            consistencyEl.dataset.consistencyScore = "";
            updateJudgeBalanceWarning();
            return;
        }

        const judgeStats = response.data[0];
        consistencyEl.textContent = formatJudgeConsistency(judgeStats);
        consistencyEl.dataset.consistencyScore = String(judgeStats.consistency_avg ?? "");
        updateJudgeBalanceWarning();
    }

    function updateJudgeBalanceWarning() {
        const warningEl = document.querySelector("[data-judge-balance-warning]");
        if (!warningEl) {
            return;
        }

        const judgeRows = Array.from(judgeRowsRoot.querySelectorAll("[data-policy-row]"));
        const leanCounts = { conservative: 0, liberal: 0, moderate: 0 };

        judgeRows.forEach((row) => {
            const score = Number(row.querySelector("[data-judge-consistency]")?.dataset.consistencyScore || "NaN");
            const label = row.querySelector("[data-judge-consistency]")?.textContent || "";
            let lean = "moderate";

            if (!Number.isNaN(score)) {
                lean = classifyJudgeLean(score);
            } else if (/liberal/i.test(label)) {
                lean = "liberal";
            } else if (/conservative/i.test(label)) {
                lean = "conservative";
            }

            if (lean in leanCounts) {
                leanCounts[lean] += 1;
            }
        });

        if (leanCounts.conservative !== leanCounts.liberal && (leanCounts.conservative + leanCounts.liberal) > 0) {
            warningEl.textContent = `Warning: panel balance is uneven. Conservative judges: ${leanCounts.conservative}, Liberal judges: ${leanCounts.liberal}. Moderates are less critical.`;
            warningEl.hidden = false;
        } else {
            warningEl.textContent = "";
            warningEl.hidden = true;
        }
    }

    function attachJudgeRowHandlers(row) {
        const judgeSelect = row.querySelector("[data-judge-id]");
        if (!judgeSelect) {
            return;
        }

        judgeSelect.addEventListener("change", () => {
            refreshJudgeRowConsistency(row);
        });
    }

    function addStudentRow() {
        if (!(studentTemplate instanceof HTMLTemplateElement)) {
            return;
        }

        const row = studentTemplate.content.firstElementChild.cloneNode(true);
        const studentSelect = row.querySelector("[data-student-id]");
        const options = students.map((student) => ({
            value: student.student_id,
            label: toDisplayName(student, student.school)
        }));

        populateSelect(studentSelect, options, "Select student");
        assignWorldviewGroup(row);
        attachRemoveHandler(row);
        studentRowsRoot.append(row);
    }

    function addJudgeRow() {
        if (!(judgeTemplate instanceof HTMLTemplateElement)) {
            return;
        }

        const row = judgeTemplate.content.firstElementChild.cloneNode(true);
        const judgeSelect = row.querySelector("[data-judge-id]");
        const options = judges.map((judge) => ({
            value: judge.judge_id,
            label: toDisplayName(judge, judge.school)
        }));

        populateSelect(judgeSelect, options, "Select judge");
        attachRemoveHandler(row);
        attachJudgeRowHandlers(row);
        judgeRowsRoot.append(row);
    }

    function addCoachRow() {
        if (!(coachTemplate instanceof HTMLTemplateElement)) {
            return;
        }

        const row = coachTemplate.content.firstElementChild.cloneNode(true);
        const coachSelect = row.querySelector("[data-coach-id]");
        const options = coaches.map((coach) => ({
            value: coach.coach_id,
            label: toDisplayName(coach, coach.school)
        }));

        populateSelect(coachSelect, options, "Select coach");
        attachRemoveHandler(row);
        coachRowsRoot.append(row);
    }

    function resetRows() {
        studentRowsRoot.replaceChildren();
        judgeRowsRoot.replaceChildren();
        coachRowsRoot.replaceChildren();

        addStudentRow();
        addStudentRow();
        addJudgeRow();
        addCoachRow();
    }

    refillTournamentOptions();
    refillRoundOptions();
    resetRows();
    setMessage(messageEl, "Ready to schedule a policy debate.", false);

    tournamentSelect?.addEventListener("change", refillRoundOptions);
    addStudentRowBtn?.addEventListener("click", addStudentRow);
    addJudgeRowBtn?.addEventListener("click", addJudgeRow);
    addCoachRowBtn?.addEventListener("click", addCoachRow);

    resetBtn?.addEventListener("click", () => {
        form.reset();
        if (debateDateInput) {
            debateDateInput.value = new Date().toISOString().slice(0, 10);
        }
        refillRoundOptions();
        resetRows();
        setMessage(messageEl, "Form reset.", false);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const studentAssignments = Array.from(studentRowsRoot.querySelectorAll("[data-policy-row]"))
            .map((row) => {
                const studentId = sanitizeUuid(row.querySelector("[data-student-id]")?.value || "");
                return {
                    student_id: studentId,
                    team_number: toPositiveInt(row.querySelector("[data-team-number]")?.value || 1, 1),
                    debate_stance: sanitizeText(row.querySelector("[data-debate-stance]")?.value || "Affirmative", 24),
                    worldview: sanitizeText(row.querySelector("[data-worldview]:checked")?.value || "Moderate", 12),
                    speaking_order: toPositiveInt(row.querySelector("[data-speaking-order]")?.value || "", null),
                    is_captain: Boolean(row.querySelector("[data-is-captain]")?.checked)
                };
            })
            .filter((item) => item.student_id);

        const judgeAssignments = Array.from(judgeRowsRoot.querySelectorAll("[data-policy-row]"))
            .map((row) => ({
                judge_id: sanitizeUuid(row.querySelector("[data-judge-id]")?.value || ""),
                panel_number: toPositiveInt(row.querySelector("[data-panel-number]")?.value || 1, 1)
            }))
            .filter((item) => item.judge_id);

        const coachAssignments = Array.from(coachRowsRoot.querySelectorAll("[data-policy-row]"))
            .map((row) => ({
                coach_id: sanitizeUuid(row.querySelector("[data-coach-id]")?.value || ""),
                mentored_team_number: toPositiveInt(row.querySelector("[data-mentored-team-number]")?.value || 1, 1),
                notes: sanitizeText(row.querySelector("[data-coach-notes]")?.value || "", 500) || null
            }))
            .filter((item) => item.coach_id);

        if (studentAssignments.length < 2) {
            setMessage(messageEl, "Assign at least two students before creating the debate.", true);
            return;
        }

        const uniqueStudentIds = new Set(studentAssignments.map((item) => item.student_id));
        if (uniqueStudentIds.size !== studentAssignments.length) {
            setMessage(messageEl, "Each student can only be assigned once in a debate.", true);
            return;
        }

        const debateDate = sanitizeText(form.querySelector('input[name="debate_date"]')?.value || "", 32);
        if (!debateDate) {
            setMessage(messageEl, "Debate date is required.", true);
            return;
        }

        setMessage(messageEl, "Creating policy debate setup...", false);

        const payload = {
            p_tournament_id: sanitizeUuid(tournamentSelect?.value || "") || null,
            p_tournament_round_id: sanitizeUuid(roundSelect?.value || "") || null,
            p_debate_date: debateDate,
            p_debate_time: sanitizeText(form.querySelector('input[name="debate_time"]')?.value || "", 16) || null,
            p_topic: sanitizeText(form.querySelector('input[name="topic"]')?.value || "", 500) || null,
            p_room: sanitizeText(form.querySelector('input[name="room"]')?.value || "", 50) || null,
            p_team_a_name: sanitizeText(form.querySelector('input[name="team_a_name"]')?.value || "", 120) || null,
            p_team_b_name: sanitizeText(form.querySelector('input[name="team_b_name"]')?.value || "", 120) || null,
            p_student_assignments: studentAssignments,
            p_judge_assignments: judgeAssignments,
            p_coach_assignments: coachAssignments
        };

        const response = await supabaseClient.rpc("create_policy_debate_setup", payload);
        if (response.error) {
            setMessage(messageEl, response.error.message || "Could not create policy debate setup.", true);
            return;
        }

        const createdId = response.data;
        setMessage(messageEl, `Policy debate created successfully (${createdId}).`, false);
    });
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

function setupBackButtons() {
    const backButtons = document.querySelectorAll("[data-back-button]");
    if (!backButtons.length) {
        return;
    }

    const currentPath = String(window.location.pathname || "").split("/").pop() || "index.html";
    const fallbackByPage = {
        "index.html": "index.html",
        "debates.html": "settings.html",
        "settings.html": "debates.html",
        "profiles.html": "debates.html",
        "policy-setup.html": "profiles.html",
        "user-history.html": "debates.html"
    };
    const fallback = fallbackByPage[currentPath] || "debates.html";

    backButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();

            const explicitProfileType = normalizeRoleType(button.getAttribute("data-back-profile-type"));
            const explicitProfileId = sanitizeUuid(button.getAttribute("data-back-profile-id") || "");
            if (explicitProfileId) {
                navigateToProfileSettings(explicitProfileType, explicitProfileId);
                return;
            }

            const perButtonFallback = sanitizeText(button.getAttribute("data-back-fallback") || "", 64);
            const fallbackRoute = perButtonFallback || fallback;

            const referrer = document.referrer;
            const hasValidReferrer = Boolean(referrer)
                && referrer.startsWith(window.location.origin)
                && referrer !== window.location.href;

            if (window.history.length > 1 && hasValidReferrer) {
                window.history.back();
                return;
            }

            window.location.href = fallbackRoute;
        });
    });
}

handleLoginForm();
handleSettingsForm();
handleProfileNetworkSection();
handleDebatesPage();
handleAdminDirectoryPage();
handleUserHistoryPage();
handlePolicySetupPage();
setupSignOut();
setupBackButtons();
