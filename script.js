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
        selectColumns: "student_id,auth_user_id,first_name,last_name,school,email,graduation_year,phone"
    },
    coach: {
        accountType: "coach",
        table: TABLES.coaches,
        idColumn: "coach_id",
        selectColumns: "coach_id,auth_user_id,first_name,last_name,school,email,phone,years_experience"
    },
    judge: {
        accountType: "judge",
        table: TABLES.judges,
        idColumn: "judge_id",
        selectColumns: "judge_id,auth_user_id,first_name,last_name,school,email,phone,certification"
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
    return raw.replace(/[^a-zA-Z0-9@.\-\s]/g, " ").replace(/\s+/g, " ").trim();
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
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

function getSettingsQueryTarget() {
    const params = new URLSearchParams(window.location.search);
    const profileType = normalizeRoleType(params.get("profileType"));
    const profileId = String(params.get("profileId") || "").trim();

    if (!profileId) {
        return null;
    }

    return { profileType, profileId };
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

async function getProfileByType(user, accountType) {
    if (!supabaseClient || !user) {
        return null;
    }

    const profileConfig = PROFILE_CONFIG[normalizeAccountType(accountType)];
    if (!profileConfig) {
        return null;
    }

    const byAuthUser = await supabaseClient
        .from(profileConfig.table)
        .select(profileConfig.selectColumns)
        .eq("auth_user_id", user.id)
        .maybeSingle();

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

    const byEmail = await supabaseClient
        .from(profileConfig.table)
        .select(profileConfig.selectColumns)
        .eq("email", user.email)
        .maybeSingle();

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

    const response = await supabaseClient
        .from(profileConfig.table)
        .select(profileConfig.selectColumns)
        .eq(profileConfig.idColumn, accountId)
        .maybeSingle();

    return response.data ? { ...response.data, accountType: profileConfig.accountType } : null;
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
        <a class="ghost-button profile-open-link" href="settings.html?profileType=${encodeURIComponent(DIRECTORY_TABS[type].accountType)}&profileId=${encodeURIComponent(profile[DIRECTORY_TABS[type].idColumn])}">Open profile</a>
    `;

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

    const historyLink = isAdminMode && profile.can_view_history
        ? `<a class="ghost-button profile-history-link" href="user-history.html?type=${encodeURIComponent(roleType)}&id=${encodeURIComponent(profile.account_id)}&name=${encodeURIComponent(fullName)}">View debate history</a>`
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
        ${historyLink}
    `;

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

    let query = supabaseClient
        .from(directoryConfig.table)
        .select(directoryConfig.selectColumns)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .limit(100);

    const trimmed = sanitizeSearchInput(searchText);
    if (trimmed) {
        const safeTerm = trimmed;
        query = query.or(`first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,school.ilike.%${safeTerm}%`);
    }

    const response = await query;
    return { data: response.data || [], error: response.error || null };
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
    if (gradYearInput) {
        gradYearInput.value = "";
    }

    setGraduationFieldVisibility(settingsForm, accountType);

    if (!profile) {
        updateSettingsHeader({ email: user.email, accountType }, user);
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
    if (gradYearInput && accountType === "student" && profile.graduation_year) {
        gradYearInput.value = profile.graduation_year;
    }

    updateSettingsHeader(profile, user);
}

async function handleSettingsForm() {
    const settingsForm = document.querySelector("[data-settings-form]");
    const messageEl = document.querySelector("[data-settings-message]");
    const contextEl = document.querySelector("[data-settings-context]");
    const saveButton = document.querySelector("[data-settings-save-button]");
    const historyLink = document.querySelector("[data-settings-history-link]");

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
        if (gradYearInput) {
            gradYearInput.value = targetProfile.graduation_year || "";
        }

        setGraduationFieldVisibility(settingsForm, targetProfile.accountType);
        updateSettingsHeader(targetProfile, user);
        setFormDisabled(settingsForm, true);

        if (saveButton) {
            saveButton.hidden = true;
        }

        if (historyLink) {
            const displayName = [targetProfile.first_name, targetProfile.last_name].filter(Boolean).join(" ") || targetProfile.email || "User";
            historyLink.href = `user-history.html?type=${encodeURIComponent(target.profileType)}&id=${encodeURIComponent(target.profileId)}&name=${encodeURIComponent(displayName)}`;
            historyLink.hidden = false;
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
    if (historyLink) {
        historyLink.hidden = true;
    }
    if (contextEl) {
        contextEl.textContent = "Editing your own profile information.";
    }

    await preloadSettingsForm();

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = sanitizeText(settingsForm.querySelector('input[name="full-name"]')?.value || "", 120);
        const email = sanitizeEmail(settingsForm.querySelector('input[name="email"]')?.value || "");
        const schoolValue = sanitizeText(settingsForm.querySelector('input[name="school"]')?.value || "", 120);
        const phoneValue = sanitizePhone(settingsForm.querySelector('input[name="phone"]')?.value || "");
        const school = schoolValue || null;
        const phone = phoneValue || null;
        const gradYearRaw = settingsForm.querySelector('input[name="grad-year"]')?.value || "";
        const gradYear = gradYearRaw ? toPositiveInt(gradYearRaw, null) : null;
        const newPassword = settingsForm.querySelector('input[name="new-password"]')?.value || "";
        const confirmPassword = settingsForm.querySelector('input[name="confirm-password"]')?.value || "";
        const { firstName, lastName } = splitName(fullName);

        if (!email || !firstName) {
            setMessage(messageEl, "Full name and email are required.", true);
            return;
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

        setMessage(messageEl, "Saving profile...", false);

        const payload = {
            auth_user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            email,
            school,
            phone,
        };

        if (accountType === "student") {
            payload.graduation_year = Number.isFinite(gradYear) ? gradYear : null;
        }

        const existingProfileId = existingProfile?.[profileConfig.idColumn];

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

        if (email !== user.email) {
            const emailUpdate = await supabaseClient.auth.updateUser({ email });
            if (emailUpdate.error) {
                setMessage(messageEl, `Profile saved, but email update failed: ${emailUpdate.error.message}`, true);
                return;
            }
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
    const sidebarTitleEl = document.querySelector("[data-sidebar-title]");
    const sidebarBodyEl = document.querySelector("[data-sidebar-body]");
    const adminNavItems = document.querySelectorAll("[data-nav-admin-only]");

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

    adminNavItems.forEach((item) => { item.hidden = !isAdmin; });

    const params = new URLSearchParams(window.location.search);
    const paramType = normalizeRoleType(params.get("type"));
    const paramId = sanitizeUuid(params.get("id") || "");
    const paramName = sanitizeText(params.get("name") || "User", 120);

    let targetType, targetId, targetName, isSelfView;

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

        if (normalizeAccountType(ownProfile.accountType) === "admin") {
            resultsRoot.replaceChildren(createEmptyState("Administrator accounts do not have a participant debate history."));
            setMessage(messageEl, "No debate history for administrator accounts.", false);
            return;
        }

        const ownAccountType = normalizeAccountType(ownProfile.accountType);
        const ownConfig = PROFILE_CONFIG[ownAccountType];
        console.debug(`[handleUserHistoryPage] Profile data keys:`, Object.keys(ownProfile), `Account type config expects ID column: ${ownConfig.idColumn}`);
        targetType = normalizeRoleType(ownAccountType);
        targetId = sanitizeUuid(ownProfile[ownConfig.idColumn] || "");
        targetName = getDisplayName(ownProfile, user);
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
        titleEl.textContent = isSelfView ? "My debate history" : `${targetName}'s debate history`;
    }

    if (copyEl) {
        const roleLabel = getRoleLabel(targetType).toLowerCase();
        copyEl.textContent = isSelfView
            ? `All debates linked to your ${roleLabel} account.`
            : `All recorded debates for this ${roleLabel} account.`;
    }

    if (sidebarTitleEl) {
        sidebarTitleEl.textContent = isSelfView ? "Debate history" : "Admin tools";
    }

    if (sidebarBodyEl) {
        sidebarBodyEl.textContent = isSelfView
            ? "Your complete debate record — all rounds from every tournament."
            : "Reviewing the full debate history tied to this account.";
    }

    if (backLinkEl) {
        if (isSelfView) {
            backLinkEl.href = "debates.html";
            backLinkEl.textContent = "Back to my debates";
        } else {
            backLinkEl.href = `settings.html?profileType=${encodeURIComponent(targetType)}&profileId=${encodeURIComponent(targetId)}`;
            backLinkEl.textContent = "Back to profile";
        }
    }

    setMessage(messageEl, "Loading debate history...", false);

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
    const { decided_count, affirmative_wins, negative_wins, affirmative_pct, lean_label } = stats;
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
    updateText("[data-rounds-count]", String(accountType === "student" ? records.length : 0));
    updateText("[data-wins-count]", `${accountType === "student" ? wins : 0}W`);
    updateText("[data-losses-count]", `${accountType === "student" ? losses : 0}L`);
}

async function handleDebatesPage() {
    const upcomingList = document.querySelector("[data-upcoming-list]");
    const pastList = document.querySelector("[data-past-list]");
    const upcomingCount = document.querySelector("[data-upcoming-count]");
    const pastCount = document.querySelector("[data-past-count]");
    const messageEl = document.querySelector("[data-debates-message]");

    if (!upcomingList || !pastList) {
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

    const profile = await getCurrentProfile(user);
    const fallbackProfile = profile || {
        accountType: normalizeAccountType(user.user_metadata?.account_type),
        email: user.email,
        first_name: "",
        last_name: ""
    };

    updateDebatesSidebar(fallbackProfile, []);

    if (!profile) {
        upcomingList.replaceChildren(createEmptyState("No matching profile record was found for this account yet. Complete your profile first."));
        pastList.replaceChildren(createEmptyState("Once your profile is saved, your debate history will appear here."));
        if (upcomingCount) {
            upcomingCount.textContent = "0";
        }
        if (pastCount) {
            pastCount.textContent = "0";
        }
        setMessage(messageEl, "No matching profile record was found for this account.", true);
        return;
    }

    if (profile.accountType !== "student" || !profile.student_id) {
        upcomingList.replaceChildren(createEmptyState(`${getRoleLabel(profile.accountType)} accounts do not have student debate rounds attached to this page.`));
        pastList.replaceChildren(createEmptyState("Student round history will appear here for student accounts."));
        if (upcomingCount) {
            upcomingCount.textContent = "0";
        }
        if (pastCount) {
            pastCount.textContent = "0";
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
    const upcomingDebates = records.filter((record) => record.debateDate >= today);
    const pastDebates = records.filter((record) => record.debateDate < today).reverse();

    updateDebatesSidebar(student, records);

    upcomingList.replaceChildren(...(upcomingDebates.length ? upcomingDebates.map(createUpcomingCard) : [createEmptyState("No upcoming rounds are linked to your student profile yet.")]));
    pastList.replaceChildren(...(pastDebates.length ? pastDebates.map(createPastCard) : [createEmptyState("No completed rounds are linked to your student profile yet.")]));

    if (upcomingCount) {
        upcomingCount.textContent = String(upcomingDebates.length);
    }

    if (pastCount) {
        pastCount.textContent = String(pastDebates.length);
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

    function attachRemoveHandler(row) {
        row.querySelector("[data-remove-row]")?.addEventListener("click", () => {
            row.remove();
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

handleLoginForm();
handleSettingsForm();
handleProfileNetworkSection();
handleDebatesPage();
handleAdminDirectoryPage();
handleUserHistoryPage();
handlePolicySetupPage();
setupSignOut();
