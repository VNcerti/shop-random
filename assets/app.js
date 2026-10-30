/* =========================================================
   RANDOM5S - FRONTEND APPLICATION
   Backend: https://api.random5s.site
   ========================================================= */

"use strict";

/* =========================
   1. CONFIGURATION
========================= */

const API_BASE_URL = "https://api.random5s.site";
const DEMO_MODE = false;
const TOKEN_KEY = "random5s_token";
const THEME_KEY = "random5s_theme";

let currentUser = null;


/* =========================
   2. COMMON HELPERS
========================= */

const money = value =>
  new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";


const getToken = () =>
  localStorage.getItem(TOKEN_KEY);


const setToken = token => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};


function showToast(message) {
  let node = document.getElementById("toast");

  if (!node) {
    node = document.createElement("div");
    node.id = "toast";
    node.className = "toast";
    document.body.appendChild(node);
  }

  node.textContent = message;
  node.classList.remove("hidden");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    node.classList.add("hidden");
  }, 2600);
}


/* =========================
   3. API REQUEST
========================= */

async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    console.error("Random5s API connection error:", error);

    throw new Error(
      "Không thể kết nối máy chủ. Vui lòng thử lại."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null);
      currentUser = null;
    }

    throw new Error(
      data.error ||
      data.message ||
      `Máy chủ trả về lỗi ${response.status}.`
    );
  }

  return data;
}


/* =========================
   4. THEME
========================= */

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);

  const dark = saved
    ? saved === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.documentElement.classList.toggle("dark", dark);

  updateThemeButton();
}


function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");

  localStorage.setItem(
    THEME_KEY,
    dark ? "dark" : "light"
  );

  updateThemeButton();
}


function updateThemeButton() {
  document.querySelectorAll("[data-theme-toggle]").forEach(el => {
    el.innerHTML = document.documentElement.classList.contains("dark")
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  });
}


/* =========================
   5. NOTIFICATIONS
========================= */

function toggleNotifications() {
  const panel = document.getElementById("notification-panel");

  if (panel) {
    panel.classList.toggle("hidden");
  }
}


function closeNotifications(event) {
  const panel = document.getElementById("notification-panel");

  if (
    panel &&
    !panel.contains(event.target) &&
    !event.target.closest("[data-notifications]")
  ) {
    panel.classList.add("hidden");
  }
}


function markNotificationsRead() {
  const dot = document.getElementById("notification-dot");

  if (dot) {
    dot.classList.add("hidden");
  }

  const panel = document.getElementById("notification-panel");

  if (panel) {
    panel.classList.add("hidden");
  }

  showToast("Đã đánh dấu đọc thông báo.");
}


/* =========================
   6. AUTHENTICATION
========================= */

function getLoginFields(form) {
  const usernameInput = form.querySelector(
    '[name="username"],' +
    '[name="email"],' +
    '#username,' +
    '#login-username,' +
    '#loginUsername'
  );

  const passwordInput = form.querySelector(
    '[name="password"],' +
    '#password,' +
    '#login-password,' +
    '#loginPassword'
  );

  return {
    usernameInput,
    passwordInput
  };
}


async function loginUser(event) {
  event.preventDefault();

  if (DEMO_MODE) {
    showToast("Chức năng đăng nhập đang ở chế độ DEMO.");
    return;
  }

  const form = event.currentTarget;

  const {
    usernameInput,
    passwordInput
  } = getLoginFields(form);

  if (!usernameInput || !passwordInput) {
    showToast("Không tìm thấy ô tài khoản hoặc mật khẩu.");
    console.error("Login form fields not found:", form);
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showToast("Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');

  const originalText = submitButton
    ? submitButton.textContent
    : "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Đang đăng nhập...";
  }

  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!result.token) {
      throw new Error("Máy chủ không trả về token đăng nhập.");
    }

    setToken(result.token);

    currentUser = await apiRequest("/api/user/me");

    updateUserInterface(currentUser);

    showToast(
      `Đăng nhập thành công. Xin chào ${currentUser.username}!`
    );

    closeLoginModal();

    setTimeout(() => {
      window.location.reload();
    }, 700);

  } catch (error) {
    console.error("Login error:", error);

    setToken(null);
    currentUser = null;

    showToast(error.message || "Đăng nhập thất bại.");

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}


/* =========================
   7. REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const usernameInput = form.querySelector(
    '[name="username"], #register-username, #username'
  );

  const passwordInput = form.querySelector(
    '[name="password"], #register-password, #password'
  );

  if (!usernameInput || !passwordInput) {
    showToast("Không tìm thấy trường đăng ký.");
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showToast("Vui lòng nhập đầy đủ thông tin.");
    return;
  }

  if (password.length < 10) {
    showToast("Mật khẩu cần có ít nhất 10 ký tự.");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  const originalText = submitButton?.textContent || "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Đang tạo tài khoản...";
  }

  try {
    const result = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!result.token) {
      throw new Error("Đăng ký thành công nhưng không nhận được token.");
    }

    setToken(result.token);

    currentUser = await apiRequest("/api/user/me");

    updateUserInterface(currentUser);

    showToast("Đăng ký tài khoản thành công!");

    setTimeout(() => {
      window.location.reload();
    }, 700);

  } catch (error) {
    console.error("Register error:", error);
    showToast(error.message || "Không thể đăng ký.");

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}


/* =========================
   8. USER SESSION
========================= */

async function loadCurrentUser() {
  if (!getToken()) {
    currentUser = null;
    updateUserInterface(null);
    return null;
  }

  try {
    currentUser = await apiRequest("/api/user/me");

    updateUserInterface(currentUser);

    return currentUser;

  } catch (error) {
    console.error("Session validation failed:", error);

    setToken(null);
    currentUser = null;

    updateUserInterface(null);

    return null;
  }
}


function updateUserInterface(user) {
  const loggedIn = Boolean(user);

  document.querySelectorAll("[data-user-logged-in]").forEach(el => {
    el.classList.toggle("hidden", !loggedIn);
  });

  document.querySelectorAll("[data-user-logged-out]").forEach(el => {
    el.classList.toggle("hidden", loggedIn);
  });

  document.querySelectorAll("[data-user-name]").forEach(el => {
    el.textContent = user ? user.username : "";
  });

  document.querySelectorAll("[data-user-balance]").forEach(el => {
    el.textContent = user ? money(user.balance) : money(0);
  });

  document.querySelectorAll("[data-user-id]").forEach(el => {
    el.textContent = user ? user.id : "";
  });
}


function logoutUser() {
  setToken(null);
  currentUser = null;

  updateUserInterface(null);

  showToast("Đã đăng xuất tài khoản.");

  setTimeout(() => {
    window.location.reload();
  }, 500);
}


/* =========================
   9. LOGIN MODAL
========================= */

function openLoginModal() {
  const modal = document.getElementById("login-modal");

  if (modal) {
    modal.classList.remove("hidden");
  }
}


function closeLoginModal() {
  const modal = document.getElementById("login-modal");

  if (modal) {
    modal.classList.add("hidden");
  }
}


/* =========================
   10. BUY MODAL
========================= */

function openBuyModal() {
  const modal = document.getElementById("buy-modal");

  if (modal) {
    modal.classList.remove("hidden");
  }
}


function closeBuyModal() {
  const modal = document.getElementById("buy-modal");

  if (modal) {
    modal.classList.add("hidden");
  }
}


function changeQuantity(delta) {
  const input = document.getElementById("buy-quantity");

  if (!input) return;

  input.value = Math.max(
    1,
    Math.min(20, Number(input.value || 1) + delta)
  );

  updateBuyTotal();
}


function updateBuyTotal() {
  const input = document.getElementById("buy-quantity");
  const total = document.getElementById("buy-total");

  if (input && total) {
    total.textContent = money(
      Number(input.value || 1) * 25000
    );
  }
}


/* =========================
   11. PURCHASE
========================= */

async function confirmDemoPurchase() {
  closeBuyModal();

  if (!getToken()) {
    showToast("Vui lòng đăng nhập trước khi mua hàng.");
    openLoginModal();
    return;
  }

  showToast(
    "Chức năng mua hàng đang chờ tích hợp danh mục và kho tài khoản."
  );
}


/* =========================
   12. COPY
========================= */

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      showToast("Đã sao chép.");
    } else {
      showToast("Trình duyệt không hỗ trợ sao chép tự động.");
    }
  } catch (error) {
    console.error("Copy error:", error);
    showToast("Không thể sao chép tự động.");
  }
}


/* =========================
   13. API HEALTH CHECK
========================= */

async function checkBackendHealth() {
  try {
    const result = await apiRequest("/api/health");

    console.info("Random5s Backend connected:", result);

    document.querySelectorAll("[data-api-status]").forEach(el => {
      el.textContent = "Online";
      el.dataset.status = "online";
    });

    return true;

  } catch (error) {
    console.error("Random5s Backend unavailable:", error);

    document.querySelectorAll("[data-api-status]").forEach(el => {
      el.textContent = "Offline";
      el.dataset.status = "offline";
    });

    return false;
  }
}


/* =========================
   14. EVENT LISTENERS
========================= */

document.addEventListener("click", closeNotifications);


document.addEventListener("DOMContentLoaded", async () => {

  /* Theme */
  initTheme();

  document.querySelectorAll("[data-theme-toggle]").forEach(el => {
    el.addEventListener("click", toggleTheme);
  });


  /* Notifications */
  document.querySelectorAll("[data-notifications]").forEach(el => {
    el.addEventListener("click", toggleNotifications);
  });

  document.querySelectorAll("[data-mark-read]").forEach(el => {
    el.addEventListener("click", markNotificationsRead);
  });


  /* Login */
  document.querySelectorAll("[data-login-form]").forEach(form => {
    form.addEventListener("submit", loginUser);
  });

  document.querySelectorAll("[data-register-form]").forEach(form => {
    form.addEventListener("submit", registerUser);
  });

  document.querySelectorAll("[data-login-open]").forEach(el => {
    el.addEventListener("click", openLoginModal);
  });

  document.querySelectorAll("[data-login-close]").forEach(el => {
    el.addEventListener("click", closeLoginModal);
  });

  document.querySelectorAll("[data-logout]").forEach(el => {
    el.addEventListener("click", logoutUser);
  });


  /* Buy modal */
  document.querySelectorAll("[data-buy-open]").forEach(el => {
    el.addEventListener("click", openBuyModal);
  });

  document.querySelectorAll("[data-buy-close]").forEach(el => {
    el.addEventListener("click", closeBuyModal);
  });

  document.querySelectorAll("[data-qty-minus]").forEach(el => {
    el.addEventListener("click", () => changeQuantity(-1));
  });

  document.querySelectorAll("[data-qty-plus]").forEach(el => {
    el.addEventListener("click", () => changeQuantity(1));
  });

  document.querySelectorAll("[data-buy-confirm]").forEach(el => {
    el.addEventListener("click", confirmDemoPurchase);
  });


  /* Copy */
  document.querySelectorAll("[data-copy]").forEach(el => {
    el.addEventListener("click", () => {
      copyText(el.dataset.copy);
    });
  });


  /* Quantity */
  const qty = document.getElementById("buy-quantity");

  if (qty) {
    qty.addEventListener("input", updateBuyTotal);
  }


  /* Current year */
  const year = document.getElementById("current-year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }


  /* Backend */
  await checkBackendHealth();

  /* Restore session */
  await loadCurrentUser();

});


/* =========================
   15. GLOBAL FUNCTIONS
========================= */

window.Random5s = {
  apiRequest,
  getToken,
  setToken,
  loginUser,
  registerUser,
  loadCurrentUser,
  logoutUser,
  openLoginModal,
  closeLoginModal,
  openBuyModal,
  closeBuyModal,
  checkBackendHealth
};
