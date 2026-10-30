/* Random5s frontend - integrated with current Flask API */
"use strict";

const API_BASE_URL = "https://api.random5s.site";
const TOKEN_KEY = "random5s_token";
const THEME_KEY = "random5s_theme";
let currentUser = null;
let selectedPackage = null;

const money = value => new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = token => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

function showToast(message) {
  let node = document.getElementById("toast");
  if (!node) { node = document.createElement("div"); node.id = "toast"; node.className = "toast"; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => node.classList.add("hidden"), 3200);
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error("Không kết nối được Backend API. Kiểm tra mạng hoặc cấu hình CORS.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && getToken()) setToken(null);
    throw new Error(data.error || data.message || `API lỗi HTTP ${response.status}`);
  }
  return data;
}

/* Theme and shared header */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  updateThemeButton();
}
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  updateThemeButton();
}
function updateThemeButton() {
  document.querySelectorAll("[data-theme-toggle]").forEach(el => {
    el.innerHTML = document.documentElement.classList.contains("dark")
      ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  });
}
function toggleNotifications() {
  document.getElementById("notification-panel")?.classList.toggle("hidden");
}
function closeNotifications(event) {
  const panel = document.getElementById("notification-panel");
  if (panel && !panel.contains(event.target) && !event.target.closest("[data-notifications]")) panel.classList.add("hidden");
}
function markNotificationsRead() {
  document.getElementById("notification-dot")?.classList.add("hidden");
  document.getElementById("notification-panel")?.classList.add("hidden");
  showToast("Đã đánh dấu đọc thông báo.");
}
function updateSharedHeader(user) {
  document.querySelectorAll("[data-balance-chip]").forEach(el => {
    const span = el.querySelector("[data-balance-text]");
    if (span) span.textContent = user ? money(user.balance) : "Đăng nhập để xem số dư";
    else el.textContent = user ? money(user.balance) : "Đăng nhập để xem số dư";
  });
  document.querySelectorAll("[data-header-guest]").forEach(el => el.classList.toggle("hidden", !!user));
  document.querySelectorAll("[data-header-user]").forEach(el => el.classList.toggle("hidden", !user));
  document.querySelectorAll("[data-header-username]").forEach(el => el.textContent = user?.username || "");
}

/* Auth/session */
function updateAccountUI(user) {
  currentUser = user || null;
  updateSharedHeader(currentUser);
  document.querySelectorAll("[data-user-logged-in]").forEach(el => el.classList.toggle("hidden", !user));
  document.querySelectorAll("[data-user-logged-out]").forEach(el => el.classList.toggle("hidden", !!user));
  document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user?.username || "Khách");
  document.querySelectorAll("[data-user-id]").forEach(el => el.textContent = user?.id ?? "—");
  document.querySelectorAll("[data-user-balance]").forEach(el => el.textContent = user ? money(user.balance) : "—");
  document.querySelectorAll("[data-user-initial]").forEach(el => el.textContent = (user?.username || "U").slice(0,1).toUpperCase());
}
async function loadCurrentUser() {
  if (!getToken()) { updateAccountUI(null); return null; }
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
  document.querySelectorAll("[data-auth-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.authTab === tab));
  document.getElementById("login-form")?.classList.toggle("hidden", tab !== "login");
  document.getElementById("register-form")?.classList.toggle("hidden", tab !== "register");
}
async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.elements.username?.value.trim();
  const password = form.elements.password?.value || "";
  if (!username || !password) return showToast("Vui lòng nhập tên đăng nhập và mật khẩu.");
  const button = form.querySelector('[type="submit"]');
  const oldText = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Đang đăng nhập..."; }
  try {
    const result = await apiRequest("/api/auth/login", { method:"POST", body:JSON.stringify({username,password}) });
    if (!result.token) throw new Error("Backend không trả về token.");
    setToken(result.token);
    const user = await apiRequest("/api/user/me");
    updateAccountUI(user);
    showToast(`Đăng nhập thành công. Xin chào ${user.username}!`);
    form.reset();
    renderAccountPanel(user);
    await refreshPageData();
  } catch (error) {
    setToken(null); updateAccountUI(null);
    showToast(error.message || "Đăng nhập thất bại.");
  } finally {
    if (button) { button.disabled = false; button.textContent = oldText; }
  }
}
async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.elements.username?.value.trim();
  const password = form.elements.password?.value || "";
  if (!username || password.length < 10) return showToast("Tên đăng nhập cần 3–40 ký tự, mật khẩu tối thiểu 10 ký tự.");
  const button = form.querySelector('[type="submit"]');
  const oldText = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Đang tạo..."; }
  try {
    const result = await apiRequest("/api/auth/register", {method:"POST",body:JSON.stringify({username,password})});
    if (!result.token) throw new Error("Backend không trả về token.");
    setToken(result.token);
    const user = await apiRequest("/api/user/me");
    updateAccountUI(user);
    renderAccountPanel(user);
    showToast("Tạo tài khoản thành công!");
    form.reset();
    await refreshPageData();
  } catch (error) {
    showToast(error.message || "Không thể đăng ký.");
  } finally {
    if (button) { button.disabled = false; button.textContent = oldText; }
  }
}
function logoutUser() {
  setToken(null);
  updateAccountUI(null);
  showToast("Đã đăng xuất.");
  setTimeout(() => location.reload(), 450);
}
function renderAccountPanel(user) {
  const guest = document.getElementById("account-guest");
  const signed = document.getElementById("account-signed");
  if (guest) guest.classList.toggle("hidden", !!user);
  if (signed) signed.classList.toggle("hidden", !user);
}

/* Products */
function renderProducts(items) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  if (!Array.isArray(items) || !items.length) {
    grid.innerHTML = '<div class="panel empty-state"><i class="fa-solid fa-box-open"></i><h3>Chưa có gói sản phẩm</h3><p class="tiny">Hiện Backend chưa có gói nào đang mở bán.</p></div>';
    return;
  }
  grid.innerHTML = items.map(pkg => `
    <article class="product-card">
      <div class="product-top">
        <div><h3 class="product-name">${escapeHTML(pkg.name)}</h3><span class="tiny muted">${escapeHTML(pkg.description || "Túi mù tài khoản game")}</span></div>
        <span class="stock-pill">Đang bán</span>
      </div>
      <div class="product-banner"><div><i class="fa-solid fa-cube" style="font-size:35px"></i><p style="font-weight:800;font-size:12px">RANDOM5S · MYSTERY ACCOUNT</p></div></div>
      <div class="product-body">
        <div class="metrics">
          <div class="metric price"><span>Giá</span><strong>${money(pkg.price)}</strong></div>
          <div class="metric"><span>Mã gói</span><strong>#${escapeHTML(pkg.id)}</strong></div>
          <div class="metric"><span>Trạng thái</span><strong>Hoạt động</strong></div>
        </div>
        <button class="btn btn-primary btn-block" data-select-package="${Number(pkg.id)}"><i class="fa-solid fa-bag-shopping"></i> MUA NGAY</button>
      </div>
    </article>`).join("");
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
  grid.innerHTML = '<div class="panel empty-state"><i class="fa-solid fa-spinner fa-spin"></i><h3>Đang tải gói...</h3></div>';
  try {
    const data = await apiRequest("/api/packages");
    renderProducts(data.items || []);
  } catch (error) {
    grid.innerHTML = `<div class="panel empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tải được danh sách gói</h3><p class="tiny">${escapeHTML(error.message)}</p></div>`;
  }
}

/* Purchase: backend currently supports one stock item per POST /api/orders */
function openBuyModal(pkg) {
  selectedPackage = pkg;
  const modal = document.getElementById("buy-modal");
  if (!modal) return;
  document.getElementById("buy-package-name").textContent = pkg.name;
  document.getElementById("buy-package-price").textContent = money(pkg.price);
  document.getElementById("buy-total").textContent = money(pkg.price);
  modal.classList.remove("hidden");
}
function closeBuyModal() { document.getElementById("buy-modal")?.classList.add("hidden"); }
async function confirmPurchase() {
  if (!selectedPackage) return;
  if (!getToken()) { closeBuyModal(); showToast("Vui lòng đăng nhập trước khi mua."); location.href = "account.html"; return; }
  const button = document.getElementById("buy-confirm");
  if (button) { button.disabled = true; button.textContent = "Đang xử lý..."; }
  try {
    const result = await apiRequest("/api/orders", {method:"POST",body:JSON.stringify({package_id:Number(selectedPackage.id)})});
    closeBuyModal();
    showToast("Mua hàng thành công! Mã đơn #" + (result.order?.order_id ?? ""));
    await loadCurrentUser();
  } catch (error) {
    showToast(error.message || "Không thể tạo đơn hàng.");
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-check"></i> Xác nhận mua'; }
  }
}

/* Account page */
function renderAccountDetails(user, orders) {
  const host = document.getElementById("account-details");
  if (!host || !user) return;
  host.innerHTML = `
    <div class="profile-top"><div class="avatar">${escapeHTML((user.username||"U").slice(0,1).toUpperCase())}</div>
      <div><strong>${escapeHTML(user.username)}</strong><div class="tiny muted">Thành viên Random5s · ID ${Number(user.id)}</div></div></div>
    <div class="info-row"><div><small>Số dư khả dụng</small><strong>${money(user.balance)}</strong></div><a href="add-funds.html" class="btn btn-soft">Nạp tiền</a></div>
    <div class="info-row"><div><small>Tổng số đơn hàng</small><strong>${Number(orders?.length || 0)}</strong></div><a href="history.html" class="btn btn-soft">Lịch sử</a></div>
    <button class="btn btn-danger btn-block" id="account-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>`;
  document.getElementById("account-logout")?.addEventListener("click", logoutUser);
}

/* History */
async function loadHistory() {
  const host = document.getElementById("history-content");
  if (!host) return;
  if (!getToken()) {
    host.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><h3>Vui lòng đăng nhập</h3><p class="tiny">Đăng nhập để xem lịch sử mua hàng.</p><a class="btn btn-primary" href="account.html">Đăng nhập</a></div>';
    return;
  }
  try {
    const data = await apiRequest("/api/orders");
    const items = data.items || [];
    if (!items.length) {
      host.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>Chưa có đơn hàng</h3><p class="tiny">Đơn hàng sau khi mua sẽ hiển thị tại đây.</p></div>';
      return;
    }
    host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã đơn</th><th>Mã gói</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>${items.map(o=>`<tr><td>#${Number(o.id)}</td><td>#${Number(o.package_id)}</td><td>${money(o.amount)}</td><td><span class="status">${escapeHTML(o.status)}</span></td><td>${escapeHTML(o.created_at || "")}</td></tr>`).join("")}</tbody></table></div><p class="tiny muted">API hiện chỉ trả metadata đơn hàng, chưa trả lại nội dung tài khoản đã giao.</p>`;
  } catch (error) {
    host.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tải được lịch sử</h3><p class="tiny">${escapeHTML(error.message)}</p></div>`;
  }
}

/* Deposits */
async function loadDeposits() {
  const host = document.getElementById("deposit-history");
  if (!host) return;
  if (!getToken()) {
    host.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><h3>Vui lòng đăng nhập</h3><a class="btn btn-primary" href="account.html">Đăng nhập</a></div>';
    return;
  }
  try {
    const data = await apiRequest("/api/deposits");
    const items = data.items || [];
    host.innerHTML = items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã nạp</th><th>Số tiền</th><th>Trạng thái</th><th>Hết hạn</th></tr></thead><tbody>${items.map(d=>`<tr><td>${escapeHTML(d.payment_code)}</td><td>${money(d.amount)}</td><td><span class="status">${escapeHTML(d.status)}</span></td><td>${escapeHTML(d.expires_at || "")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Chưa có giao dịch nạp tiền</h3></div>';
  } catch (error) {
    host.innerHTML = `<div class="empty-state"><p>${escapeHTML(error.message)}</p></div>`;
  }
}
async function createDeposit(event) {
  event.preventDefault();
  if (!getToken()) { showToast("Vui lòng đăng nhập trước khi nạp tiền."); location.href = "account.html"; return; }
  const form = event.currentTarget;
  const amount = Number(form.elements.amount?.value);
  if (!Number.isInteger(amount) || amount < 10000 || amount > 50000000) return showToast("Số tiền nạp từ 10.000đ đến 50.000.000đ.");
  const button = form.querySelector('[type="submit"]');
  const oldText = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Đang tạo mã..."; }
  try {
    const result = await apiRequest("/api/deposits", {method:"POST",body:JSON.stringify({amount})});
    const resultBox = document.getElementById("deposit-result");
    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.innerHTML = `<p class="tiny muted">Mã nội dung chuyển khoản của bạn</p><div class="code-box" id="deposit-code">${escapeHTML(result.payment_code)}</div><p><strong>${money(result.amount)}</strong></p><p class="tiny muted">Mã có hiệu lực đến: ${escapeHTML(result.expires_at || "")}</p><button class="btn btn-soft" type="button" id="copy-deposit-code"><i class="fa-regular fa-copy"></i> Sao chép mã</button>`;
      document.getElementById("copy-deposit-code")?.addEventListener("click", () => copyText(result.payment_code));
    }
    showToast("Đã tạo mã nạp. Chưa chuyển tiền khi chưa có thông tin ngân hàng xác thực.");
    await loadDeposits();
  } catch (error) {
    showToast(error.message || "Không thể tạo yêu cầu nạp tiền.");
  } finally {
    if (button) { button.disabled = false; button.textContent = oldText; }
  }
}

/* Transactions */
async function refreshPageData() {
  if (document.getElementById("account-details") && currentUser) {
    try {
      const data = await apiRequest("/api/orders");
      renderAccountDetails(currentUser, data.items || []);
    } catch { renderAccountDetails(currentUser, []); }
  }
  if (document.getElementById("history-content")) await loadHistory();
  if (document.getElementById("deposit-history")) await loadDeposits();
}
function copyText(value) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(String(value)).then(()=>showToast("Đã sao chép.")).catch(()=>showToast("Không thể sao chép tự động."));
  else showToast("Trình duyệt không hỗ trợ sao chép tự động.");
}

document.addEventListener("click", closeNotifications);
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach(el=>el.addEventListener("click",toggleTheme));
  document.querySelectorAll("[data-notifications]").forEach(el=>el.addEventListener("click",toggleNotifications));
  document.querySelectorAll("[data-mark-read]").forEach(el=>el.addEventListener("click",markNotificationsRead));
  document.querySelectorAll("[data-auth-tab]").forEach(el=>el.addEventListener("click",()=>switchAuthTab(el.dataset.authTab)));
  document.getElementById("login-form")?.addEventListener("submit",handleLogin);
  document.getElementById("register-form")?.addEventListener("submit",handleRegister);
  document.getElementById("buy-confirm")?.addEventListener("click",confirmPurchase);
  document.querySelectorAll("[data-buy-close]").forEach(el=>el.addEventListener("click",closeBuyModal));
  document.getElementById("deposit-form")?.addEventListener("submit",createDeposit);
  document.querySelectorAll("[data-copy]").forEach(el=>el.addEventListener("click",()=>copyText(el.dataset.copy)));
  const year=document.getElementById("current-year"); if(year) year.textContent=new Date().getFullYear();
  await loadCurrentUser();
  renderAccountPanel(currentUser);
  if(document.getElementById("product-grid")) await loadPackages();
  await refreshPageData();
});

window.Random5s = {apiRequest,getToken,setToken,loadCurrentUser,logoutUser,loadPackages,loadHistory,loadDeposits};
