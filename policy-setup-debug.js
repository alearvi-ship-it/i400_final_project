// Debug panel for policy-setup.html
window.addEventListener('DOMContentLoaded', async function() {
  const panel = document.createElement('div');
  panel.className = 'panel-card section-card policy-section';
  panel.innerHTML = '<strong>Policy Setup Debug Panel</strong><div id="policy-debug-content">Loading...</div>';
  document.body.prepend(panel);

  function show(msg) {
    document.getElementById('policy-debug-content').innerHTML = msg;
  }

  try {
    if (!window.supabase || !window.supabase.createClient) {
      show('Supabase JS library is missing.');
      return;
    }
    if (!window.APP_CONFIG) {
      show('window.APP_CONFIG is missing.');
      return;
    }
    const url = window.APP_CONFIG.SUPABASE_URL;
    const key = window.APP_CONFIG.SUPABASE_ANON_KEY;
    if (!url || !key) {
      show('Supabase URL or anon key missing.');
      return;
    }
    const client = window.__debatehubSupabaseClient || (window.__debatehubSupabaseClient = window.supabase.createClient(url, key));
    let out = '';
    for (const tbl of ['students','judges','coaches']) {
      out += `<div><strong>Table:</strong> ${tbl}</div>`;
      try {
        const { data, error, status } = await client.from(tbl).select('*').limit(5);
        if (error) {
          out += `<div>Error: ${error.message} (status ${status})</div>`;
        } else if (!data || !data.length) {
          out += `<div>No data found.</div>`;
        } else {
          out += `<div>${data.length} rows found.</div>`;
        }
      } catch (e) {
        out += `<div>Query failed: ${e}</div>`;
      }
    }
    show(out);
  } catch (e) {
    show('Exception: ' + e);
  }
});
