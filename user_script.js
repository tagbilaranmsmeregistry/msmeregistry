// Helper for escaping HTML
window.escapeHtml =
  window.escapeHtml ||
  function (unsafe) {
    return unsafe
      ? String(unsafe).replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[m],
        )
      : "";
  };

let allBusinesses = [];
let filteredBusinesses = [];
let searchTerm = "";
let selectedIds = new Set();
let currentPage = 1;
const itemsPerPage = 24;
let docxContent = "";

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase) return console.error("Supabase not initialized");
  await loadUserData();
});

async function loadUserData() {
  const loader = document.getElementById("loader");
  const passkey = localStorage.getItem("user_passkey");
  if (!passkey) return (window.location.href = "admin/login.html");
  try {
    const { data: pkData } = await window.supabase
      .from("passkeys")
      .select("id")
      .eq("name", passkey)
      .single();
    if (!pkData) throw new Error("Invalid passkey");

    // Fetch all passkey_items using pagination (range) to bypass 1000 limit
    let items = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch, error } = await window.supabase
        .from("passkey_items")
        .select("business_number")
        .eq("passkey_id", pkData.id)
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      items = items.concat(batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }
    const bizNumbers = items.map((it) => String(it.business_number));

    // Fetch businesses in batches of 1000 using .in
    allBusinesses = [];
    const batchSizeBiz = 1000;
    for (let i = 0; i < bizNumbers.length; i += batchSizeBiz) {
      const slice = bizNumbers.slice(i, i + batchSizeBiz);
      const { data: rawData, error } = await window.supabase
        .from("businesses")
        .select("*")
        .in("number", slice);
      if (error) throw error;
      if (rawData) {
        allBusinesses = allBusinesses.concat(
          rawData.map((b) => ({
            number: String(b.number),
            name: b.business_name,
            location: b.location,
            owner: b.owner,
            type: b.line_of_business,
          })),
        );
      }
    }
    applyFilters();
    renderRegistry();
  } catch (err) {
    showToast("Error loading data: " + err.message, "error");
  } finally {
    if (loader) loader.style.display = "none";
  }
}

function applyFilters() {
  const term = searchTerm.toLowerCase().trim();
  filteredBusinesses = allBusinesses.filter(
    (b) =>
      (b.name || "").toLowerCase().includes(term) ||
      (b.owner || "").toLowerCase().includes(term) ||
      (b.location || "").toLowerCase().includes(term),
  );
  updateStats();
}

function renderRegistry() {
  const list = document.getElementById("business-list");
  list.innerHTML = "";
  const paged = filteredBusinesses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (paged.length === 0) {
    document.getElementById("empty-state").classList.remove("hidden");
    return;
  }
  document.getElementById("empty-state").classList.add("hidden");

  paged.forEach((b) => {
    const isSelected = selectedIds.has(b.number);
    const card = document.createElement("div");
    card.className = `biz-card ${isSelected ? "selected" : ""}`;
    card.onclick = () => toggleSelection(b.number);
    card.innerHTML = `
      <div class="biz-card-header" style="width:100%">
        <div class="biz-name">${window.escapeHtml(b.name)}</div>
        <div class="checkbox-wrapper"></div>
      </div>
      <div class="biz-meta">
        <div class="meta-row"><span class="meta-icon">📍</span> ${window.escapeHtml(b.location || "—")}</div>
        <div class="meta-row"><span class="meta-icon">👤</span> ${window.escapeHtml(b.owner || "—")}</div>
        <div class="meta-row"><span class="meta-icon">🏷️</span> ${window.escapeHtml(b.type || "Unclassified")}</div>
      </div>`;
    list.appendChild(card);
  });
  renderPagination(filteredBusinesses.length);
}

function toggleSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderRegistry();
  updateStats();
}

function updateStats() {
  document.getElementById("total-count").textContent =
    allBusinesses.length.toLocaleString();
  document.getElementById("showing-count").textContent =
    filteredBusinesses.length.toLocaleString();
  const selEl = document.getElementById("selected-count");
  if (selEl) selEl.textContent = selectedIds.size.toLocaleString();
}

let activeSelectionTool = null;

function selectAll(check, el) {
  if (activeSelectionTool === el) {
    el.checked = false;
    activeSelectionTool = null;
    selectedIds.clear();
  } else {
    activeSelectionTool = el;
    selectedIds.clear();
    if (check) allBusinesses.forEach((b) => selectedIds.add(b.number));
  }
  renderRegistry();
  updateStats();
}

function selectAllFiltered(el) {
  if (activeSelectionTool === el) {
    el.checked = false;
    activeSelectionTool = null;
    selectedIds.clear();
  } else {
    activeSelectionTool = el;
    selectedIds.clear();
    filteredBusinesses.forEach((b) => selectedIds.add(b.number));
  }
  renderRegistry();
  updateStats();
}

function printRegistry() {
  if (selectedIds.size === 0) {
    return showToast("Please select at least one business to print.", "info");
  }
  const toPrint = allBusinesses.filter((b) => selectedIds.has(b.number));
  if (toPrint.length === 0) return showToast("No records to print.", "info");

  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportSub =
    selectedIds.size > 0
      ? "Selected Businesses Report"
      : "Business Registry Report";

  let html = `
    <table class="print-table-wrapper">
      <thead><tr><td><div class="print-header"><h2>Tagbilaran City MSME Registry</h2><p>${reportSub}</p>
      <div style="font-size: 9pt; margin-top: 4pt; color: #666;">Date: ${date} | Total Records: ${toPrint.length}</div></div></td></tr></thead>
      <tbody><tr><td><div class="print-list">${toPrint
        .map(
          (b, i) => `
        <div class="print-item">
          <div class="print-item-title"><strong>${i + 1}. ${window.escapeHtml(b.name)}</strong></div>
          <div class="print-item-row"><strong>Location:</strong> ${window.escapeHtml(b.location || "—")}</div>
          <div class="print-item-row"><strong>Owner:</strong> ${window.escapeHtml(b.owner || "—")}</div>
          <div class="print-item-row"><strong>Line of Business:</strong> ${window.escapeHtml(b.type || "Unclassified")}</div>
        </div>`,
        )
        .join("")}</div></td></tr></tbody>
    </table>`;
  document.getElementById("print-area").innerHTML = html;
  setTimeout(() => window.print(), 600);
}

function exportDocx() {
  if (selectedIds.size === 0) {
    return showToast("Please select at least one business to export.", "info");
  }
  const toExport = allBusinesses.filter((b) => selectedIds.has(b.number));
  if (toExport.length === 0) return showToast("No records to export.", "info");

  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportSub =
    selectedIds.size > 0
      ? "Selected Businesses Report"
      : "Business Registry Report";

  const innerHtml = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead><tr><td><div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10pt;">
        <h2 style="margin: 0; font-size: 22pt;">Tagbilaran City MSME Registry</h2>
        <p style="margin: 5px 0; color: #666;">${reportSub}</p>
        <div style="font-size: 10pt; margin-top: 5px; color: #888;">Date: ${date} | Total Records: ${toExport.length}</div>
      </div></td></tr></thead>
      <tbody><tr><td><div class="print-list">${toExport
        .map(
          (b, i) => `
        <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; page-break-inside: avoid;">
          <div style="font-size: 13pt; font-weight: bold; margin-bottom: 5px;">${i + 1}. ${window.escapeHtml(b.name)}</div>
          <div style="font-size: 11pt; margin-bottom: 2px;"><strong>Location:</strong> ${window.escapeHtml(b.location || "—")}</div>
          <div style="font-size: 11pt; margin-bottom: 2px;"><strong>Owner:</strong> ${window.escapeHtml(b.owner || "—")}</div>
          <div style="font-size: 11pt; margin-bottom: 2px;"><strong>Line of Business:</strong> ${window.escapeHtml(b.type || "Unclassified")}</div>
        </div>`,
        )
        .join("")}</div></td></tr></tbody>
    </table>`;

  document.getElementById("preview-content").innerHTML = innerHtml;
  docxContent = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.5;}</style></head><body>${innerHtml}</body></html>`;
  openModal("preview-modal");

  document.getElementById("download-docx-btn").onclick = () => {
    const blob = new Blob(["\ufeff" + docxContent], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "msme_registry_report.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    closeModal("preview-modal");
    showToast("Report downloaded successfully");
  };
}

function renderPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return;

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.className = "page-btn";
  backBtn.disabled = currentPage === 1;
  backBtn.onclick = (e) => {
    e.stopPropagation();
    currentPage--;
    renderRegistry();
  };
  pagination.appendChild(backBtn);

  // Go To page section
  const goToContainer = document.createElement("div");
  goToContainer.style.cssText =
    "display: flex; align-items: center; gap: 8px; margin: 0 10px;";

  const goToLabel = document.createElement("span");
  goToLabel.textContent = "Go to:";
  goToLabel.style.cssText =
    "font-size: 0.875rem; color: var(--text-secondary);";
  goToContainer.appendChild(goToLabel);

  const goToInput = document.createElement("input");
  goToInput.type = "number";
  goToInput.min = "1";
  goToInput.max = totalPages;
  goToInput.value = currentPage;
  goToInput.style.cssText =
    "width: 50px; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border); font-size: 0.875rem;";
  goToContainer.appendChild(goToInput);

  const pageCount = document.createElement("span");
  pageCount.textContent = `of ${totalPages}`;
  pageCount.style.cssText =
    "font-size: 0.875rem; color: var(--text-secondary);";
  goToContainer.appendChild(pageCount);

  const goBtn = document.createElement("button");
  goBtn.textContent = "Go";
  goBtn.style.cssText =
    "padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 0.875rem;";
  goBtn.onclick = () => goToPage(parseInt(goToInput.value), totalPages);
  goToContainer.appendChild(goBtn);

  pagination.appendChild(goToContainer);

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.className = "page-btn";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = (e) => {
    e.stopPropagation();
    currentPage++;
    renderRegistry();
  };
  pagination.appendChild(nextBtn);

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.style.cssText =
      "padding: 8px 16px; margin: 0 5px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer;";
    if (btn.disabled) btn.style.opacity = "0.5";
  });
}

function goToPage(pageNum, totalPages) {
  if (pageNum < 1 || pageNum > totalPages || isNaN(pageNum)) {
    showToast(
      `Please enter a page number between 1 and ${totalPages}`,
      "error",
    );
    return;
  }
  currentPage = pageNum;
  renderRegistry();
}

function logout() {
  showMessageOption(
    "Are you sure you want to logout?",
    () => {
      localStorage.removeItem("user_passkey");
      window.location.href = "admin/login.html";
    }
  );
}
function openModal(id) {
  document.getElementById(id).classList.add("flex");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("flex");
}
function showToast(msg, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; gap:8px;";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const styles = {
    success: "background:#2d7a4f;",
    error: "background:#dc2626;",
    info: "background:#2563eb;",
  };
  toast.style.cssText = `${styles[type] || styles.success} color:#fff; padding:12px 20px; border-radius:10px; font-size:14px; font-weight:500; transform:translateX(120%); opacity:0; transition:transform 0.3s ease, opacity 0.3s ease; box-shadow:0 4px 12px rgba(0,0,0,0.15); max-width:320px; pointer-events:none;`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity = "1";
  }, 10);
  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showMessageOption(message, onConfirm, onCancel) {
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;";

  const modal = document.createElement("div");
  modal.style.cssText =
    "background: white; border-radius: 12px; padding: 24px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); max-width: 400px; text-align: center;";

  const title = document.createElement("h2");
  title.textContent = "Confirm";
  title.style.cssText = "margin: 0 0 12px 0; font-size: 18px; color: var(--text-primary);";
  modal.appendChild(title);

  const msg = document.createElement("p");
  msg.textContent = message;
  msg.style.cssText = "margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;";
  modal.appendChild(msg);

  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = "display: flex; gap: 12px; justify-content: center;";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText =
    "padding: 8px 20px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 14px;";
  cancelBtn.onclick = () => {
    backdrop.remove();
    if (onCancel) onCancel();
  };
  btnContainer.appendChild(cancelBtn);

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Yes";
  confirmBtn.style.cssText =
    "padding: 8px 20px; border-radius: 6px; border: none; background: #dc2626; color: white; cursor: pointer; font-size: 14px;";
  confirmBtn.onclick = () => {
    backdrop.remove();
    if (onConfirm) onConfirm();
  };
  btnContainer.appendChild(confirmBtn);

  modal.appendChild(btnContainer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

document.getElementById("search-input").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  currentPage = 1;
  applyFilters();
  renderRegistry();
});
window.printRegistry = printRegistry;
window.exportDocx = exportDocx;
window.selectAll = selectAll;
window.selectAllFiltered = selectAllFiltered;
window.logout = logout;
window.closeModal = closeModal;
window.printModalContent = printModalContent;
