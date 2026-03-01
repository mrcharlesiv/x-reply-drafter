(async function init() {
  const res = await chrome.runtime.sendMessage({ type: 'x-reply-drafter:get-settings' });
  const settings = res?.settings || {};
  const ready = Boolean(settings.apiKey && settings.endpoint && settings.model);
  document.getElementById('summary').textContent = ready
    ? `Configured model: ${settings.model}`
    : 'Complete setup first (API key + endpoint + model).';

  document.getElementById('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
