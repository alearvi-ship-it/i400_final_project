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
    }
};

const ACCOUNT_TYPE_LABELS = {
    student: "Student",
    coach: "Coach",
    judge: "Judge"
};

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
        return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace("index.html");
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setMessage(target, message, isError) {
    if (!target) {
        return;
    }

    target.textContent = message;
    target.style.color = isError ? "#a11" : "#165b33";
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

    if (byAuthUser.data) {
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

    return byEmail.data ? { ...byEmail.data, accountType: profileConfig.accountType } : null;
}

async function getCurrentProfile(user) {
    const preferredType = normalizeAccountType(user?.user_metadata?.account_type);
    const lookupOrder = [
        preferredType,
        ...Object.keys(PROFILE_CONFIG).filter((accountType) => accountType !== preferredType)
    ];

    for (const accountType of lookupOrder) {
        const profile = await getProfileByType(user, accountType);
        if (profile) {
            return profile;
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

    const { data } = await supabaseClient.auth.getSession();
    if (data?.session) {
        window.location.href = "debates.html";
        return;
    }

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

        const email = loginForm.querySelector('input[name="email"]')?.value?.trim();
        const password = loginForm.querySelector('input[name="password"]')?.value || "";

        if (!email || !password) {
            setMessage(messageEl, "Email and password are required.", true);
            return;
        }

        if (isSignUp) {
            const confirmPassword = loginForm.querySelector('input[name="confirm-password"]')?.value || "";
            const accountType = loginForm.querySelector('select[name="account-type"]')?.value || "student";
            if (password !== confirmPassword) {
                setMessage(messageEl, "Passwords do not match.", true);
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
                window.location.href = "debates.html";
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

    if (!settingsForm) {
        return;
    }

    await requireAuth();

    if (!supabaseClient) {
        setMessage(messageEl, "Account services are not available right now. Please try again later.", true);
        return;
    }

    await preloadSettingsForm();

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = settingsForm.querySelector('input[name="full-name"]')?.value || "";
        const email = settingsForm.querySelector('input[name="email"]')?.value?.trim() || "";
        const school = settingsForm.querySelector('input[name="school"]')?.value?.trim() || null;
        const phone = settingsForm.querySelector('input[name="phone"]')?.value?.trim() || null;
        const gradYearRaw = settingsForm.querySelector('input[name="grad-year"]')?.value || "";
        const gradYear = gradYearRaw ? Number(gradYearRaw) : null;
        const newPassword = settingsForm.querySelector('input[name="new-password"]')?.value || "";
        const confirmPassword = settingsForm.querySelector('input[name="confirm-password"]')?.value || "";
        const { firstName, lastName } = splitName(fullName);

        if (!email || !firstName) {
            setMessage(messageEl, "Full name and email are required.", true);
            return;
        }

        if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
            setMessage(messageEl, "New password and confirmation must match.", true);
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

    await requireAuth();

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
