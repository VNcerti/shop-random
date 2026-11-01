/* Random5s Frontend - Clean Ocean Blue UI, Center Alert Modal & Auto-Bank Gateway */
"use strict";

const API_BASE_URL = "https://api.random5s.site";
const TOKEN_KEY = "random5s_token";
const THEME_KEY = "random5s_theme";
let currentUser = null;
let selectedPackage = null;
let buyQuantityValidationVisible = false;
let depositCountdownTimer = null;
let depositPollTimer = null;
let activeDepositCode = null;
let depositSuccessShown = false;

const money = value => new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";

// Chuyển trạng thái hệ thống sang tiếng Việt trước khi hiển thị cho khách.
function statusLabel(value) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();
  const labels = {
    paid: "Đã thanh toán",
    expired: "Hết hạn",
    pending: "Chờ thanh toán",
    completed: "Hoàn tất",
    complete: "Hoàn tất",
    success: "Thành công",
    successful: "Thành công",
    failed: "Thất bại",
    cancelled: "Đã hủy",
    canceled: "Đã hủy",
    processing: "Đang xử lý",
    refunded: "Đã hoàn tiền",
    waiting: "Đang chờ xử lý",
    active: "Đang hoạt động",
    inactive: "Không hoạt động"
  };
  return labels[key] || raw || "Chưa xác định";
}
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = token => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

/* 1. Corner Toast (Only for quick subtle actions like Copy) */
function showToast(message) {
  let node = document.getElementById("toast");
  if (!node) {
    node = document.createElement("div");
    node.id = "toast";
    node.className = "toast hidden";
    document.body.appendChild(node);
  }
  node.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHTML(message)}</span>`;
  node.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => node.classList.add("hidden"), 2400);
}

/* 2. Centered Modal Alert (For errors, warnings, purchase & login alerts) */
function ensureCenterAlertModal() {
  let modal = document.getElementById("center-alert-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "center-alert-modal";
  modal.className = "modal-backdrop hidden";
  modal.innerHTML = `
    <div class="center-alert-card" role="alertdialog" aria-modal="true">
      <div id="center-alert-icon" class="center-alert-icon info"><i class="fa-solid fa-circle-info"></i></div>
      <h3 id="center-alert-title" class="center-alert-title">Thông báo</h3>
      <p id="center-alert-msg" class="center-alert-msg"></p>
      <div class="center-alert-actions">
        <button type="button" id="center-alert-secondary" class="btn btn-soft hidden">Đóng</button>
        <button type="button" id="center-alert-ok" class="btn btn-primary">Đã hiểu</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest("#center-alert-ok") || e.target.closest("#center-alert-secondary")) {
      modal.classList.add("hidden");
    }
  });
  return modal;
}

function showCenterAlert(message, type = "error", title = "") {
  const modal = ensureCenterAlertModal();
  const iconBox = document.getElementById("center-alert-icon");
  const titleEl = document.getElementById("center-alert-title");
  const msgEl = document.getElementById("center-alert-msg");

  const config = {
    error: { icon: "fa-solid fa-circle-xmark", title: title || "Thông báo lỗi" },
    warning: { icon: "fa-solid fa-circle-exclamation", title: title || "Lưu ý" },
    success: { icon: "fa-solid fa-circle-check", title: title || "Thành công" },
    info: { icon: "fa-solid fa-circle-info", title: title || "Thông báo" }
  }[type] || { icon: "fa-solid fa-circle-info", title: title || "Thông báo" };

  iconBox.className = `center-alert-icon ${type}`;
  iconBox.innerHTML = `<i class="${config.icon}"></i>`;
  titleEl.textContent = config.title;
  msgEl.textContent = message;
  const primary = document.getElementById("center-alert-ok");
  const secondary = document.getElementById("center-alert-secondary");
  primary.textContent = "Đã hiểu";
  primary.onclick = null;
  secondary.classList.add("hidden");
  secondary.textContent = "Đóng";
  secondary.onclick = null;
  modal.classList.remove("hidden");
}

function showActionAlert(message, title, primaryLabel, primaryAction, secondaryLabel = "Đóng", type = "success") {
  const modal = ensureCenterAlertModal();
  const alertIcon = document.getElementById("center-alert-icon");
  const isError = type === "error";
  alertIcon.className = `center-alert-icon ${isError ? "error" : "success"}`;
  alertIcon.innerHTML = `<i class="fa-solid ${isError ? "fa-circle-xmark" : "fa-circle-check"}"></i>`;
  document.getElementById("center-alert-title").textContent = title;
  document.getElementById("center-alert-msg").textContent = message;
  const primary = document.getElementById("center-alert-ok");
  const secondary = document.getElementById("center-alert-secondary");
  primary.textContent = primaryLabel;
  primary.onclick = () => { modal.classList.add("hidden"); if (typeof primaryAction === "function") primaryAction(); };
  secondary.textContent = secondaryLabel;
  secondary.classList.remove("hidden");
  secondary.onclick = () => modal.classList.add("hidden");
  modal.classList.remove("hidden");
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error("Không kết nối được máy chủ Backend API. Vui lòng thử lại sau.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && getToken()) {
      setToken(null);
      updateAccountUI(null);
    }
    const error = new Error(data.error || data.message || `Lỗi máy chủ (HTTP ${response.status})`);
    error.data = data;
    throw error;
  }
  return data;
}

/* Theme & Header */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved ? saved === "dark" : false;
  document.documentElement.classList.toggle("dark", dark);
  updateThemeButton();
}

function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  updateThemeButton();
  showToast(dark ? "Đã bật giao diện tối" : "Đã bật giao diện sáng");
}

function updateThemeButton() {
  document.querySelectorAll("[data-theme-toggle]").forEach(el => {
    el.innerHTML = document.documentElement.classList.contains("dark")
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  });
}

function toggleNotifications() {
  document.getElementById("notification-panel")?.classList.toggle("hidden");
}

function closeNotifications(event) {
  const panel = document.getElementById("notification-panel");
  if (panel && !panel.contains(event.target) && !event.target.closest("[data-notifications]")) {
    panel.classList.add("hidden");
  }
}

function markNotificationsRead() {
  document.getElementById("notification-dot")?.classList.add("hidden");
  document.getElementById("notification-panel")?.classList.add("hidden");
  showToast("Đã đánh dấu đã đọc");
}

function updateSharedHeader(user) {
  document.querySelectorAll("[data-balance-chip]").forEach(el => {
    const span = el.querySelector("[data-balance-text]");
    const label = user ? money(user.balance) : "0đ · Nạp tiền";
    if (span) span.textContent = label;
    else el.textContent = label;
  });
}

/* Auth & Session */
function stopDepositTimersAndResetGateway() {
  clearInterval(depositCountdownTimer);
  clearInterval(depositPollTimer);
  depositCountdownTimer = null;
  depositPollTimer = null;
  activeDepositCode = null;
  depositSuccessShown = false;
  const gatewaySection = document.getElementById("deposit-gateway-section");
  if (gatewaySection) {
    gatewaySection.classList.add("hidden");
    gatewaySection.innerHTML = "";
  }
}

function updateDepositAuthUI(user) {
  const isLoggedIn = !!(user && getToken());
  document.documentElement.classList.toggle("has-token", isLoggedIn);
  document.documentElement.classList.toggle("no-token", !isLoggedIn);

  const guestPrompt = document.getElementById("deposit-guest-prompt");
  const createSection = document.getElementById("deposit-create-section");
  const gatewaySection = document.getElementById("deposit-gateway-section");
  const historySection = document.getElementById("deposit-history-section");
  const historyHost = document.getElementById("deposit-history");

  if (!guestPrompt && !createSection && !historySection) return;

  if (!isLoggedIn) {
    stopDepositTimersAndResetGateway();
    if (createSection) createSection.classList.add("hidden");
    if (historySection) historySection.classList.add("hidden");
    if (guestPrompt) guestPrompt.classList.remove("hidden");
    if (historyHost) historyHost.innerHTML = "";
    const form = document.getElementById("deposit-form");
    if (form) form.reset();
    document.querySelectorAll("[data-quick-amount]").forEach(b => b.classList.remove("active"));
  } else {
    if (guestPrompt) guestPrompt.classList.add("hidden");
    if (historySection) historySection.classList.remove("hidden");
    const hasActiveGateway = !!(activeDepositCode && gatewaySection && !gatewaySection.classList.contains("hidden"));
    if (createSection) createSection.classList.toggle("hidden", hasActiveGateway);
    if (gatewaySection && !hasActiveGateway) gatewaySection.classList.add("hidden");
  }
}

function updateAccountPanel(user) {
  renderAccountPanel(user);
}

function updateAccountUI(user) {
  currentUser = user || null;
  updateSharedHeader(currentUser);
  renderAccountPanel(currentUser);
  updateDepositAuthUI(currentUser);
}

async function loadCurrentUser() {
  if (!getToken()) {
    updateAccountUI(null);
    return null;
  }
  try {
    const user = await apiRequest("/api/user/me");
    updateAccountUI(user);
    return user;
  } catch (error) {
    setToken(null);
    updateAccountUI(null);
    return null;
  }
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.authTab === tab);
  });
  document.getElementById("login-form")?.classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form")?.classList.toggle("hidden", tab !== "register");
}

/* Account Page Toggle: Hide Login/Register card completely when logged in */
function renderAccountPanel(user) {
  const authPanel = document.getElementById("account-auth-panel");
  const signedPanel = document.getElementById("account-signed-panel");
  if (authPanel) authPanel.classList.toggle("hidden", !!user);
  if (signedPanel) signedPanel.classList.toggle("hidden", !user);
}

function renderAccountDetails(user, orders) {
  const host = document.getElementById("account-details");
  if (!host || !user) return;
  host.innerHTML = `
    <div class="profile-top">
      <img class="profile-avatar-image" src="https://i.pinimg.com/736x/d0/ab/09/d0ab09962dce5ada721bcc1180d32f19.jpg" alt="Random5s avatar">
      <div class="profile-identity"><strong>${escapeHTML(user.username)}</strong>
        <div class="tiny muted">Thành viên Random5s · ID #${Number(user.public_id || user.id)}</div></div>
    </div>
    <div class="info-row account-info-card"><div><small>Số dư khả dụng</small><strong style="color:var(--green);font-size:16px">${money(user.balance)}</strong></div>
      <a href="add-funds.html" class="btn btn-primary"><i class="fa-solid fa-wallet"></i> Nạp thêm</a></div>
    <div class="info-row account-info-card"><div><small>Đơn hàng đã mua</small><strong>${Number(orders?.length || 0)} đơn hàng</strong></div>
      <a href="history.html" class="btn btn-soft"><i class="fa-solid fa-clock-rotate-left"></i> Xem lịch sử</a></div>
    <div class="account-actions-row">
      <button class="btn btn-soft" id="account-change-password"><i class="fa-solid fa-key"></i> Đổi mật khẩu</button>
      <button class="btn btn-danger" id="account-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
    </div>`;
  document.getElementById("account-logout")?.addEventListener("click", logoutUser);
  document.getElementById("account-change-password")?.addEventListener("click", openChangePassword);
}

function openChangePassword() {
  let modal = document.getElementById("change-password-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "change-password-modal";
    modal.className = "modal-backdrop hidden";
    modal.innerHTML = `<div class="modal account-password-modal"><div class="modal-head"><h3>Đổi mật khẩu</h3><button class="icon-btn" type="button" data-password-close aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>
      <form id="change-password-form" class="modal-body"><div class="form-field"><label>Mật khẩu hiện tại</label><input name="current_password" type="password" autocomplete="current-password" required></div>
      <div class="form-field"><label>Mật khẩu mới</label><input name="new_password" type="password" minlength="10" autocomplete="new-password" required><small class="tiny muted">Tối thiểu 10 ký tự.</small></div>
      <div class="form-field"><label>Nhập lại mật khẩu mới</label><input name="confirm_password" type="password" minlength="10" autocomplete="new-password" required></div>
      <button class="btn btn-primary btn-block" type="submit">Lưu mật khẩu mới</button></form></div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-password-close]").addEventListener("click", () => modal.classList.add("hidden"));
    modal.querySelector("#change-password-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const current_password = form.elements.current_password.value;
      const new_password = form.elements.new_password.value;
      if (new_password !== form.elements.confirm_password.value) return showCenterAlert("Mật khẩu nhập lại không khớp.", "warning", "Kiểm tra mật khẩu");
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try {
        await apiRequest("/api/auth/change-password", {method:"POST", body:JSON.stringify({current_password,new_password})});
        form.reset(); modal.classList.add("hidden"); showCenterAlert("Mật khẩu của bạn đã được cập nhật.", "success", "Đổi mật khẩu thành công");
      } catch (error) { showCenterAlert(error.message, "error", "Không thể đổi mật khẩu"); }
      finally { button.disabled = false; }
    });
  }
  modal.classList.remove("hidden");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.elements.username?.value.trim();
  const password = form.elements.password?.value || "";
  if (!username || !password) {
    return showCenterAlert("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", "warning", "Thiếu thông tin");
  }
  const button = form.querySelector('[type="submit"]');
  const oldText = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = "Đang xác thực..."; }
  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    if (!result.token) throw new Error("Máy chủ không trả về phiên đăng nhập.");
    setToken(result.token);
    const user = await apiRequest("/api/user/me");
    updateAccountUI(user);
    form.reset();
    await refreshPageData();
    // Đăng nhập thành công: không hiển thị alert gây gián đoạn.
  } catch (error) {
    setToken(null);
    updateAccountUI(null);
    showCenterAlert(error.message || "Sai tên đăng nhập hoặc mật khẩu.", "error", "Đăng nhập thất bại");
  } finally {
    if (button) { button.disabled = false; button.innerHTML = oldText; }
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = String(form.elements.username?.value ?? "").trim();
  const password = String(form.elements.password?.value ?? "");

  // Kiểm tra riêng từng trường để người dùng nhận đúng thông báo.
  // Chỉ chấp nhận chữ cái ASCII không dấu và chữ số; không dấu cách/ký tự đặc biệt.
  if (!/^[A-Za-z0-9]{3,40}$/.test(username)) {
    return showCenterAlert(
      "Tài khoản không hợp lệ vui lòng đăng ký tên đăng nhập không dùng ký tự đặc biệt, viết có dấu. Mẫu minh họa hợp lệ: Random5s",
      "warning",
      "Tài khoản không hợp lệ"
    );
  }

  if (password.length < 6) {
    return showCenterAlert(
      "Mật khẩu của bạn quá yếu vui lòng nhập mật khẩu 6 ký tự trở lên để bảo mật thông tin.",
      "warning",
      "Đăng ký thất bại"
    );
  }
  const button = form.querySelector('[type="submit"]');
  const oldText = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = "Đang khởi tạo..."; }
  try {
    const result = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    if (!result.token) throw new Error("Máy chủ không trả về phiên đăng nhập.");
    setToken(result.token);
    const user = await apiRequest("/api/user/me");
    updateAccountUI(user);
    form.reset();
    await refreshPageData();
    showCenterAlert(`Tài khoản ${user.username} đã được tạo và tự động đăng nhập!`, "success", "Đăng ký thành công");
  } catch (error) {
    showCenterAlert(error.message || "Không thể tạo tài khoản. Tên đăng nhập có thể đã tồn tại.", "error", "Đăng ký thất bại");
  } finally {
    if (button) { button.disabled = false; button.innerHTML = oldText; }
  }
}

function logoutUser() {
  stopDepositTimersAndResetGateway();
  setToken(null);
  updateAccountUI(null);
  const accountDetails = document.getElementById("account-details");
  if (accountDetails) accountDetails.innerHTML = "";
  if (document.getElementById("history-content")) loadHistory();
  if (document.getElementById("deposit-history")) loadDeposits();
  showToast("Đã đăng xuất");
}

/* Products */
function renderProducts(items) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  if (!Array.isArray(items) || !items.length) {
    grid.innerHTML = '<div class="panel empty-state"><i class="fa-solid fa-box-open"></i><h3>Chưa có gói sản phẩm</h3><p class="tiny">Hiện chưa có gói túi mù nào đang mở bán.</p></div>';
    return;
  }
  grid.innerHTML = items.map(pkg => {
    const remain = pkg.remaining_count ?? pkg.stock_count ?? 142;
    const sold = pkg.sold_count ?? 1285;
    const bannerImg = pkg.cover_image
      ? (String(pkg.cover_image).startsWith("http") ? pkg.cover_image : `${API_BASE_URL}${pkg.cover_image}`)
      : (pkg.banner_url || "https://randomfc.com/assets/storage/images/products/R9H23NKZ.png");
    const iconImg = pkg.category_logo || "https://shopngocbach.com/assets/storage/images/categoryV0JC.png";
    const rawDescriptions = Array.isArray(pkg.descriptions)
      ? pkg.descriptions
      : String(pkg.description || "").split(/\r?\n/);
    const features = rawDescriptions.map(line => String(line || "").trim()).filter(Boolean);
    return `
      <article class="product-card">
        <div class="product-top">
          <div class="product-top-left">
            <img class="product-icon" src="${escapeHTML(iconImg)}" alt="icon" loading="lazy">
            <h3 class="product-name">${escapeHTML(pkg.name)}</h3>
          </div>
          <span class="stock-pill">Sẵn hàng</span>
        </div>
        <div class="product-banner">
          <img src="${escapeHTML(bannerImg)}" alt="${escapeHTML(pkg.name)}" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="product-body">
          ${features.length ? `<div class="feature-list">${features.map(line => `<div><i class="fa-solid fa-circle-check"></i><span>${escapeHTML(line)}</span></div>`).join("")}</div>` : ""}
          <div class="metrics">
            <div class="metric price"><span>Giá</span><strong>${money(pkg.price)}</strong></div>
            <div class="metric"><span>Số lượng còn lại</span><strong>${ new Intl.NumberFormat("vi-VN").format(Number(remain)) }</strong></div>
            <div class="metric"><span>Số lượng đã bán</span><strong>${ new Intl.NumberFormat("vi-VN").format(Number(sold)) }</strong></div>
          </div>
          <button class="btn btn-primary btn-block" data-select-package="${Number(pkg.id)}">
            <i class="fa-solid fa-bag-shopping"></i> MUA NGAY
          </button>
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll("[data-select-package]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pkg = items.find(x => Number(x.id) === Number(btn.dataset.selectPackage));
      if (pkg) openBuyModal(pkg);
    });
  });
}

async function loadPackages() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  try {
    const data = await apiRequest("/api/packages");
    renderProducts(data.items || []);
  } catch (error) {
    grid.innerHTML = `<div class="panel empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tải được danh sách gói</h3><p class="tiny">${escapeHTML(error.message)}</p></div>`;
  }
}

/* Purchase Flow */
function updateBuyQuantitySummary() {
  if (!selectedPackage) return;
  const input = document.getElementById("buy-quantity");
  const note = document.getElementById("buy-quantity-note");
  const total = document.getElementById("buy-total-price");
  const confirm = document.getElementById("buy-confirm");
  const min = Math.max(1, Number(selectedPackage.min_quantity || 1));
  const stock = Math.max(0, Number(selectedPackage.remaining_count || 0));
  const raw = String(input?.value ?? "").trim();
  const qty = raw === "" ? 0 : Number(raw);
  if (input) {
    input.min = "1";
    input.max = String(Math.min(stock, 100));
  }
  let message = "";
  // Chỉ hiện lỗi sau khi khách đã bấm xác nhận; ô trống ban đầu luôn sạch.
  if (buyQuantityValidationVisible && raw !== "") {
    if (!Number.isInteger(qty) || qty < min) message = `Mua tối thiểu ${min}`;
    else if (qty > stock) message = `Kho hiện chỉ còn ${stock} tài khoản`;
    else if (qty > 100) message = "Mỗi lần chỉ mua tối đa 100 tài khoản";
  }
  if (note) {
    note.textContent = message;
    note.classList.toggle("hidden", !message);
  }
  if (total) total.textContent = qty > 0 && Number.isFinite(qty)
    ? money(Number(selectedPackage.price || 0) * qty) : "—";
  // Luôn cho phép bấm để kích hoạt kiểm tra và hiển thị hướng dẫn đúng lúc.
  // Trong lúc gửi đơn, nút sẽ được khóa riêng ở confirmPurchase().
  if (confirm && confirm.dataset.submitting !== "true") confirm.disabled = false;
}

function openBuyModal(pkg) {
  selectedPackage = pkg;
  buyQuantityValidationVisible = false;
  const modal = document.getElementById("buy-modal");
  if (!modal) return;
  const nameEl = document.getElementById("buy-package-name");
  const quantity = document.getElementById("buy-quantity");
  if (nameEl) nameEl.textContent = pkg.name;
  if (quantity) {
    quantity.value = "";
    quantity.min = "1";
    quantity.max = String(Math.min(Number(pkg.remaining_count || 0), 100));
  }
  updateBuyQuantitySummary();
  modal.classList.remove("hidden");
  setTimeout(() => quantity?.focus(), 80);
}

function closeBuyModal() {
  document.getElementById("buy-modal")?.classList.add("hidden");
}

async function confirmPurchase() {
  if (!selectedPackage) return;
  if (!getToken()) {
    closeBuyModal();
    showCenterAlert("Vui lòng đăng nhập tài khoản trước khi mua túi mù.", "warning", "Yêu cầu đăng nhập");
    setTimeout(() => { location.href = "account.html"; }, 1200);
    return;
  }
  const quantityRaw = String(document.getElementById("buy-quantity")?.value ?? "").trim();
  const quantity = quantityRaw === "" ? 0 : Number(quantityRaw);
  const minimum = Math.max(1, Number(selectedPackage.min_quantity || 1));
  const available = Number(selectedPackage.remaining_count || 0);
  if (!Number.isInteger(quantity) || quantity < minimum) {
    buyQuantityValidationVisible = true;
    updateBuyQuantitySummary();
    document.getElementById("buy-quantity")?.focus();
    return;
  }
  if (quantity > available || quantity > 100) {
    updateBuyQuantitySummary();
    return showCenterAlert(`Số lượng tối đa hiện có là ${Math.min(available, 100)} tài khoản.`, "warning", "Số lượng không hợp lệ");
  }
  const button = document.getElementById("buy-confirm");
  if (button) { button.disabled = true; button.dataset.submitting = "true"; button.textContent = "Đang xử lý đơn hàng..."; }
  try {
    const result = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({ package_id: Number(selectedPackage.id), quantity })
    });
    closeBuyModal();
    await loadCurrentUser();
    await loadPackages();
    showActionAlert(`Bạn đã mua thành công ${result.order?.quantity || quantity} tài khoản với mức giá ${money(result.order?.amount)}. Cảm ơn bạn đã ủng hộ hệ thống!`,
      "THANH TOÁN THÀNH CÔNG", "Xem tài khoản", () => { location.href = "history.html"; }, "Đóng");
  } catch (error) {
    closeBuyModal();
    if (String(error.message || "").includes("Số dư không đủ")) {
      showActionAlert(error.message, "Không thể mua gói", "Nạp tiền ngay", () => { location.href = "add-funds.html"; }, "Đóng", "error");
    } else showCenterAlert(error.message || "Số dư không đủ hoặc gói vừa hết hàng.", "error", "Không thể mua gói");
  } finally {
    if (button) { button.disabled = false; delete button.dataset.submitting; button.innerHTML = '<i class="fa-solid fa-check"></i> Xác nhận mua ngay'; }
  }
}

/* History */
function ensurePurchaseDetailModal() {
  let modal = document.getElementById("purchase-detail-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "purchase-detail-modal";
  modal.className = "purchase-detail-backdrop hidden";
  modal.innerHTML = `<section class="purchase-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title">
    <header class="purchase-detail-head"><div><h2 id="purchase-detail-title">Chi tiết tài khoản</h2><p id="purchase-detail-subtitle"></p></div><button type="button" class="purchase-detail-close" aria-label="Đóng">×</button></header>
    <div id="purchase-detail-list" class="purchase-detail-list"></div>
    <footer class="purchase-detail-foot"><button type="button" class="btn btn-soft" id="copy-all-purchased"><i class="fa-regular fa-copy"></i> Sao chép tất cả</button><button type="button" class="btn btn-primary" id="close-purchase-detail">Đóng</button></footer>
  </section>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.add("hidden");
  modal.querySelector(".purchase-detail-close").addEventListener("click", close);
  modal.querySelector("#close-purchase-detail").addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  return modal;
}

function openPurchaseDetails(order) {
  const modal = ensurePurchaseDetailModal();
  const accounts = Array.isArray(order.accounts) ? order.accounts : [];
  const formatAccount = a => {
    const p = a.parsed_data || {};
    const raw = String(a.account_data || "");
    let username = p.username || "";
    let password = p.password || "";
    if ((!username || !password) && raw.includes(":")) {
      const first = raw.replace(/^\s*FINAL\s*=\s*/i, "").split("|")[0];
      const pair = first.split(":");
      username = username || (pair.shift() || "").trim();
      password = password || pair.join(":").trim();
    }
    const heroes = p.heroes ?? p["Tướng"] ?? "";
    const skins = p.skins ?? p["Skin"] ?? "";
    return [
      `${username} | ${password}`,
      `Tướng : ${heroes || "—"} | Trang phục : ${skins || "—"}`
    ].join("\n");
  };
  const credentialLine = a => formatAccount(a).split(/\r?\n/)[0].trim();
  const allText = accounts.map((a, i) => `Acc ${i + 1}\n${credentialLine(a)}`).join("\n\n");
  document.getElementById("purchase-detail-title").textContent = `Chi tiết đơn #${order.id}`;
  document.getElementById("purchase-detail-subtitle").textContent = `${order.quantity || accounts.length} tài khoản · ${money(order.amount)} · ${order.created_at || ""}`;
  const host = document.getElementById("purchase-detail-list");
  host.innerHTML = accounts.map((a, i) => `<article class="purchased-account-card"><div class="purchased-account-top"><strong>Acc ${i + 1}</strong><button type="button" class="btn-copy-pill" data-copy-account="${i}"><i class="fa-regular fa-copy"></i> Sao chép</button></div><pre>${escapeHTML(formatAccount(a))}</pre></article>`).join("");
  host.querySelectorAll("[data-copy-account]").forEach(btn => btn.addEventListener("click", () => {
    const a = accounts[Number(btn.dataset.copyAccount)]; if (a) copyText(credentialLine(a));
  }));
  document.getElementById("copy-all-purchased").onclick = () => copyText(allText);
  modal.classList.remove("hidden");
}

async function loadHistory() {
  const host = document.getElementById("history-content");
  if (!host) return;
  const heading = document.getElementById("history-page-heading");
  const securityNote = document.querySelector(".history-security-note");
  const loggedIn = !!getToken();
  heading?.classList.toggle("hidden", !loggedIn);
  securityNote?.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) {
    host.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><h3>Bạn chưa đăng nhập</h3><p class="tiny">Vui lòng đăng nhập để xem các túi mù đã mở.</p><a class="btn btn-primary" style="margin-top:8px" href="account.html">Đăng nhập ngay</a></div>';
    return;
  }
  try {
    const data = await apiRequest("/api/orders");
    const items = data.items || [];
    if (!items.length) {
      host.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>Chưa có đơn hàng nào</h3><p class="tiny">Các túi mù bạn mua sẽ hiển thị tại đây.</p></div>';
      return;
    }
    host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã giao dịch</th><th>Gói sản phẩm</th><th>Số lượng</th><th>Thanh toán</th><th>Tài khoản nhận được</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>${items.map(o => `
      <tr><td><strong>#${Number(o.id)}</strong></td><td>${escapeHTML(o.package_name || `Gói #${Number(o.package_id)}`)}</td><td><strong>${Number(o.quantity || o.accounts?.length || 1)} acc</strong></td><td><strong class="history-amount">${money(o.amount)}</strong></td><td><button class="btn btn-soft btn-view-purchase" type="button" data-view-purchase="${escapeHTML(o.purchase_id || o.id)}"><i class="fa-regular fa-eye"></i> Xem chi tiết</button></td><td><span class="status status-${escapeHTML(String(o.status || "completed").toLowerCase())}">${escapeHTML(statusLabel(o.status || "completed"))}</span></td><td class="muted">${escapeHTML(o.created_at || "")}</td></tr>`).join("")}</tbody></table></div>`;
    const byId = new Map(items.map(o => [String(o.purchase_id || o.id), o]));
    host.querySelectorAll("[data-view-purchase]").forEach(btn => btn.addEventListener("click", () => {
      const order = byId.get(btn.dataset.viewPurchase); if (order) openPurchaseDetails(order);
    }));
  } catch (error) {
    host.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tải được lịch sử</h3><p class="tiny">${escapeHTML(error.message)}</p></div>`;
  }
}

/* ================= DEPOSIT & AUTO-BANK GATEWAY REPLACEMENT ================= */
function startGatewayCountdown(seconds = 900) {
  clearInterval(depositCountdownTimer);
  const timerEl = document.getElementById("gateway-countdown");
  if (!timerEl) return;
  let remaining = seconds;
  const tick = () => {
    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
    if (remaining > 0) remaining--;
    else clearInterval(depositCountdownTimer);
  };
  tick();
  depositCountdownTimer = setInterval(tick, 1000);
}

function showPaymentGatewayView(data) {
  if (!getToken() || !currentUser) {
    updateDepositAuthUI(null);
    return;
  }
  const guestPrompt = document.getElementById("deposit-guest-prompt");
  const createSection = document.getElementById("deposit-create-section");
  const gatewaySection = document.getElementById("deposit-gateway-section");
  const historySection = document.getElementById("deposit-history-section");
  if (!createSection || !gatewaySection) return;
  if (guestPrompt) guestPrompt.classList.add("hidden");
  if (historySection) historySection.classList.remove("hidden");

  clearInterval(depositPollTimer);
  activeDepositCode = getToken() ? String(data.payment_code || data.transfer_content || "") : null;
  depositSuccessShown = false;
  const payment = data.payment || {};
  const bankName = payment.bank_name || "Ngân hàng Quân Đội (MB Bank)";
  const bankShort = payment.bank_short || "MB";
  const accountName = payment.account_name || "VU TUNG LAM";
  const accountNumber = payment.account_number || "311435";
  const amount = Number(data.amount || 10000);
  const transferContent = data.transfer_content || data.payment_code || "RD5SFNJE5T";
  const qrUrl = payment.qr_url || `https://img.vietqr.io/image/MB-${encodeURIComponent(accountNumber)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

  // Hide Creation Card & Show Gateway Card
  createSection.classList.add("hidden");
  gatewaySection.classList.remove("hidden");

  gatewaySection.innerHTML = `
    <div class="gateway-card">
      <div class="gateway-header">
        <h2 class="gateway-title">NẠP QUỸ SỐ DƯ</h2>
        <div class="gateway-status-badge">
          <span class="pulse-dot"></span>
          <span>Đang chờ thanh toán...</span>
        </div>
      </div>

      <div class="gateway-body">
        <!-- Left QR Column -->
        <div class="gateway-qr-col">
          <div class="gateway-qr-Heading">
            <i class="fa-solid fa-qrcode"></i>
            <span>Quét mã QR để thanh toán nhanh</span>
          </div>
          <div class="gateway-qr-frame">
            <img src="${escapeHTML(qrUrl)}" alt="VietQR Thanh toán tự động">
          </div>
          <a href="${escapeHTML(qrUrl)}" target="_blank" rel="noopener" class="btn btn-soft gateway-qr-Save">
            <i class="fa-solid fa-download"></i> Mở / Lưu ảnh QR
          </a>
          <p class="gateway-qr-note">
            Sử dụng App Ngân hàng bất kỳ hoặc MoMo, ZaloPay, Viettel Money để quét mã.
          </p>
        </div>

        <!-- Right Bank Details Column -->
        <div class="gateway-info-col">
          <div class="gateway-bank-head">
            <div class="gateway-bank-logo"><img src="https://baobiasia.com/wp-content/uploads/2026/08/ngoi-sao-logo-mb-bank.jpg" alt="MB Bank"></div>
            <div>
              <h3>${escapeHTML(bankName)}</h3>
              <p>Chuyển khoản nhanh Napas 247 tự động</p>
            </div>
          </div>

          <div class="gateway-field">
            <div>
              <small>Chủ tài khoản</small>
              <strong>${escapeHTML(accountName)}</strong>
            </div>
          </div>

          <div class="gateway-field">
            <div>
              <small>Số tài khoản</small>
              <strong>${escapeHTML(accountNumber)}</strong>
            </div>
            <button type="button" class="btn-copy-pill" data-copy-val="${escapeHTML(accountNumber)}">
              <i class="fa-regular fa-copy"></i> Sao chép
            </button>
          </div>

          <div class="gateway-field highlight-blue">
            <div>
              <small>Số tiền cần thanh toán</small>
              <strong>${money(amount)}</strong>
            </div>
            <button type="button" class="btn-copy-pill" data-copy-val="${amount}">
              <i class="fa-regular fa-copy"></i> Sao chép
            </button>
          </div>

          <div class="gateway-field highlight-amber">
            <div>
              <small>Nội dung chuyển khoản (Bắt buộc)</small>
              <strong>${escapeHTML(transferContent)}</strong>
            </div>
            <button type="button" class="btn-copy-pill" data-copy-val="${escapeHTML(transferContent)}">
              <i class="fa-regular fa-copy"></i> Sao chép
            </button>
          </div>

          <div class="gateway-red-alert">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>
              Vui lòng giữ nguyên <strong>Nội dung CK (${escapeHTML(transferContent)})</strong> và nhập đúng <strong>Số tiền (${money(amount)})</strong> để hệ thống tự động duyệt đơn sau 5 - 30 giây.
            </div>
          </div>

          <div class="gateway-footer-bar">
            <div class="gateway-timer">
              <i class="fa-regular fa-clock"></i>
              <span>Đơn hàng hết hạn sau:</span>
              <span id="gateway-countdown">15:00</span>
            </div>
          </div>

          <div class="gateway-actions">
            <button type="button" id="gateway-check-btn" class="btn btn-primary">
              <i class="fa-solid fa-bolt"></i> Tôi đã chuyển khoản
            </button>
            <button type="button" id="gateway-reset-btn" class="btn btn-soft">
              <i class="fa-solid fa-rotate-left"></i> Tạo mã khác
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  gatewaySection.querySelectorAll("[data-copy-val]").forEach(btn => {
    btn.addEventListener("click", () => copyText(btn.dataset.copyVal));
  });

  document.getElementById("gateway-reset-btn")?.addEventListener("click", () => {
    clearInterval(depositCountdownTimer);
    clearInterval(depositPollTimer);
    activeDepositCode = null;
    gatewaySection.classList.add("hidden");
    createSection.classList.remove("hidden");
  });

  document.getElementById("gateway-check-btn")?.addEventListener("click", async () => {
    await loadCurrentUser();
    await loadDeposits();
    showCenterAlert("Hệ thống đang kiểm tra giao dịch tự động. Số dư sẽ được cộng ngay sau khi ngân hàng xác nhận (5 - 30 giây).", "info", "Đang kiểm tra giao dịch");
  });

  startGatewayCountdown(900);
  if (activeDepositCode) startDepositStatusPolling();
}

async function checkPayment() {
  if (depositSuccessShown || !activeDepositCode || !getToken()) return;
  try {
    const data = await apiRequest("/api/deposits");
    const deposit = (data.items || []).find(item => String(item.payment_code) === activeDepositCode);
    if (deposit?.status === "paid") {
      depositSuccessShown = true;
      clearInterval(depositPollTimer);
      clearInterval(depositCountdownTimer);
      await loadCurrentUser();
      await loadDeposits();
      showActionAlert(`Bạn nhận được ${money(deposit.amount)} vào tài khoản!`,
        "NẠP TIỀN THÀNH CÔNG", "Mua gói ngay", () => { location.href = "index.html"; }, "Đóng");
    }
  } catch (_) { /* Network hiccup: retry at the next interval. */ }
}

function startDepositStatusPolling() {
  clearInterval(depositPollTimer);
  if (!activeDepositCode || !getToken()) return;
  checkPayment();
  depositPollTimer = setInterval(checkPayment, 3000);
}

async function loadDeposits() {
  const host = document.getElementById("deposit-history");
  if (!host) return;
  if (!getToken() || !currentUser) {
    updateDepositAuthUI(null);
    return;
  }
  updateDepositAuthUI(currentUser);
  try {
    const data = await apiRequest("/api/deposits");
    const items = data.items || [];
    host.innerHTML = items.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã nạp</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian hết hạn</th></tr></thead><tbody>${items.map(d => `<tr><td><strong>${escapeHTML(d.payment_code)}</strong></td><td><strong style="color:var(--brand)">${money(d.amount)}</strong></td><td><span class="status status-${escapeHTML(String(d.status || "").toLowerCase())}">${escapeHTML(statusLabel(d.status))}</span></td><td class="muted">${escapeHTML(d.expires_at || "")}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Chưa có giao dịch nạp tiền</h3><p class="tiny">Các yêu cầu nạp tiền của bạn sẽ hiển thị tại đây.</p></div>';
  } catch (error) {
    if (!getToken()) {
      updateDepositAuthUI(null);
      return;
    }
    host.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tải được lịch sử nạp</h3><p class="tiny">${escapeHTML(error.message)}</p></div>`;
  }
}

async function createDeposit(event) {
  event.preventDefault();
  if (!getToken() || !currentUser) {
    updateDepositAuthUI(null);
    return;
  }
  const form = event.currentTarget;
  const amountDigits = String(form.elements.amount?.value || "").replace(/\D/g, "");
  const amount = Number(amountDigits);
  if (!Number.isSafeInteger(amount) || amount < 10000 || amount > 50000000) {
    return showCenterAlert("Vui lòng nhập số tiền nạp tối thiểu từ 10.000đ trở lên.", "warning", "Số tiền không hợp lệ");
  }

  const button = form.querySelector('[type="submit"]');
  const oldText = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = "Đang tạo mã QR..."; }

  try {
    const result = await apiRequest("/api/deposits", {
      method: "POST",
      body: JSON.stringify({ amount })
    });
    showPaymentGatewayView(result);
    await loadDeposits();
  } catch (error) {
    if (!getToken()) {
      updateDepositAuthUI(null);
      return;
    }
    showCenterAlert(error.message || "Không thể tạo yêu cầu nạp tiền lúc này.", "error", "Không thể tạo mã nạp");
  } finally {
    if (button) { button.disabled = false; button.innerHTML = oldText; }
  }
}

/* Refresh & Copy */
async function refreshPageData() {
  if (document.getElementById("account-details") && currentUser) {
    try {
      const data = await apiRequest("/api/orders");
      renderAccountDetails(currentUser, data.items || []);
    } catch {
      renderAccountDetails(currentUser, []);
    }
  }
  if (document.getElementById("history-content")) await loadHistory();
  if (document.getElementById("deposit-history")) await loadDeposits();
}

function copyText(value) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(String(value))
      .then(() => showToast("Đã sao chép thông tin tài khoản."))
      .catch(() => showCenterAlert("Trình duyệt chặn quyền sao chép tự động. Vui lòng bôi đen để copy.", "warning"));
  } else {
    showCenterAlert("Trình duyệt của bạn không hỗ trợ sao chép tự động.", "warning");
  }
}

document.addEventListener("click", closeNotifications);
window.addEventListener("storage", async event => {
  if (event.key === TOKEN_KEY) {
    if (!getToken()) {
      stopDepositTimersAndResetGateway();
      updateAccountUI(null);
      if (document.getElementById("history-content")) loadHistory();
    } else {
      await loadCurrentUser();
      await refreshPageData();
    }
  } else if (event.key === THEME_KEY) {
    initTheme();
  initPasswordVisibility();
  }
});

function initPasswordVisibility() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.visibilityReady) return;
    input.dataset.visibilityReady = "1";
    const wrap = document.createElement("div");
    wrap.className = "password-input-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-visibility-toggle";
    toggle.setAttribute("aria-label", "Hiện mật khẩu");
    toggle.setAttribute("aria-pressed", "false");
    toggle.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
    toggle.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      toggle.innerHTML = visible ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
      toggle.setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      toggle.setAttribute("aria-pressed", String(visible));
      input.focus();
    });
    wrap.appendChild(toggle);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initPasswordVisibility();
  document.querySelectorAll("[data-theme-toggle]").forEach(el => el.addEventListener("click", toggleTheme));
  document.querySelectorAll("[data-notifications]").forEach(el => el.addEventListener("click", toggleNotifications));
  document.querySelectorAll("[data-mark-read]").forEach(el => el.addEventListener("click", markNotificationsRead));
  document.querySelectorAll("[data-auth-tab]").forEach(el => el.addEventListener("click", () => switchAuthTab(el.dataset.authTab)));

  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("register-form")?.addEventListener("submit", handleRegister);
  document.getElementById("buy-confirm")?.addEventListener("click", confirmPurchase);
  document.getElementById("buy-quantity")?.addEventListener("input", updateBuyQuantitySummary);
  document.querySelectorAll("[data-buy-close]").forEach(el => el.addEventListener("click", closeBuyModal));
  document.getElementById("deposit-form")?.addEventListener("submit", createDeposit);

  // Currency input: allow any integer VND (no 1,000-VND step restriction).
  const depositAmountInput = document.getElementById("deposit-amount");
  if (depositAmountInput) {
    const formatDepositValue = () => {
      const digits = depositAmountInput.value.replace(/\D/g, "");
      depositAmountInput.value = digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) + "đ" : "";
      document.querySelectorAll("[data-quick-amount]").forEach(b => b.classList.toggle("active", digits === b.dataset.quickAmount));
    };
    depositAmountInput.addEventListener("input", formatDepositValue);
    depositAmountInput.addEventListener("focus", () => {
      depositAmountInput.value = depositAmountInput.value.replace(/\D/g, "");
      requestAnimationFrame(() => depositAmountInput.setSelectionRange(depositAmountInput.value.length, depositAmountInput.value.length));
    });
    depositAmountInput.addEventListener("blur", formatDepositValue);
  }

  // Quick amount selector on add-funds.html
  document.querySelectorAll("[data-quick-amount]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("deposit-amount");
      if (input) { input.value = new Intl.NumberFormat("vi-VN").format(Number(btn.dataset.quickAmount)) + "đ"; input.dispatchEvent(new Event("input", {bubbles:true})); }
      document.querySelectorAll("[data-quick-amount]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const year = document.getElementById("current-year");
  if (year) year.textContent = new Date().getFullYear();

  await loadCurrentUser();
  if (document.getElementById("product-grid")) await loadPackages();
  await refreshPageData();
});

window.Random5s = { apiRequest, getToken, setToken, loadCurrentUser, updateAccountUI, updateAccountPanel, logoutUser, loadPackages, loadHistory, loadDeposits, createDeposit, checkPayment, showCenterAlert };
