// Diagnostics for policy-setup.html (CSP-safe)
window.addEventListener('DOMContentLoaded', function() {
  var message = document.querySelector('[data-policy-message]');
  window.onerror = function(msg, url, line, col, error) {
    if (message) {
      message.textContent = 'JS Error: ' + msg + ' at ' + url + ':' + line + ':' + col;
      message.style.color = 'red';
    }
    return false;
  };
  var supa = window.supabase && window.supabase.createClient;
  var config = window.APP_CONFIG;
  if (!supa) {
    if (message) {
      message.textContent = 'Supabase library is missing. Check your network and Content Security Policy.';
      message.style.color = 'red';
    }
  } else if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    if (message) {
      message.textContent = 'Supabase config is missing or incomplete.';
      message.style.color = 'red';
    }
  }
});
