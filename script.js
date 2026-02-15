function loadConfig() {
    const stored = localStorage.getItem("dns-manager-config");
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        apiKey: "",
        zoneId: "",
        domain: "",
        perPage: 50,
    };
}

function saveConfig(config) {
    localStorage.setItem("dns-manager-config", JSON.stringify(config));
}

function isConfigValid(config) {
    return config.apiKey && config.zoneId && config.domain;
}

let CONFIG = loadConfig();

const API_BASE = "https://api.cloudflare.com/client/v4";

const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const refreshBtn = document.getElementById("refresh-btn");
const addBtn = document.getElementById("add-btn");
const recordsTable = document.getElementById("records-table");
const recordsBody = document.getElementById("records-body");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const paginationEl = document.getElementById("pagination");
const zoneLabel = document.getElementById("zone-label");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const recordForm = document.getElementById("record-form");
const formCancel = document.getElementById("form-cancel");
const formSubmit = document.getElementById("form-submit");
const fieldType = document.getElementById("field-type");
const fieldName = document.getElementById("field-name");
const fieldContent = document.getElementById("field-content");
const fieldPriority = document.getElementById("field-priority");
const fieldTtl = document.getElementById("field-ttl");
const fieldId = document.getElementById("field-id");
const groupPriority = document.getElementById("group-priority");
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmClose = document.getElementById("confirm-close");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmOk = document.getElementById("confirm-ok");
const confirmMsg = document.getElementById("confirm-msg");
const toastEl = document.getElementById("toast");
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const settingsCancel = document.getElementById("settings-cancel");
const settingsForm = document.getElementById("settings-form");
const settingDomain = document.getElementById("setting-domain");
const settingZoneId = document.getElementById("setting-zone-id");
const settingApiKey = document.getElementById("setting-api-key");

let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
let totalPages = 1;
let deleteTarget = null;
let toastTimer = null;

const PRIORITY_TYPES = ["MX", "SRV", "URI"];

function headers() {
    return {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json",
    };
}

async function apiRequest(method, path, body) {
    const options = { method, headers: headers() };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    if (!data.success) {
        const msg = data.errors?.map(e => e.message).join(", ") || "Unknown API error";
        throw new Error(msg);
    }
    return data;
}

async function fetchAllRecords() {
    let page = 1;
    let records = [];
    let hasMore = true;

    while (hasMore) {
        const data = await apiRequest("GET", `/zones/${CONFIG.zoneId}/dns_records?per_page=100&page=${page}`);
        records = records.concat(data.result);
        const info = data.result_info;
        hasMore = info && page < info.total_pages;
        page++;
    }

    return records;
}

function formatTtl(ttl) {
    if (ttl === 1) return "Auto";
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
    return `${Math.floor(ttl / 86400)}d`;
}

function showToast(message, type) {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.hidden = true;
    }, 3000);
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
}

function hideError() {
    errorEl.hidden = true;
}

function showLoading() {
    loadingEl.hidden = false;
    recordsTable.hidden = true;
    paginationEl.hidden = true;
}

function hideLoading() {
    loadingEl.hidden = true;
}

function populateTypeFilter() {
    const types = [...new Set(allRecords.map(r => r.type))].sort();
    const current = typeFilter.value;
    typeFilter.innerHTML = '<option value="">All types</option>';
    types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeFilter.appendChild(opt);
    });
    typeFilter.value = current;
}

function applyFilters() {
    const search = searchInput.value.toLowerCase().trim();
    const typeVal = typeFilter.value;

    filteredRecords = allRecords.filter(r => {
        if (typeVal && r.type !== typeVal) return false;
        if (search) {
            const haystack = `${r.type} ${r.name} ${r.content}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    totalPages = Math.max(1, Math.ceil(filteredRecords.length / CONFIG.perPage));
    if (currentPage > totalPages) currentPage = totalPages;
    renderRecords();
    renderPagination();
}

function renderRecords() {
    recordsBody.innerHTML = "";

    const start = (currentPage - 1) * CONFIG.perPage;
    const pageRecords = filteredRecords.slice(start, start + CONFIG.perPage);

    if (pageRecords.length === 0) {
        recordsTable.hidden = true;
        if (allRecords.length > 0) {
            showError("No records match your filter.");
        }
        return;
    }

    hideError();
    recordsTable.hidden = false;

    pageRecords.forEach(record => {
        const tr = document.createElement("tr");

        const tdType = document.createElement("td");
        tdType.setAttribute("data-label", "Type");
        const badge = document.createElement("span");
        badge.className = "type-badge";
        badge.textContent = record.type;
        tdType.appendChild(badge);

        const tdName = document.createElement("td");
        tdName.setAttribute("data-label", "Name");
        tdName.className = "record-name";
        tdName.textContent = record.name;

        const tdContent = document.createElement("td");
        tdContent.setAttribute("data-label", "Content");
        tdContent.className = "record-content";
        let displayContent = record.content || "";
        if (record.priority !== undefined && record.priority !== null) {
            displayContent = `${record.priority} ${displayContent}`;
        }
        tdContent.textContent = displayContent;
        tdContent.title = displayContent;

        const tdTtl = document.createElement("td");
        tdTtl.setAttribute("data-label", "TTL");
        tdTtl.className = "ttl-val";
        tdTtl.textContent = formatTtl(record.ttl);

        const tdProxied = document.createElement("td");
        tdProxied.setAttribute("data-label", "Proxied");
        if (record.proxiable) {
            tdProxied.className = record.proxied ? "proxied-on" : "proxied-off";
            tdProxied.textContent = record.proxied ? "ON" : "OFF";
        } else {
            tdProxied.className = "proxied-off";
            tdProxied.textContent = "—";
        }

        const tdActions = document.createElement("td");
        tdActions.className = "actions-col";
        tdActions.setAttribute("data-label", "Actions");

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-secondary btn-sm";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openEditModal(record));

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger btn-sm";
        deleteBtn.textContent = "Del";
        deleteBtn.addEventListener("click", () => openDeleteConfirm(record));

        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdType);
        tr.appendChild(tdName);
        tr.appendChild(tdContent);
        tr.appendChild(tdTtl);
        tr.appendChild(tdProxied);
        tr.appendChild(tdActions);

        recordsBody.appendChild(tr);
    });
}

function renderPagination() {
    paginationEl.innerHTML = "";

    if (totalPages <= 1) {
        paginationEl.hidden = true;
        return;
    }

    paginationEl.hidden = false;

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn btn-secondary btn-sm";
    prevBtn.textContent = "Prev";
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderRecords();
            renderPagination();
        }
    });

    const info = document.createElement("span");
    info.textContent = `${currentPage} / ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-secondary btn-sm";
    nextBtn.textContent = "Next";
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderRecords();
            renderPagination();
        }
    });

    paginationEl.appendChild(prevBtn);
    paginationEl.appendChild(info);
    paginationEl.appendChild(nextBtn);
}

function openModal() {
    modalOverlay.hidden = false;
}

function closeModal() {
    modalOverlay.hidden = true;
    recordForm.reset();
    fieldId.value = "";
    groupPriority.hidden = true;
}

function openAddModal() {
    modalTitle.textContent = "Add Record";
    formSubmit.textContent = "Create";
    fieldType.disabled = false;
    fieldType.value = "A";
    fieldName.value = "";
    fieldContent.value = "";
    fieldPriority.value = "";
    fieldTtl.value = "1";
    fieldId.value = "";
    togglePriorityField();
    openModal();
}

function openEditModal(record) {
    modalTitle.textContent = "Edit Record";
    formSubmit.textContent = "Update";
    fieldType.value = record.type;
    fieldType.disabled = true;
    fieldName.value = record.name;
    fieldContent.value = record.content || "";
    fieldPriority.value = record.priority ?? "";
    fieldTtl.value = String(record.ttl);
    fieldId.value = record.id;
    togglePriorityField();
    openModal();
}

function togglePriorityField() {
    const show = PRIORITY_TYPES.includes(fieldType.value);
    groupPriority.hidden = !show;
    fieldPriority.required = show;
}

function openDeleteConfirm(record) {
    deleteTarget = record;
    confirmMsg.textContent = `Delete ${record.type} record "${record.name}"?`;
    confirmOverlay.hidden = false;
}

function closeDeleteConfirm() {
    confirmOverlay.hidden = true;
    deleteTarget = null;
}

function openSettings() {
    settingDomain.value = CONFIG.domain || "";
    settingZoneId.value = CONFIG.zoneId || "";
    settingApiKey.value = CONFIG.apiKey || "";
    settingsOverlay.hidden = false;
}

function closeSettings() {
    settingsOverlay.hidden = true;
}

function handleSettingsSave(e) {
    e.preventDefault();
    
    CONFIG.domain = settingDomain.value.trim();
    CONFIG.zoneId = settingZoneId.value.trim();
    CONFIG.apiKey = settingApiKey.value.trim();
    
    saveConfig(CONFIG);
    closeSettings();
    
    zoneLabel.textContent = CONFIG.domain;
    showToast("Settings saved", "success");
    
    loadRecords();
}

async function handleSave(e) {
    e.preventDefault();
    formSubmit.disabled = true;
    formSubmit.textContent = "Saving...";

    const type = fieldType.value;
    const name = fieldName.value.trim();
    const content = fieldContent.value.trim();
    const ttl = parseInt(fieldTtl.value, 10);
    const id = fieldId.value;

    const body = { type, name, content, ttl, proxied: false };

    if (PRIORITY_TYPES.includes(type) && fieldPriority.value !== "") {
        body.priority = parseInt(fieldPriority.value, 10);
    }

    try {
        if (id) {
            await apiRequest("PUT", `/zones/${CONFIG.zoneId}/dns_records/${id}`, body);
            showToast("Record updated", "success");
        } else {
            await apiRequest("POST", `/zones/${CONFIG.zoneId}/dns_records`, body);
            showToast("Record created", "success");
        }
        closeModal();
        await loadRecords();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        formSubmit.disabled = false;
        formSubmit.textContent = id ? "Update" : "Create";
    }
}

async function handleDelete() {
    if (!deleteTarget) return;
    confirmOk.disabled = true;
    confirmOk.textContent = "Deleting...";

    try {
        await apiRequest("DELETE", `/zones/${CONFIG.zoneId}/dns_records/${deleteTarget.id}`);
        showToast("Record deleted", "success");
        closeDeleteConfirm();
        await loadRecords();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        confirmOk.disabled = false;
        confirmOk.textContent = "Delete";
    }
}

async function loadRecords() {
    showLoading();
    hideError();

    try {
        allRecords = await fetchAllRecords();
        allRecords.sort((a, b) => {
            if (a.type < b.type) return -1;
            if (a.type > b.type) return 1;
            return a.name.localeCompare(b.name);
        });
        populateTypeFilter();
        applyFilters();
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
}

searchInput.addEventListener("input", () => {
    currentPage = 1;
    applyFilters();
});

typeFilter.addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
});

refreshBtn.addEventListener("click", loadRecords);
addBtn.addEventListener("click", openAddModal);
modalClose.addEventListener("click", closeModal);
formCancel.addEventListener("click", closeModal);
recordForm.addEventListener("submit", handleSave);
confirmClose.addEventListener("click", closeDeleteConfirm);
confirmCancel.addEventListener("click", closeDeleteConfirm);
confirmOk.addEventListener("click", handleDelete);
fieldType.addEventListener("change", togglePriorityField);
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsCancel.addEventListener("click", closeSettings);
settingsForm.addEventListener("submit", handleSettingsSave);

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) closeDeleteConfirm();
});

settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!settingsOverlay.hidden) closeSettings();
        else if (!confirmOverlay.hidden) closeDeleteConfirm();
        else if (!modalOverlay.hidden) closeModal();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    zoneLabel.textContent = CONFIG.domain || "Not configured";
    
    if (!isConfigValid(CONFIG)) {
        openSettings();
    } else {
        loadRecords();
    }
});
