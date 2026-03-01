// Auth API URL
const API_URL = 'https://x-reply-drafter.com'; // Update to your domain

// Show/hide forms
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  clearMessages();
}

function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
  clearMessages();
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  successEl.textContent = message;
  successEl.classList.remove('hidden');
}

function clearMessages() {
  document.getElementById('error-message').classList.add('hidden');
  document.getElementById('success-message').classList.add('hidden');
}

// Login handler
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Login failed');
      return;
    }

    // Store token and user info
    await chrome.storage.local.set({
      authToken: data.token,
      userId: data.user.id,
      userEmail: data.user.email,
      userPlan: data.user.plan,
      isLoggedIn: true,
    });

    showSuccess('Login successful! Redirecting...');
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    showError('An error occurred. Please try again.');
    console.error('Login error:', error);
  }
});

// Signup handler
document.getElementById('signup-btn').addEventListener('click', async () => {
  const name = document.getElementById('name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) {
    showError('Please fill in all fields');
    return;
  }

  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Signup failed');
      return;
    }

    // Get token after signup
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      showError('Account created but login failed. Please try logging in.');
      return;
    }

    // Store token and user info
    await chrome.storage.local.set({
      authToken: loginData.token,
      userId: loginData.user.id,
      userEmail: loginData.user.email,
      userPlan: loginData.user.plan || 'free',
      isLoggedIn: true,
    });

    showSuccess('Account created! Redirecting...');
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    showError('An error occurred. Please try again.');
    console.error('Signup error:', error);
  }
});

// Google OAuth handler
document.getElementById('google-btn').addEventListener('click', () => {
  // Will implement OAuth flow
  showError('Google login coming soon');
});

// Check if already logged in
chrome.storage.local.get(['isLoggedIn'], (result) => {
  if (result.isLoggedIn) {
    window.close();
  }
});
