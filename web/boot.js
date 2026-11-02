// Keep entry failures visible even if an app dependency fails to download.
import('./app.js').catch(error => {
  document.getElementById('startupScreen').hidden = false;
  document.getElementById('startupError').textContent = 'Unable to load the app: ' + error.message;
  document.getElementById('startupActions').hidden = false;
});
