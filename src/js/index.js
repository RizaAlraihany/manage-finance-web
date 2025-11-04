// index.js — merged, fixed, resilient version
const STORAGE_KEY = "transaksiKontrakan";

/* ----------------------------- Utilities ------------------------------ */
function formatCurrency(num) {
  const n = Number(num) || 0;
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString("id-ID");
}
function ambilData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Gagal membaca storage:", e);
    return [];
  }
}
function simpanData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data || []));
}

/* ------------------------ DOM helpers (robust) ------------------------ */
function isHidden(el) {
  if (!el) return true;
  // prefer class-based hidden (Tailwind) but support inline display
  return (
    el.classList.contains("hidden") || getComputedStyle(el).display === "none"
  );
}
function show(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = ""; // allow CSS to control display
}
function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}
function toggle(el) {
  if (!el) return;
  if (isHidden(el)) show(el);
  else hide(el);
}

/* ---------------------------- Rendering ------------------------------- */
function muatUlangTampilan() {
  const semuaData = ambilData();

  // totals
  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  semuaData.forEach((row) => {
    totalPemasukan += Number(row.pemasukan) || 0;
    totalPengeluaran += Number(row.pengeluaran) || 0;
  });
  const saldo = totalPemasukan - totalPengeluaran;

  // summary
  const elIncome =
    document.getElementById("total-income") ||
    document.getElementById("total-pemasukan");
  if (elIncome) elIncome.innerText = formatCurrency(totalPemasukan);
  const elExpense =
    document.getElementById("total-expense") ||
    document.getElementById("total-pengeluaran");
  if (elExpense) elExpense.innerText = formatCurrency(totalPengeluaran);
  const elBalance =
    document.getElementById("balance") ||
    document.getElementById("saldo-akhir");
  if (elBalance) elBalance.innerText = formatCurrency(saldo);
  const elCount =
    document.getElementById("transaction-count") ||
    document.getElementById("total-transaksi");
  if (elCount) elCount.innerText = String(semuaData.length);

  // lists
  const listAll = document.getElementById("transactions-list-all");
  const listIncome = document.getElementById("transactions-list-income");
  const listExpense = document.getElementById("transactions-list-expense");

  function renderList(container, filterFn, emptyMessage) {
    if (!container) return;
    container.innerHTML = "";
    const items = semuaData
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => filterFn(r));
    if (!items.length) {
      container.innerHTML = `<div class="text-center py-8 text-gray-500"><p>${emptyMessage}</p></div>`;
      return;
    }
    items.forEach(({ r, i }) => {
      const div = document.createElement("div");
      div.className =
        "p-4 bg-white rounded-lg shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors border border-gray-100";

      const firstLetter = (r.keterangan || "?").charAt(0).toUpperCase();
      const isIncome = (Number(r.pemasukan) || 0) > 0;
      const avatarBgClass = isIncome
        ? "bg-green-100 text-green-600"
        : "bg-red-100 text-red-600";

      div.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full ${avatarBgClass} flex items-center justify-center font-semibold text-lg">
            ${firstLetter}
          </div>
          <div class="text-left">
            <div class="font-semibold text-slate-800">${
              r.keterangan || "-"
            }</div>
            <div class="text-sm text-slate-500">${
              r.sumber ? r.sumber + " • " : ""
            }${formatDate(r.tanggal)}</div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="font-semibold ${
              isIncome ? "text-green-600" : "text-red-600"
            }">
              ${isIncome ? "+" : "-"}${formatCurrency(
        Number(r.pemasukan) || Number(r.pengeluaran) || 0
      ).replace("Rp ", "")}
            </div>
          </div>
          <div class="flex gap-2">
            <button data-idx="${i}" class="edit-btn hover:text-yellow-600 text-gray-400 transition-colors" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button data-idx="${i}" class="delete-btn hover:text-red-600 text-gray-400 transition-colors" title="Hapus">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    // attach listeners inside container to avoid missing elements
    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.removeEventListener("click", onDeleteClick);
      btn.addEventListener("click", onDeleteClick);
    });
    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.removeEventListener("click", onEditClick);
      btn.addEventListener("click", onEditClick);
    });
  }

  renderList(
    listAll,
    () => true,
    "Belum ada transaksi. Mulai dengan menambah transaksi pertama Anda!"
  );
  renderList(
    listIncome,
    (r) => (Number(r.pemasukan) || 0) > 0,
    "Belum ada data pemasukan. Klik tombol di atas untuk menambah pemasukan pertama!"
  );
  renderList(
    listExpense,
    (r) => (Number(r.pengeluaran) || 0) > 0,
    "Belum ada data pengeluaran. Klik tombol di atas untuk menambah pengeluaran pertama!"
  );
}

/* --------------------------- CRUD Handlers ---------------------------- */
function onDeleteClick(ev) {
  const idx = Number(ev.currentTarget.getAttribute("data-idx"));
  handleDelete(idx);
}
function onEditClick(ev) {
  const idx = Number(ev.currentTarget.getAttribute("data-idx"));
  openEditModalFor(idx);
}
function handleTambahDariForm({ tanggal, keterangan, sumber, tipe, jumlah }) {
  const transaksiBaru = {
    tanggal,
    keterangan,
    sumber,
    pemasukan: tipe === "pemasukan" ? Number(jumlah) : 0,
    pengeluaran: tipe === "pengeluaran" ? Number(jumlah) : 0,
  };
  const data = ambilData();
  data.push(transaksiBaru);
  simpanData(data);
  muatUlangTampilan();
}
function handleDelete(index) {
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;
  const semuaData = ambilData();
  semuaData.splice(index, 1);
  simpanData(semuaData);
  muatUlangTampilan();
}

/* ----------------------------- Edit Modal ---------------------------- */
let modalOverlay,
  modal,
  editForm,
  editIndexHidden,
  editTanggal,
  editKeterangan,
  editSumberKategori,
  editTipe,
  editJumlah,
  editCloseBtn,
  editCancelBtn,
  editSubmitBtn;

function initModalElements() {
  modalOverlay = document.getElementById("edit-modal-overlay");
  modal = document.getElementById("edit-modal");
  editForm = document.getElementById("edit-form");
  editIndexHidden = document.getElementById("edit-index-hidden");
  editTanggal = document.getElementById("edit-tanggal");
  editKeterangan = document.getElementById("edit-keterangan");
  editSumberKategori = document.getElementById("edit-sumber-kategori");
  editTipe = document.getElementById("edit-tipe");
  editJumlah = document.getElementById("edit-jumlah");
  editCloseBtn = document.getElementById("edit-modal-close");
  editCancelBtn = document.getElementById("edit-cancel");
  editSubmitBtn = document.getElementById("edit-submit");

  if (editCloseBtn) editCloseBtn.addEventListener("click", closeEditModal);
  if (editCancelBtn) editCancelBtn.addEventListener("click", closeEditModal);
  if (modalOverlay)
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeEditModal();
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEditModal();
  });
  if (editSubmitBtn) editSubmitBtn.addEventListener("click", handleEditSubmit);
}

function openEditModalFor(index) {
  const semuaData = ambilData();
  const item = semuaData[index];
  if (!item) return;

  // fill
  if (editIndexHidden) editIndexHidden.value = index;
  if (editTanggal) editTanggal.value = item.tanggal || "";
  if (editKeterangan) editKeterangan.value = item.keterangan || "";
  if (editSumberKategori) editSumberKategori.value = item.sumber || "";
  if (editTipe)
    editTipe.value =
      (Number(item.pemasukan) || 0) > 0 ? "pemasukan" : "pengeluaran";
  if (editJumlah)
    editJumlah.value =
      (Number(item.pemasukan) || 0) > 0 ? item.pemasukan : item.pengeluaran;

  // show modal
  if (modalOverlay) show(modalOverlay);
  if (modal) show(modal);
  setTimeout(() => {
    if (editTanggal) editTanggal.focus();
  }, 80);
}

function closeEditModal() {
  if (modalOverlay) hide(modalOverlay);
  if (modal) hide(modal);
  if (editForm) editForm.reset();
}

function handleEditSubmit(e) {
  e && e.preventDefault && e.preventDefault();
  const index = Number(editIndexHidden ? editIndexHidden.value : NaN);
  const tanggal = editTanggal ? editTanggal.value.trim() : "";
  const keterangan = editKeterangan ? editKeterangan.value.trim() : "";
  const sumber = editSumberKategori ? editSumberKategori.value.trim() : "";
  const tipe = editTipe ? editTipe.value : "pemasukan";
  const jumlah = editJumlah ? parseFloat(editJumlah.value) : NaN;

  if (!tanggal || !keterangan || !sumber || isNaN(jumlah) || jumlah <= 0) {
    alert("Harap isi semua field dengan benar.");
    return;
  }

  const transaksiBaru = {
    tanggal,
    keterangan,
    sumber,
    pemasukan: tipe === "pemasukan" ? jumlah : 0,
    pengeluaran: tipe === "pengeluaran" ? jumlah : 0,
  };
  const semuaData = ambilData();
  if (!Number.isFinite(index) || index < 0 || index >= semuaData.length) {
    alert("Index transaksi tidak valid.");
    return;
  }
  semuaData[index] = transaksiBaru;
  simpanData(semuaData);
  muatUlangTampilan();
  closeEditModal();
}

/* -------------------------- Tabs & Toggles --------------------------- */
function initTabsAndToggles() {
  const btnHistory = document.getElementById("menu-history");
  const btnIncome = document.getElementById("menu-income");
  const btnExpense = document.getElementById("menu-expense");
  const contentHistory = document.getElementById("menu-content-history");
  const contentIncome = document.getElementById("menu-content-income");
  const contentExpense = document.getElementById("menu-content-expense");

  function clearActive() {
    [btnHistory, btnIncome, btnExpense].forEach((b) => {
      if (b) {
        b.classList.remove("balance-gradient", "text-white", "shadow-md");
        b.classList.add("text-slate-600");
      }
    });
    [contentHistory, contentIncome, contentExpense].forEach((c) => {
      if (c) hide(c);
    });
  }
  function setActive(tab) {
    clearActive();
    if (tab === "history") {
      if (btnHistory) {
        btnHistory.classList.add("balance-gradient", "text-white", "shadow-md");
      }
      if (contentHistory) show(contentHistory);
    }
    if (tab === "income") {
      if (btnIncome) {
        btnIncome.classList.add("balance-gradient", "text-white", "shadow-md");
      }
      if (contentIncome) show(contentIncome);
    }
    if (tab === "expense") {
      if (btnExpense) {
        btnExpense.classList.add("balance-gradient", "text-white", "shadow-md");
      }
      if (contentExpense) show(contentExpense);
    }
  }

  if (btnHistory)
    btnHistory.addEventListener("click", () => setActive("history"));
  if (btnIncome) btnIncome.addEventListener("click", () => setActive("income"));
  if (btnExpense)
    btnExpense.addEventListener("click", () => setActive("expense"));

  // initial tab logic: try to preserve previous preference (window.FILTER_TYPE or path), default history
  let initial = "history";
  if (window.FILTER_TYPE === "pemasukan" || window.FILTER_TYPE === "income")
    initial = "income";
  if (window.FILTER_TYPE === "pengeluaran" || window.FILTER_TYPE === "expense")
    initial = "expense";
  if ((window.location.pathname || "").includes("pemasukan"))
    initial = "income";
  if ((window.location.pathname || "").includes("pengeluaran"))
    initial = "expense";
  setActive(initial);

  // Toggle buttons for showing/hiding the add forms (they are separate from tabs)
  const btnShowIncomeForm = document.getElementById("btn-show-income-form");
  const btnShowExpenseForm = document.getElementById("btn-show-expense-form");
  const incomeCard = document.getElementById("income-form-card");
  const expenseCard = document.getElementById("expense-form-card");

  if (btnShowIncomeForm && incomeCard) {
    btnShowIncomeForm.addEventListener("click", () => {
      // close other form
      if (!isHidden(expenseCard)) hide(expenseCard);
      toggle(incomeCard);
      btnShowIncomeForm.textContent = isHidden(incomeCard)
        ? "+ Tambah Pemasukan"
        : "Tutup Form";
      if (btnShowExpenseForm)
        btnShowExpenseForm.textContent = "+ Tambah Pengeluaran";
    });
  }
  if (btnShowExpenseForm && expenseCard) {
    btnShowExpenseForm.addEventListener("click", () => {
      if (!isHidden(incomeCard)) hide(incomeCard);
      toggle(expenseCard);
      btnShowExpenseForm.textContent = isHidden(expenseCard)
        ? "+ Tambah Pengeluaran"
        : "Tutup Form";
      if (btnShowIncomeForm)
        btnShowIncomeForm.textContent = "+ Tambah Pemasukan";
    });
  }
}

/* -------------------------- DOM Ready & Wiring ------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  initModalElements();
  initTabsAndToggles();

  // Income form submit (add new)
  const incomeSubmit = document.getElementById("income-submit");
  if (incomeSubmit) {
    incomeSubmit.addEventListener("click", () => {
      const tanggal = document.getElementById("inc-tanggal").value;
      const keterangan = document.getElementById("inc-keterangan").value;
      const sumber = document.getElementById("inc-sumber").value;
      const jumlah = parseFloat(document.getElementById("inc-jumlah").value);
      if (!tanggal || !keterangan || !sumber || isNaN(jumlah) || jumlah <= 0) {
        alert("Harap isi semua field dengan benar.");
        return;
      }
      handleTambahDariForm({
        tanggal,
        keterangan,
        sumber,
        tipe: "pemasukan",
        jumlah,
      });
      document.getElementById("income-add-form").reset();
      const incomeCard = document.getElementById("income-form-card");
      if (incomeCard) hide(incomeCard);
      const btnInc = document.getElementById("btn-show-income-form");
      if (btnInc) btnInc.textContent = "+ Tambah Pemasukan";
    });
  }

  // Expense form submit (add new)
  const expenseSubmit = document.getElementById("expense-submit");
  if (expenseSubmit) {
    expenseSubmit.addEventListener("click", () => {
      const tanggal = document.getElementById("exp-tanggal").value;
      const keterangan = document.getElementById("exp-keterangan").value;
      const kategori = document.getElementById("exp-kategori").value;
      const jumlah = parseFloat(document.getElementById("exp-jumlah").value);
      if (
        !tanggal ||
        !keterangan ||
        !kategori ||
        isNaN(jumlah) ||
        jumlah <= 0
      ) {
        alert("Harap isi semua field dengan benar.");
        return;
      }
      handleTambahDariForm({
        tanggal,
        keterangan,
        sumber: kategori,
        tipe: "pengeluaran",
        jumlah,
      });
      document.getElementById("expense-add-form").reset();
      const expenseCard = document.getElementById("expense-form-card");
      if (expenseCard) hide(expenseCard);
      const btnExp = document.getElementById("btn-show-expense-form");
      if (btnExp) btnExp.textContent = "+ Tambah Pengeluaran";
    });
  }

  // delete last / delete all (if exist)
  const btnHapusTerakhir = document.getElementById("hapus-baris-terakhir");
  if (btnHapusTerakhir)
    btnHapusTerakhir.addEventListener("click", () => {
      if (!confirm("Yakin ingin menghapus transaksi terakhir?")) return;
      const d = ambilData();
      if (d.length) {
        d.pop();
        simpanData(d);
        muatUlangTampilan();
      }
    });
  const btnHapusSemua = document.getElementById("hapus-semua");
  if (btnHapusSemua)
    btnHapusSemua.addEventListener("click", () => {
      if (
        !confirm(
          "YAKIN INGIN MENGHAPUS SEMUA DATA? Tindakan ini tidak bisa dibatalkan!"
        )
      )
        return;
      localStorage.removeItem(STORAGE_KEY);
      muatUlangTampilan();
    });

  // initial render
  muatUlangTampilan();
});

/* ------------------------- Expose for debug --------------------------- */
window._transaksi = { ambilData, simpanData, muatUlangTampilan };
