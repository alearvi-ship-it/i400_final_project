// ===============================
// POLICY SETUP FIXED LOGIC
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.supabase) return;

    const supabase = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
    );

    const studentContainer = document.querySelector("[data-student-rows]");
    const judgeContainer = document.querySelector("[data-judge-rows]");
    const coachContainer = document.querySelector("[data-coach-rows]");

    const studentTemplate = document.getElementById("student-row-template");
    const judgeTemplate = document.getElementById("judge-row-template");
    const coachTemplate = document.getElementById("coach-row-template");

    let students = [];
    let judges = [];
    let coaches = [];

    // ===============================
    // LOAD DATA
    // ===============================
    async function loadProfiles() {
        const [s, j, c] = await Promise.all([
            supabase.from("students").select("student_id,first_name,last_name"),
            supabase.from("judges").select("judge_id,first_name,last_name"),
            supabase.from("coaches").select("coach_id,first_name,last_name")
        ]);

        students = s.data || [];
        judges = j.data || [];
        coaches = c.data || [];
    }

    function populateSelect(select, data, idField) {
        select.innerHTML = `<option value="">Select</option>`;
        data.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item[idField];
            opt.textContent = `${item.first_name} ${item.last_name}`;
            select.appendChild(opt);
        });
    }

    // ===============================
    // ADD ROW FUNCTIONS
    // ===============================
    function addStudentRow() {
        const clone = studentTemplate.content.cloneNode(true);
        const row = clone.querySelector("[data-policy-row]");

        const select = row.querySelector("[data-student-id]");
        populateSelect(select, students, "student_id");

        // FIX: unique radio group
        const radios = row.querySelectorAll("[data-worldview]");
        const uniqueName = "worldview_" + Date.now() + Math.random();
        radios.forEach(r => r.name = uniqueName);

        attachRemove(row);
        studentContainer.appendChild(row);
    }

    function addJudgeRow() {
        const clone = judgeTemplate.content.cloneNode(true);
        const row = clone.querySelector("[data-policy-row]");

        const select = row.querySelector("[data-judge-id]");
        populateSelect(select, judges, "judge_id");

        attachRemove(row);
        judgeContainer.appendChild(row);
    }

    function addCoachRow() {
        const clone = coachTemplate.content.cloneNode(true);
        const row = clone.querySelector("[data-policy-row]");

        const select = row.querySelector("[data-coach-id]");
        populateSelect(select, coaches, "coach_id");

        attachRemove(row);
        coachContainer.appendChild(row);
    }

    function attachRemove(row) {
        row.querySelector("[data-remove-row]").addEventListener("click", () => {
            row.remove();
        });
    }

    // ===============================
    // BUTTON HANDLERS
    // ===============================
    document.querySelector("[data-add-student-row]")
        ?.addEventListener("click", addStudentRow);

    document.querySelector("[data-add-judge-row]")
        ?.addEventListener("click", addJudgeRow);

    document.querySelector("[data-add-coach-row]")
        ?.addEventListener("click", addCoachRow);

    // ===============================
    // FORM SUBMIT
    // ===============================
    document.querySelector("[data-policy-form]")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();

            const form = e.target;

            // CREATE DEBATE
            const { data: debate, error: debateError } = await supabase
                .from("debate")
                .insert([{
                    debate_date: form.debate_date.value,
                    debate_time: form.debate_time.value,
                    room: form.room.value,
                    topic: form.topic.value,
                    team_a_name: form.team_a_name.value,
                    team_b_name: form.team_b_name.value
                }])
                .select()
                .single();

            if (debateError) {
                alert(debateError.message);
                return;
            }

            const debateId = debate.debate_id;

            // ===============================
            // STUDENTS
            // ===============================
            const studentRows = [...studentContainer.children];
            for (const row of studentRows) {
                const studentId = row.querySelector("[data-student-id]").value;
                if (!studentId) continue;

                const worldview = row.querySelector("[data-worldview]:checked")?.value;

                await supabase.from("s_participation").insert([{
                    debate_id: debateId,
                    student_id: studentId,
                    team_number: row.querySelector("[data-team-number]").value,
                    stance: row.querySelector("[data-debate-stance]").value,
                    worldview,
                    speaking_order: row.querySelector("[data-speaking-order]").value,
                    is_captain: row.querySelector("[data-is-captain]").checked
                }]);
            }

            // ===============================
            // JUDGES
            // ===============================
            const judgeRows = [...judgeContainer.children];
            for (const row of judgeRows) {
                const judgeId = row.querySelector("[data-judge-id]").value;
                if (!judgeId) continue;

                await supabase.from("judge_assignment").insert([{
                    debate_id: debateId,
                    judge_id: judgeId,
                    panel_number: row.querySelector("[data-panel-number]").value
                }]);
            }

            // ===============================
            // COACHES
            // ===============================
            const coachRows = [...coachContainer.children];
            for (const row of coachRows) {
                const coachId = row.querySelector("[data-coach-id]").value;
                if (!coachId) continue;

                await supabase.from("coach_assignment").insert([{
                    debate_id: debateId,
                    coach_id: coachId,
                    team_number: row.querySelector("[data-mentored-team-number]").value,
                    notes: row.querySelector("[data-coach-notes]").value
                }]);
            }

            alert("Debate created successfully");
            form.reset();

            studentContainer.innerHTML = "";
            judgeContainer.innerHTML = "";
            coachContainer.innerHTML = "";
        });

    // ===============================
    // INIT
    // ===============================
    await loadProfiles();
});