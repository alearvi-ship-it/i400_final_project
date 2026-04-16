// Debug panel for policy-setup.html
window.addEventListener('DOMContentLoaded', async function() {
  const panel = document.createElement('div');
  panel.style.background = '#fff8e1';
  panel.style.border = '2px solid #fbc02d';
  panel.style.padding = '1em';
  panel.style.margin = '1em 0';
  panel.style.fontSize = '1em';
  panel.style.color = '#333';
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
    const client = window.supabase.createClient(url, key);
    let out = '';
    for (const tbl of ['students','judges','coaches']) {
      out += `<div><strong>Table:</strong> ${tbl}</div>`;
      try {
        const { data, error, status } = await client.from(tbl).select('*').limit(5);
        if (error) {
          out += `<div style="color:red">Error: ${error.message} (status ${status})</div>`;
        } else if (!data || !data.length) {
          out += `<div style="color:orange">No data found.</div>`;
        } else {
          out += `<div style="color:green">${data.length} rows found.</div>`;
        }
      } catch (e) {
        out += `<div style="color:red">Query failed: ${e}</div>`;
      }
    }
    show(out);
  } catch (e) {
    show('Exception: ' + e);
  }
});
