let businesses = [];
let searchTerm = "";
let currentPage = 1;
let deleteTarget = null;
let activeType = "";
let availableTypes = [];
const itemsPerPage = 9;

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loader");
  /* Load businesses */
  try {
    const data = await fetchAllRecords("businesses");
    if (loader) loader.remove();
    businesses = data.map((item) => ({
      number: item.number,
      name: item.business_name,
      location: item.location,
      owner: item.owner,
      type: item.line_of_business,
    }));
    currentPage = 1;
    renderBusinesses();

    // Generate types locally to remove get_business_types.php dependency
    updateAvailableTypes();
    renderCombobox();
  } catch (error) {
    if (loader) loader.remove();
    console.error("Error loading businesses:", error);
    showToast("Failed to load businesses", "error");
  }

  /* Search */
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    currentPage = 1;
    renderBusinesses();
  });

  /* Add button */
  document
    .getElementById("add-btn")
    .addEventListener("click", () => openModal("add-modal"));

  /* Add form submit */
  document
    .getElementById("business-form")
    .addEventListener("submit", handleAddSubmit);

  /* Close combobox dropdown when clicking outside */
  document.addEventListener("click", (e) => {
    const wrap = document.getElementById("type-combobox-wrap");
    if (wrap && !wrap.contains(e.target)) closeComboDropdown();
  });
});

function updateAvailableTypes() {
  const frequency = {};
  businesses.forEach((b) => {
    if (!b.type) return;
    b.type.split(",").forEach((t) => {
      const cleaned = t.trim();
      if (cleaned) frequency[cleaned] = (frequency[cleaned] || 0) + 1;
    });
  });
  availableTypes = Object.entries(frequency)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/* ─────────────────────────────────────────
   COMBOBOX
───────────────────────────────────────── */
function renderCombobox(filterText = "") {
  const wrap = document.getElementById("type-combobox-wrap");
  if (!wrap) return;

  const lower = (filterText || "").toLowerCase();
  const matches = availableTypes
    .filter((t) => t.type.toLowerCase().includes(lower))
    .slice(0, 50);

  const tagHtml = activeType
    ? `<span class="combo-tag">
         <span>${escapeHtml(activeType)}</span>
         <button class="combo-tag-x" onclick="clearTypeFilter(event)" title="Clear filter">×</button>
       </span>`
    : "";

  let itemsHtml = "";
  if (matches.length === 0) {
    itemsHtml = `<div class="combo-no-result">No matching types found</div>`;
  } else {
    matches.forEach((t) => {
      const isActive = t.type === activeType;
      const safe = t.type.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      itemsHtml += `
        <div class="combo-item ${isActive ? "combo-item-active" : ""}"
             onclick="selectType('${safe}')">
          <span class="combo-item-name">${escapeHtml(t.type)}</span>
          <span class="combo-count">${t.count.toLocaleString()}</span>
        </div>`;
    });
  }

  const hint =
    availableTypes.length > 50
      ? `<div class="combo-hint">Showing 50 of ${availableTypes.length.toLocaleString()} types · type to search</div>`
      : "";

  // Only rebuild the whole thing if the input row doesn't exist yet
  if (!document.getElementById("combo-ghost-input")) {
    wrap.innerHTML = `
      <div class="combo-input-row" onclick="focusComboInput()">
        ${tagHtml}
        <input
          class="combo-ghost"
          id="combo-ghost-input"
          placeholder="${activeType ? "" : "Filter by line of business…"}"
          autocomplete="off"
          oninput="onComboInput(this.value)"
          onfocus="openComboDropdown()"
        />
      </div>
      <div class="combo-dropdown hidden" id="combo-dropdown">
        ${itemsHtml}
        ${hint}
      </div>
    `;
  } else {
    // Input already exists — only update the tag and dropdown contents
    const inputRow = document.querySelector(".combo-input-row");
    const existingTag = inputRow.querySelector(".combo-tag");
    if (activeType && !existingTag) {
      inputRow.insertAdjacentHTML("afterbegin", tagHtml);
    } else if (!activeType && existingTag) {
      existingTag.remove();
    }

    const dd = document.getElementById("combo-dropdown");
    if (dd) dd.innerHTML = itemsHtml + hint;
  }
}

function focusComboInput() {
  const input = document.getElementById("combo-ghost-input");
  if (input) {
    input.focus();
    openComboDropdown();
  }
}

function onComboInput(val) {
  // Only update the dropdown items — don't rebuild the input
  const lower = val.toLowerCase();
  const matches = availableTypes
    .filter((t) => t.type.toLowerCase().includes(lower))
    .slice(0, 50);

  let itemsHtml = "";
  if (matches.length === 0) {
    itemsHtml = `<div class="combo-no-result">No matching types found</div>`;
  } else {
    matches.forEach((t) => {
      const isActive = t.type === activeType;
      const safe = t.type.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      itemsHtml += `
        <div class="combo-item ${isActive ? "combo-item-active" : ""}"
             onclick="selectType('${safe}')">
          <span class="combo-item-name">${escapeHtml(t.type)}</span>
          <span class="combo-count">${t.count.toLocaleString()}</span>
        </div>`;
    });
  }

  const hint =
    availableTypes.length > 50
      ? `<div class="combo-hint">Showing 50 of ${availableTypes.length.toLocaleString()} types · type to search</div>`
      : "";

  const dd = document.getElementById("combo-dropdown");
  if (dd) {
    dd.innerHTML = itemsHtml + hint;
    dd.classList.remove("hidden");
  }
}

function openComboDropdown() {
  const dd = document.getElementById("combo-dropdown");
  if (dd) dd.classList.remove("hidden");
}

function closeComboDropdown() {
  const dd = document.getElementById("combo-dropdown");
  if (dd) dd.classList.add("hidden");
}

function selectType(type) {
  activeType = type;
  currentPage = 1;
  renderCombobox();
  closeComboDropdown();
  renderBusinesses();
}

function clearTypeFilter(e) {
  e.stopPropagation();
  activeType = "";
  currentPage = 1;
  renderCombobox();
  renderBusinesses();
}

/* ─────────────────────────────────────────
   RENDER BUSINESSES
───────────────────────────────────────── */
function renderBusinesses() {
  const term = searchTerm.toLowerCase();

  /* Text search */
  let filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(term) ||
      (b.location && b.location.toLowerCase().includes(term)) ||
      (b.owner && b.owner.toLowerCase().includes(term)),
  );

  /* Type filter — split comma-separated values and exact-match each token */
  if (activeType !== "") {
    filtered = filtered.filter((b) => {
      if (!b.type) return false;
      return b.type
        .split(",")
        .map((t) => t.trim())
        .includes(activeType);
    });
  }

  /* Update stat counts */
  document.getElementById("total-count").textContent =
    businesses.length.toLocaleString();
  document.getElementById("showing-count").textContent =
    filtered.length.toLocaleString();

  const unclassifiedEl = document.getElementById("unclassified-count");
  if (unclassifiedEl) {
    unclassifiedEl.textContent = businesses
      .filter((b) => !b.type || b.type.trim() === "")
      .length.toLocaleString();
  }

  const list = document.getElementById("business-list");
  const emptyState = document.getElementById("empty-state");
  list.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    document.getElementById("pagination").innerHTML = "";
    return;
  }
  emptyState.classList.add("hidden");

  /* Paginate */
  const start = (currentPage - 1) * itemsPerPage;
  const paged = filtered.slice(start, start + itemsPerPage);

  paged.forEach((b, index) => {
    const card = document.createElement("div");
    card.className = "biz-card";

    // Store the actual index in the full businesses array
    const realIndex = businesses.findIndex((x) => x.number == b.number);

    card.innerHTML = `
    <div class="biz-card-header">
      <div class="biz-name">${escapeHtml(b.name)}</div>
    </div>
    <div class="biz-meta">
      <span class="meta-row"><span class="meta-icon">📍</span>${escapeHtml(b.location || "—")}</span>
      <span class="meta-row"><span class="meta-icon">👤</span>${escapeHtml(b.owner || "Not on file")}</span>
      <span class="meta-row"><span class="meta-icon">🏷️</span>${escapeHtml(b.type || "Unclassified")}</span>
    </div>
    <div class="biz-actions">
      <button class="btn-view" data-num="${b.number}">View</button>
      <button class="btn-edit" data-num="${b.number}">Edit</button>
      <button class="btn-del"  data-num="${b.number}">Delete</button>
    </div>
  `;

    // Attach events safely — no inline onclick, no string escaping needed
    card.querySelector(".btn-view").addEventListener("click", () => {
      viewBusiness(b.name, b.location, b.owner, b.type);
    });
    card.querySelector(".btn-edit").addEventListener("click", () => {
      editBusiness(b.number, b.name, b.location, b.owner, b.type);
    });
    card.querySelector(".btn-del").addEventListener("click", () => {
      deleteBusiness(b.number);
    });

    list.appendChild(card);
  });

  renderPagination(filtered.length);
}

/* ─────────────────────────────────────────
   PAGINATION
───────────────────────────────────────── */
function renderPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return;

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.className = "page-btn";
  backBtn.disabled = currentPage === 1;
  backBtn.onclick = () => {
    currentPage--;
    renderBusinesses();
  };
  pagination.appendChild(backBtn);

  const info = document.createElement("span");
  info.className = "page-info";
  info.textContent = `Page ${currentPage} of ${totalPages}`;
  pagination.appendChild(info);

  const input = document.createElement("input");
  input.type = "number";
  input.min = 1;
  input.max = totalPages;
  input.placeholder = "Go to…";
  input.className = "page-input";
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const p = parseInt(input.value);
      if (p >= 1 && p <= totalPages) {
        currentPage = p;
        renderBusinesses();
      }
    }
  });
  pagination.appendChild(input);

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.className = "page-btn";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderBusinesses();
  };
  pagination.appendChild(nextBtn);
}

/* ─────────────────────────────────────────
   ADD BUSINESS
───────────────────────────────────────── */
async function handleAddSubmit(e) {
  e.preventDefault();

  const name = document
    .getElementById("business-name")
    .value.trim()
    .toUpperCase();
  const location = document
    .getElementById("business-location")
    .value.trim()
    .toUpperCase();
  const owner = document
    .getElementById("business-owner")
    .value.trim()
    .toUpperCase();
  const type = document
    .getElementById("business-type")
    .value.trim()
    .toUpperCase();

  if (!name || !location || !owner) {
    return showToast("Please fill in all required fields.", "info");
  }

  // Auto-increment polyfill for the database
  const { data: maxData } = await window.supabase
    .from("businesses")
    .select("number")
    .order("number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (maxData && maxData.length > 0) {
    nextNumber = maxData[0].number + 1;
  }

  const { error } = await window.supabase.from("businesses").insert([
    {
      number: nextNumber,
      business_name: name,
      location: location,
      owner: owner,
      line_of_business: type,
    },
  ]);

  if (error) {
    showToast("Error adding business: " + error.message, "error");
  } else {
    showToast("Business added successfully!", "success");
    closeAddModal();
    // Refresh after a short delay so the toast message is visible to the user
    setTimeout(() => refreshRegistry(), 1500);
  }
}

function refreshRegistry() {
  try {
    window.location.reload();
  } catch (e) {
    window.location.href = window.location.href;
  }
}

/* ─────────────────────────────────────────
   EDIT BUSINESS
───────────────────────────────────────── */
function editBusiness(number, name, loc, owner, type) {
  document.getElementById("edit-number").value = number;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-location").value = loc;
  document.getElementById("edit-owner").value = owner;
  document.getElementById("edit-type").value = type;
  openModal("edit-modal");
}

function closeEditModal() {
  closeModal("edit-modal");
}

async function saveEdit() {
  const number = document.getElementById("edit-number").value;
  const name = document.getElementById("edit-name").value.trim().toUpperCase();
  const location = document
    .getElementById("edit-location")
    .value.trim()
    .toUpperCase();
  const owner = document
    .getElementById("edit-owner")
    .value.trim()
    .toUpperCase();
  const type = document.getElementById("edit-type").value.trim().toUpperCase();

  const { error } = await window.supabase
    .from("businesses")
    .update({
      business_name: name,
      location: location,
      owner: owner,
      line_of_business: type,
    })
    .eq("number", number);

  if (error) {
    showToast("Error updating: " + error.message, "error");
  } else {
    showToast("Business updated successfully!", "success");
    closeEditModal();
    await refreshRegistry();
  }
}

/* ─────────────────────────────────────────
   DELETE BUSINESS
───────────────────────────────────────── */
function deleteBusiness(number) {
  deleteTarget = number;
  openModal("delete-modal");
}

function closeDeleteModal() {
  closeModal("delete-modal");
  deleteTarget = null;
}

async function confirmDelete() {
  const { error } = await window.supabase
    .from("businesses")
    .delete()
    .eq("number", deleteTarget);
  if (error) {
    showToast("Error deleting: " + error.message, "error");
  } else {
    closeDeleteModal();
    showToast("Business deleted successfully!", "success");
    await refreshRegistry();
  }
}

/* ─────────────────────────────────────────
   VIEW BUSINESS
───────────────────────────────────────── */
function viewBusiness(name, location, owner, type) {
  document.getElementById("view-name").textContent = name || "—";
  document.getElementById("view-location").textContent = location || "—";
  document.getElementById("view-owner").textContent = owner || "—";
  document.getElementById("view-line-of-business").textContent =
    type || "Unclassified";
  document.getElementById("view-type-badge").textContent =
    type || "Unclassified";
  openModal("view-modal");
}

function closeViewModal() {
  closeModal("view-modal");
}
function closeAddModal() {
  closeModal("add-modal");
  document.getElementById("business-form").reset();
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const styles = {
    success: "background:#2d7a4f;",
    error: "background:#dc2626;",
    info: "background:#2563eb;",
  };
  toast.style.cssText = `
    ${styles[type] || styles.success}
    color:#fff; padding:12px 20px; border-radius:10px;
    font-size:14px; font-weight:500;
    transform:translateX(120%); opacity:0;
    transition:transform 0.3s ease, opacity 0.3s ease;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);
    max-width:320px; pointer-events:none;
  `;
  toast.textContent = message;
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

function showAlert(message) {
  let modal = document.getElementById("alert-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "alert-modal";
    modal.className = "modal-backdrop hidden";
    modal.innerHTML = `
      <div class="modal-box sm" style="text-align: center; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 400px; width: 90%; margin: auto;">
        <h2 style="margin: 0 0 1rem; font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">Notification</h2>
        <p id="alert-message" style="font-size: 0.95rem; color: #4b5563; margin-bottom: 1.5rem; line-height: 1.5;"></p>
        <div style="display: flex; justify-content: center;">
          <button onclick="closeModal('alert-modal')" style="background: #2d7a4f; color: white; border: none; padding: 8px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; min-width: 100px;">
            OK
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("alert-message").textContent = message;
  openModal("alert-modal");
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function openModal(id) {
  const m = document.getElementById(id);
  m.classList.remove("hidden");
  m.classList.add("flex");
}
function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// Expose functions to window for module support
window.clearTypeFilter = clearTypeFilter;
window.selectType = selectType;
window.onComboInput = onComboInput;
window.openComboDropdown = openComboDropdown;
window.focusComboInput = focusComboInput;
window.closeAddModal = closeAddModal;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.exportCSV = exportCSV;
window.printRegistry = printRegistry;
window.closeViewModal = closeViewModal;
window.showAlert = showAlert;

/* ─────────────────────────────────────────
   EXPORT CSV
───────────────────────────────────────── */
function exportCSV() {
  const term = searchTerm.toLowerCase();

  let filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(term) ||
      (b.location && b.location.toLowerCase().includes(term)) ||
      (b.owner && b.owner.toLowerCase().includes(term)),
  );

  if (activeType !== "") {
    filtered = filtered.filter((b) => {
      if (!b.type) return false;
      return b.type
        .split(",")
        .map((t) => t.trim())
        .includes(activeType);
    });
  }

  if (filtered.length === 0) {
    showToast("No records to export.", "info");
    return;
  }

  const now = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = [
    [esc("TAGBILARAN CITY MSME BUSINESS REGISTRY")],
    [esc("DATE GENERATED:"), esc(now)],
    [esc("TOTAL RECORDS:"), esc(filtered.length)],
    [],
    [
      esc("#"),
      esc("BUSINESS NAME"),
      esc("LOCATION"),
      esc("OWNER"),
      esc("LINE OF BUSINESS"),
    ],
    ...filtered.map((b, i) => [
      esc(i + 1),
      esc(b.name),
      esc(b.location),
      esc(b.owner),
      esc(
        (b.type || "Unclassified")
          .split(",")
          .map((t) => t.trim())
          .join(", "),
      ),
    ]),
  ];

  const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "msme_registry.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast(
    `Exported ${filtered.length} record${filtered.length !== 1 ? "s" : ""}.`,
    "success",
  );
}

/* ─────────────────────────────────────────
   PRINT REGISTRY
───────────────────────────────────────── */
function printRegistry() {
  const term = searchTerm.toLowerCase();
  let filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(term) ||
      (b.location && b.location.toLowerCase().includes(term)) ||
      (b.owner && b.owner.toLowerCase().includes(term)),
  );

  if (activeType !== "") {
    filtered = filtered.filter((b) => {
      if (!b.type) return false;
      return b.type
        .split(",")
        .map((t) => t.trim())
        .includes(activeType);
    });
  }

  if (filtered.length === 0) {
    showToast("No records found to print.", "info");
    return;
  }

  const printArea = document.getElementById("print-area");
  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const reportSub = activeType
    ? `Business List: ${activeType}`
    : "Official Business List";

  let html = `
    <table class="print-table-wrapper">
      <thead>
        <tr>
          <td>
            <div class="print-header">
              <h2>Tagbilaran City MSME Registry</h2>
              <p>${reportSub}</p>
              <div style="font-size: 9pt; margin-top: 4pt; color: #666;">Date: ${date} | Total Records: ${filtered.length}</div>
            </div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="print-list">
              ${filtered
                .map(
                  (b, i) => `
                <div class="print-item">
                  <div class="print-item-title"><strong>${i + 1}. ${escapeHtml(b.name)}</strong></div>
                  <div class="print-item-row"><strong>Location:</strong> ${escapeHtml(b.location || "—")}</div>
                  <div class="print-item-row"><strong>Owner:</strong> ${escapeHtml(b.owner || "—")}</div>
                  <div class="print-item-row"><strong>Line of Business:</strong> ${escapeHtml(b.type || "Unclassified")}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td>
            <div class="print-footer">
              City Economic Development and Investment Promotions Office (CEDIPO) · Digital Business Registry · Page 1 of 1
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
  printArea.innerHTML = html;

  const oldTitle = document.title;
  setTimeout(() => {
    document.title = "";
    window.print();
    document.title = oldTitle;
  }, 600);
}
