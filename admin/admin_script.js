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
let savedPasskeys = [];
let currentPage = 1;
const itemsPerPage = 24;
let currentPasskeyToDelete = null;
let editingPasskeyId = null;
let currentBizToDelete = null;
let docxContent = "";

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase) {
    console.error("Supabase not initialized");
    return;
  }

  // Initial Load
  await loadData();
  await fetchPasskeys();
});

async function loadData() {
  const loader = document.getElementById("loader");
  try {
    const rawData = await window.fetchAllRecords("businesses");
    if (rawData) {
      allBusinesses = rawData.map((b) => ({
        number: String(b.number),
        name: b.business_name,
        location: b.location,
        owner: b.owner,
        type: b.line_of_business,
      }));
      applyFilters();
      renderRegistry();
    }
  } catch (err) {
    console.error("Failed to load data:", err);
    showToast("Error loading database", "error");
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

  const start = (currentPage - 1) * itemsPerPage;
  const paged = filteredBusinesses.slice(start, start + itemsPerPage); // Use itemsPerPage here

  if (paged.length === 0) {
    list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">No businesses found.</div>`;
    return;
  }

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
      </div>
    `;
    list.appendChild(card);
  });
  renderPagination(filteredBusinesses.length); // Add pagination rendering
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
  backBtn.onclick = () => {
    currentPage--;
    renderRegistry();
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
        renderRegistry();
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
    renderRegistry();
  };
  pagination.appendChild(nextBtn);

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.style.cssText =
      "padding: 8px 16px; margin: 0 5px; border-radius: 6px; border: 1px solid var(--border); background: white; cursor: pointer;";
    if (btn.disabled) btn.style.opacity = "0.5";
  });
}

function updateStats() {
  document.getElementById("total-count").textContent =
    allBusinesses.length.toLocaleString();
  const isFiltering = searchTerm.trim() !== "";
  document.getElementById("filtered-count").textContent = isFiltering
    ? filteredBusinesses.length.toLocaleString()
    : "0";
  document.getElementById("visible-count").textContent =
    selectedIds.size.toLocaleString();
  document.getElementById("selected-count").textContent =
    selectedIds.size.toLocaleString();
}

function toggleSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderRegistry();
  updateStats();
}

function handleSearch(val) {
  searchTerm = val;
  currentPage = 1;
  applyFilters();
  renderRegistry();
}

async function savePasskey() {
  const nameInput = document.getElementById("passkey-name-input");
  const name = nameInput.value.trim();
  const id = document.getElementById("editing-passkey-id").value;

  if (!name) return showAlert("Please enter a name for the passkey.");
  if (selectedIds.size === 0)
    return showAlert(
      "Select at least one business to include in this passkey.",
    );

  try {
    let pk;
    if (id && editingPasskeyId == id) {
      // Update existing passkey
      const { data: updatedPk, error: nameError } = await window.supabase
        .from("passkeys")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (nameError) {
        if (nameError.code === "23505") {
          return showAlert(
            `A passkey with the name "${name}" already exists. Please choose a different name.`,
          );
        }
        throw nameError;
      }
      pk = updatedPk;

      // Delete existing passkey_items before inserting new ones
      const { error: delError } = await window.supabase
        .from("passkey_items")
        .delete()
        .eq("passkey_id", id);
      if (delError) throw delError;
    } else {
      // Create new passkey
      const { data: newPk, error: pkError } = await window.supabase
        .from("passkeys")
        .insert([{ name }])
        .select()
        .single();
      if (pkError) {
        if (pkError.code === "23505") {
          return showAlert(
            `A passkey with the name "${name}" already exists. Please choose a different name.`,
          );
        }
        throw pkError;
      }
      pk = newPk;
    }

    if (!pk) throw new Error("Could not retrieve passkey record.");

    const items = Array.from(selectedIds).map((bizId) => ({
      passkey_id: pk.id,
      business_number: String(bizId),
    }));

    if (items.length > 0) {
      const { error: itemsError } = await window.supabase
        .from("passkey_items")
        .insert(items);
      if (itemsError) throw itemsError;
    }

    const actionType = id ? "updated" : "saved";
    showMessageOption(
      `Passkey "${name}" has been ${actionType} successfully with ${items.length} business(es).`,
      () => {
        cancelEditPasskey(); // Reset form after save/update
        fetchPasskeys();
        renderRegistry();
      },
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function fetchPasskeys() {
  try {
    const { data, error } = await window.supabase
      .from("passkeys")
      .select("*, passkey_items(count)");
    if (error) throw error;
    savedPasskeys = data.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    renderSavedPasskeys();
  } catch (err) {
    console.error("Failed to fetch passkeys:", err);
    showToast("Could not load saved passkeys.", "error");
  }
}

function renderSavedPasskeys() {
  const list = document.getElementById("saved-passkeys-list");
  if (!savedPasskeys || savedPasskeys.length === 0) {
    list.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted)">No passkeys saved yet.</p>`;
    return;
  }

  list.innerHTML = savedPasskeys
    .map(
      (pk) => `
      <div class="passkey-item">
        <div class="passkey-item-name">${window.escapeHtml(pk.name)} <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted)">(${pk.passkey_items?.[0]?.count || 0} items)</span></div>
        <div class="passkey-item-actions">
          <button class="view-passkey-btn" onclick="viewPasskey('${pk.id}')">View</button>
          <button class="edit-passkey-btn" onclick="editPasskey('${pk.id}')">
            ${editingPasskeyId == pk.id ? "Cancel" : "Edit"}
          </button>
          <button class="delete-passkey-btn" onclick="deletePasskey('${pk.id}')">Delete</button>
        </div>
      </div>
    `,
    )
    .join("");
}

async function viewPasskey(id) {
  const pk = savedPasskeys.find((p) => p.id == id);
  if (!pk) return;

  const content = document.getElementById("view-passkey-content");
  document.getElementById("view-passkey-title").textContent =
    `Preview: ${pk.name}`;
  content.innerHTML = `<div style="display:flex; justify-content:center; padding:20px;"><div class="loader" style="width:28px; height:28px; border-width:3px;"></div></div>`;
  openModal("view-passkey-modal");

  try {
    const { data, error } = await window.supabase
      .from("passkey_items")
      .select("business_number")
      .eq("passkey_id", id);

    if (error) throw error;

    const bizIds = (data || []).map((it) => String(it.business_number));
    const list = allBusinesses.filter((b) => bizIds.includes(b.number));

    if (list.length === 0) {
      content.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">No records found for this passkey.</p>`;
    } else {
      content.innerHTML = `
        <table class="print-table-wrapper" style="width: 100%; border-collapse: collapse;">
          <thead style="display: table-header-group;">
            <tr>
              <td style="padding-bottom: 20pt;">
                <div class="print-header" style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10pt;">
                  <h2 style="margin: 0; font-size: 22pt;">Tagbilaran City MSME Registry</h2>
                  <p style="margin: 5px 0; color: #666;">Passkey: ${window.escapeHtml(pk.name)}</p>
                  <div style="font-size: 10pt; margin-top: 5px; color: #888;">Total Records: ${list.length}</div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody style="display: table-row-group;">
            <tr>
              <td>
                <div class="print-list">
                  ${list
                    .map(
                      (b, i) => `
                    <div class="print-item" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; page-break-inside: avoid;">
                      <div class="print-item-title" style="font-size: 13pt; font-weight: bold; margin-bottom: 5px;">${i + 1}. ${window.escapeHtml(b.name)}</div>
                      <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Location:</strong> ${window.escapeHtml(b.location || "—")}</div>
                      <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Owner:</strong> ${window.escapeHtml(b.owner || "—")}</div>
                      <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Line of Business:</strong> ${window.escapeHtml(b.type || "Unclassified")}</div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              </div>
              </td>
            </tr>
          </tbody>
          <tfoot style="display: table-footer-group;">
            <tr>
              <td>
                <div class="print-footer" style="text-align: center; font-size: 9pt; border-top: 1px solid #ddd; padding-top: 15pt; color: #666;">
                  City Economic Development and Investment Promotions Office (CEDIPO) · Digital Business Registry
                </div>
              </td>
            </tr>
          </tfoot>
        </table>`;
    }
  } catch (err) {
    console.error(err);
    content.innerHTML = `<p style="color:#dc2626; text-align:center; padding:20px;">Failed to load preview.</p>`;
  }
}

function deletePasskey(id) {
  const pk = savedPasskeys.find((p) => p.id == id);
  if (!pk) return;
  currentPasskeyToDelete = id;
  document.getElementById("passkey-to-delete-name").textContent = pk.name;
  openModal("delete-passkey-modal");
}

function closeDeletePasskeyModal() {
  closeModal("delete-passkey-modal");
  currentPasskeyToDelete = null;
}

async function confirmDeletePasskey() {
  if (!currentPasskeyToDelete) return;
  try {
    if (editingPasskeyId == currentPasskeyToDelete) {
      cancelEditPasskey();
    }

    // First delete associated items to avoid foreign key constraint errors
    await window.supabase
      .from("passkey_items")
      .delete()
      .eq("passkey_id", currentPasskeyToDelete);

    const { error } = await window.supabase
      .from("passkeys")
      .delete()
      .eq("id", currentPasskeyToDelete);

    if (error) throw error;

    showToast("Passkey deleted successfully");
    closeDeletePasskeyModal();
    fetchPasskeys();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editPasskey(id) {
  if (editingPasskeyId == id) {
    cancelEditPasskey();
    return;
  }

  const pk = savedPasskeys.find((p) => p.id == id);
  if (!pk) return showToast("Passkey not found", "error");

  editingPasskeyId = id;

  // Load all businesses for this passkey using pagination to bypass 1000 row limit
  let items = [];
  let from = 0;
  const batchSize = 1000;
  try {
    while (true) {
      const { data: batch, error } = await window.supabase
        .from("passkey_items")
        .select("business_number")
        .eq("passkey_id", id)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      items = items.concat(batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }

    selectedIds.clear();
    items.forEach((item) => selectedIds.add(String(item.business_number)));
    renderRegistry();
    updateStats();
  } catch (err) {
    showToast("Error loading passkey businesses", "error");
  }

  renderSavedPasskeys(); // Update button text in the list
  document.getElementById("passkey-form-title").textContent = "Edit Passkey";
  document.getElementById("passkey-name-input").value = pk.name;
  document.getElementById("editing-passkey-id").value = id;
  document.getElementById("save-passkey-btn").textContent = "Save Changes";
  document
    .getElementById("passkey-form-title")
    .scrollIntoView({ behavior: "smooth" });
}

function cancelEditPasskey() {
  editingPasskeyId = null;
  document.getElementById("editing-passkey-id").value = "";
  document.getElementById("passkey-name-input").value = "";
  document.getElementById("passkey-form-title").textContent = "Create Passkey";
  document.getElementById("save-passkey-btn").textContent = "Save Passkey"; // Reset button text
  selectedIds.clear();
  renderRegistry();
  updateStats();
  fetchPasskeys();
}

window.openDeleteBizModal = (id, name) => {
  currentBizToDelete = id;
  document.getElementById("biz-to-delete-name").textContent = name;
  // Assuming "delete-biz-modal" is still a modal that needs to be opened
  // If this is also meant to be integrated, further changes would be needed.
  openModal("delete-biz-modal");
};

async function confirmDeleteBusiness() {
  const { error } = await window.supabase
    .from("businesses")
    .delete()
    .eq("number", currentBizToDelete);
  if (error) return showToast(error.message, "error");

  showToast("Deleted successfully");
  closeModal("delete-biz-modal");
  loadData();
}

function printRegistry() {
  if (selectedIds.size === 0) {
    return showToast("Please select at least one business to print.", "info");
  }

  const toPrint = allBusinesses.filter((b) => selectedIds.has(b.number));
  const reportSub = "Selected Businesses Report";

  const printArea = document.getElementById("print-area");
  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let html = `
    <table class="print-table-wrapper">
      <thead>
        <tr>
          <td>
            <div class="print-header">
              <h2>Tagbilaran City MSME Registry</h2>
              <p>${reportSub}</p>
              <div style="font-size: 9pt; margin-top: 4pt; color: #666;">Date: ${date} | Total Records: ${toPrint.length}</div>
            </div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="print-list">
              ${toPrint
                .map(
                  (b, i) => `
                <div class="print-item">
                  <div class="print-item-title"><strong>${i + 1}. ${window.escapeHtml(b.name)}</strong></div>
                  <div class="print-item-row"><strong>Location:</strong> ${window.escapeHtml(b.location || "—")}</div>
                  <div class="print-item-row"><strong>Owner:</strong> ${window.escapeHtml(b.owner || "—")}</div>
                  <div class="print-item-row"><strong>Line of Business:</strong> ${window.escapeHtml(b.type || "Unclassified")}</div>
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
              City Economic Development and Investment Promotions Office (CEDIPO) · Digital Business Registry
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

function exportDocx() {
  if (selectedIds.size === 0) {
    return showToast("Please select at least one business to export.", "info");
  }

  const toExport = allBusinesses.filter((b) => selectedIds.has(b.number));
  const reportSub = "Selected Businesses Report";

  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const innerHtml = `
    <table class="print-table-wrapper" style="width: 100%; border-collapse: collapse;">
      <thead style="display: table-header-group;">
        <tr>
          <td style="padding-bottom: 20pt;">
            <div class="print-header" style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10pt;">
              <h2 style="margin: 0; font-size: 22pt;">Tagbilaran City MSME Registry</h2>
              <p style="margin: 5px 0; color: #666;">${reportSub}</p>
              <div style="font-size: 10pt; margin-top: 5px; color: #888;">Date: ${date} | Total Records: ${toExport.length}</div>
            </div>
          </td>
        </tr>
      </thead>
      <tbody style="display: table-row-group;">
        <tr>
          <td>
            <div class="print-list">
              ${toExport
                .map(
                  (b, i) => `
                <div class="print-item" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; page-break-inside: avoid;">
                  <div class="print-item-title" style="font-size: 13pt; font-weight: bold; margin-bottom: 5px;">${i + 1}. ${window.escapeHtml(b.name)}</div>
                  <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Location:</strong> ${window.escapeHtml(b.location || "—")}</div>
                  <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Owner:</strong> ${window.escapeHtml(b.owner || "—")}</div>
                  <div class="print-item-row" style="font-size: 11pt; margin-bottom: 2px;"><strong>Line of Business:</strong> ${window.escapeHtml(b.type || "Unclassified")}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot style="display: table-footer-group;">
        <tr>
          <td>
            <div class="print-footer" style="text-align: center; font-size: 9pt; border-top: 1px solid #ddd; padding-top: 15pt; color: #666;">
              City Economic Development and Investment Promotions Office (CEDIPO) · Digital Business Registry
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  `;

  document.getElementById("preview-content").innerHTML = innerHtml;

  docxContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${reportSub}</title>
      <style>
        @page {
          size: 8.5in 11in;
          margin: 1in;
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #333; mso-pagination: widow-orphan; }
        .print-table-wrapper { width: 100%; border-collapse: collapse; }
        .print-header { text-align: center; border-bottom: 3px solid #333; margin-bottom: 20pt; padding-bottom: 10pt; }
        .print-header h2 { margin: 0; font-size: 20pt; color: #000; }
        .print-header p { margin: 5pt 0; font-size: 12pt; color: #555; }
        .print-item { margin-bottom: 12pt; border-bottom: 1pt solid #eee; padding-bottom: 10pt; page-break-inside: avoid; display: block; }
        .print-item-title { font-size: 13pt; font-weight: bold; color: #000; margin-bottom: 4pt; }
        .print-item-row { font-size: 11pt; margin-bottom: 2pt; }
        .print-item-row strong { display: inline-block; width: 130pt; color: #1a1a1a; vertical-align: top; }
        .print-footer { text-align: center; font-size: 9pt; color: #777; border-top: 1px solid #ccc; padding-top: 15pt; }
        table { width: 100%; page-break-inside: auto; }
        strong { font-weight: bold; }
      </style>
    </head>
    <body>
      ${innerHtml}
    </body>
    </html>
  `;

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
    URL.revokeObjectURL(url);
    closeModal("preview-modal");
    showToast("Report downloaded successfully");
  };
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
    if (check) {
      allBusinesses.forEach((b) => selectedIds.add(b.number));
    }
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

function toggleSavedPasskeys() {
  const list = document.getElementById("saved-passkeys-list");
  const icon = document.getElementById("passkey-toggle-icon");
  const isCollapsed = list.classList.toggle("collapsed");
  icon.style.transform = isCollapsed ? "rotate(0deg)" : "rotate(180deg)";
}

function logout() {
  showMessageOption("Are you sure you want to logout?", () => {
    localStorage.removeItem("is_admin");
    window.location.href = "login.html";
  });
}

function goToMain() {
  window.location.href = "../index.html";
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
  toast.style.cssText = `
    ${styles[type] || styles.success}
    color:#fff; padding:12px 20px; border-radius:10px;
    font-size:14px; font-weight:500;
    transform:translateX(120%); opacity:0;
    transition:transform 0.3s ease, opacity 0.3s ease;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);
    max-width:320px; pointer-events:none;
  `;
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
  title.style.cssText =
    "margin: 0 0 12px 0; font-size: 18px; color: var(--text-primary);";
  modal.appendChild(title);

  const msg = document.createElement("p");
  msg.textContent = message;
  msg.style.cssText =
    "margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;";
  modal.appendChild(msg);

  const btnContainer = document.createElement("div");
  btnContainer.style.cssText =
    "display: flex; gap: 12px; justify-content: center;";

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

function showAlert(msg) {
  const messageEl = document.getElementById("alert-message");
  if (messageEl) messageEl.textContent = msg;
  openModal("alert-modal");
}

function toggleSidebar() {
  const sidebar = document.getElementById("admin-sidebar");
  const contentArea = document.getElementById("admin-content-area");
  const fixedTools = document.querySelector(".fixed-selection-tools");

  sidebar.classList.toggle("collapsed");
  contentArea.classList.toggle("collapsed-margin");
  fixedTools.classList.toggle("sidebar-collapsed-margin");

  // Adjust main content margin based on sidebar state
  if (sidebar.classList.contains("collapsed")) {
    contentArea.style.marginLeft = "60px"; // Collapsed width
    fixedTools.style.right = "2rem"; // Keep fixed tools on the right
  } else {
    contentArea.style.marginLeft = "327px"; // Expanded width
    fixedTools.style.right = "2rem"; // Keep fixed tools on the right
  }
}

// Initial check for sidebar state on load (for smaller screens)
document.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth <= 1100) {
    toggleSidebar(); // Collapse sidebar by default on small screens
  }
});

// Global exports for HTML onclick events
window.handleSearch = handleSearch; // Keep handleSearch
window.savePasskey = savePasskey; // Keep savePasskey
window.printRegistry = printRegistry;
window.exportDocx = exportDocx;
window.toggleSavedPasskeys = toggleSavedPasskeys; // Keep toggleSavedPasskeys
window.selectAll = selectAll; // Keep selectAll
window.selectAllFiltered = selectAllFiltered; // Keep selectAllFiltered
window.goToMain = goToMain; // Keep goToMain
window.logout = logout; // Keep logout
window.openModal = openModal; // Keep openModal
window.closeModal = closeModal; // Keep closeModal
window.showMessageOption = showMessageOption; // Keep showMessageOption
window.deletePasskey = deletePasskey;
window.closeDeletePasskeyModal = closeDeletePasskeyModal;
window.confirmDeletePasskey = confirmDeletePasskey;
window.toggleSidebar = toggleSidebar;
window.viewPasskey = viewPasskey;
window.editPasskey = editPasskey; // Keep editPasskey
window.cancelEditPasskey = cancelEditPasskey; // Add new export
window.showAlert = showAlert;
