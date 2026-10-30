
/* Random5s static frontend. API integration will be enabled in a later phase. */
const API_BASE_URL = "https://api.random5s.site";
const DEMO_MODE = true; // Keep true until the Raspberry Pi API is deployed.
const TOKEN_KEY = "random5s_token";

const money = value => new Intl.NumberFormat("vi-VN").format(value || 0) + "đ";
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = token => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

function showToast(message) {
  let node = document.getElementById("toast");
  if (!node) { node = document.createElement("div"); node.id = "toast"; node.className = "toast"; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => node.classList.add("hidden"), 2600);
}

function initTheme() {
  const saved = localStorage.getItem("random5s_theme");
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  updateThemeButton();
}
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("random5s_theme", dark ? "dark" : "light");
  updateThemeButton();
}
function updateThemeButton() {
  const button = document.querySelectorAll("[data-theme-toggle]");
  button.forEach(el => el.innerHTML = document.documentElement.classList.contains("dark") ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>');
}
function toggleNotifications() {
  const panel = document.getElementById("notification-panel");
  if (panel) panel.classList.toggle("hidden");
}
function closeNotifications(event) {
  const panel = document.getElementById("notification-panel");
  if (panel && !panel.contains(event.target) && !event.target.closest("[data-notifications]")) panel.classList.add("hidden");
}
function markNotificationsRead() {
  const dot = document.getElementById("notification-dot");
  if (dot) dot.classList.add("hidden");
  toggleNotifications();
  showToast("Đã đánh dấu đọc thông báo.");
}
async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Không thể kết nối máy chủ.");
  return data;
}
function openBuyModal() {
  const modal = document.getElementById("buy-modal");
  if (modal) modal.classList.remove("hidden");
}
function closeBuyModal() {
  const modal = document.getElementById("buy-modal");
  if (modal) modal.classList.add("hidden");
}
function changeQuantity(delta) {
  const input = document.getElementById("buy-quantity");
  if (!input) return;
  input.value = Math.max(1, Math.min(20, Number(input.value || 1) + delta));
  updateBuyTotal();
}
function updateBuyTotal() {
  const input = document.getElementById("buy-quantity");
  const total = document.getElementById("buy-total");
  if (input && total) total.textContent = money(Number(input.value || 1) * 25000);
}
function confirmDemoPurchase() {
  closeBuyModal();
  showToast("Frontend đang ở chế độ giao diện. Chức năng mua sẽ bật sau khi kết nối Backend.");
}
function demoLogin(event) {
  event.preventDefault();
  showToast("Đăng nhập sẽ được kích hoạt khi Backend API hoàn tất.");
}
function copyText(value) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(() => showToast("Đã sao chép.")).catch(() => showToast("Không thể sao chép tự động."));
  else showToast("Trình duyệt không hỗ trợ sao chép tự động.");
}
document.addEventListener("click", closeNotifications);
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach(el => el.addEventListener("click", toggleTheme));
  document.querySelectorAll("[data-notifications]").forEach(el => el.addEventListener("click", toggleNotifications));
  document.querySelectorAll("[data-mark-read]").forEach(el => el.addEventListener("click", markNotificationsRead));
  document.querySelectorAll("[data-buy-open]").forEach(el => el.addEventListener("click", openBuyModal));
  document.querySelectorAll("[data-buy-close]").forEach(el => el.addEventListener("click", closeBuyModal));
  document.querySelectorAll("[data-qty-minus]").forEach(el => el.addEventListener("click", () => changeQuantity(-1)));
  document.querySelectorAll("[data-qty-plus]").forEach(el => el.addEventListener("click", () => changeQuantity(1)));
  document.querySelectorAll("[data-buy-confirm]").forEach(el => el.addEventListener("click", confirmDemoPurchase));
  document.querySelectorAll("[data-login-form]").forEach(el => el.addEventListener("submit", demoLogin));
  document.querySelectorAll("[data-copy]").forEach(el => el.addEventListener("click", () => copyText(el.dataset.copy)));
  const qty = document.getElementById("buy-quantity");
  if (qty) qty.addEventListener("input", updateBuyTotal);
  const year = document.getElementById("current-year");
  if (year) year.textContent = new Date().getFullYear();
});
