const CUSTOMERS_KEY = 'familyDebtCustomers';
const DRAWINGS_KEY = 'familyDebtIncomingDrawings';

const state = {
  selectedCustomerId: null,
  transactionMode: 'debt',
};

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

function readJson(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;
}
function todayLabel() {
  return new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);
}
function showToast(message) {
  const toast = qs('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function openModal(id) { qs(`#${id}`).classList.add('show'); }
function closeModal(id) { qs(`#${id}`).classList.remove('show'); }

function getCustomers() {
  return readJson(CUSTOMERS_KEY);
}
function saveCustomers(customers) {
  writeJson(CUSTOMERS_KEY, customers);
}
function getDrawings() {
  return readJson(DRAWINGS_KEY);
}
function saveDrawings(drawings) {
  writeJson(DRAWINGS_KEY, drawings);
}

function calculateStats() {
  const customers = getCustomers();
  const drawings = getDrawings();
  const totalBalance = customers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const transactionsCount = customers.reduce((sum, c) => sum + (c.transactions?.length || 0), 0);
  const newDrawings = drawings.filter(d => d.status === 'جديدة').length;

  qs('#customersCount').textContent = customers.length;
  qs('#totalBalance').textContent = formatCurrency(totalBalance);
  qs('#newDrawingsCount').textContent = newDrawings;
  qs('#transactionsCount').textContent = transactionsCount;
}

function renderCustomers() {
  const list = qs('#customerList');
  const search = qs('#customerSearch').value.trim();
  let customers = getCustomers();

  if (search) {
    customers = customers.filter(c =>
      c.name.includes(search) || (c.phone || '').includes(search)
    );
  }

  if (!customers.length) {
    list.innerHTML = `<div class="empty-state">ماكو زبائن حالياً</div>`;
    return;
  }

  list.innerHTML = customers.map(customer => `
    <article class="customer-card">
      <h3>${escapeHtml(customer.name)}</h3>
      <div class="meta">${escapeHtml(customer.phone || 'بدون رقم')}</div>
      <div class="meta">المتبقي: <strong>${formatCurrency(customer.balance)}</strong></div>
      <div class="mini-note">عدد المعاملات: ${customer.transactions?.length || 0}</div>
      <div class="card-actions">
        <button class="btn primary" onclick="openCustomerDetails('${customer.id}')"><i class="fa-solid fa-folder-open"></i> فتح</button>
        <button class="btn ghost" onclick="editCustomer('${customer.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
        <button class="btn danger" onclick="deleteCustomer('${customer.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
      </div>
    </article>
  `).join('');
}

function renderDrawings() {
  const list = qs('#drawingsList');
  const drawings = getDrawings();

  if (!drawings.length) {
    list.innerHTML = `<div class="empty-state">ماكو رسومات واردة حالياً</div>`;
    return;
  }

  list.innerHTML = drawings.map(drawing => `
    <article class="drawing-card">
      <div class="transaction-head">
        <h3>رسمة واردة</h3>
        <span class="badge ${drawing.status === 'جديدة' ? 'new' : 'done'}">${drawing.status}</span>
      </div>
      <div class="meta">${escapeHtml(drawing.dateLabel || '')} - ${escapeHtml(drawing.timeLabel || '')}</div>
      <img src="${drawing.imageData}" alt="رسمة واردة" />
      <label>تفسير الرسمة</label>
      <textarea onchange="updateDrawingNote('${drawing.id}', this.value)" placeholder="اكتب تفسير الرسمة هنا">${escapeHtml(drawing.note || '')}</textarea>
      <div class="drawing-actions">
        <button class="btn warning" onclick="toggleDrawingStatus('${drawing.id}')"><i class="fa-solid fa-check"></i> تمت المراجعة</button>
        <button class="btn danger" onclick="deleteDrawing('${drawing.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
      </div>
    </article>
  `).join('');
}

function openCustomerModal(editId = null) {
  qs('#customerId').value = editId || '';
  if (editId) {
    const customer = getCustomers().find(c => c.id === editId);
    qs('#customerModalTitle').textContent = 'تعديل زبون';
    qs('#customerName').value = customer?.name || '';
    qs('#customerPhone').value = customer?.phone || '';
  } else {
    qs('#customerModalTitle').textContent = 'إضافة زبون';
    qs('#customerName').value = '';
    qs('#customerPhone').value = '';
  }
  openModal('customerModal');
}

function saveCustomer() {
  const id = qs('#customerId').value;
  const name = qs('#customerName').value.trim();
  const phone = qs('#customerPhone').value.trim();

  if (!name) {
    showToast('اكتب اسم الزبون');
    return;
  }

  const customers = getCustomers();
  if (id) {
    const idx = customers.findIndex(c => c.id === id);
    if (idx > -1) {
      customers[idx].name = name;
      customers[idx].phone = phone;
    }
    showToast('تم تعديل الزبون');
  } else {
    customers.unshift({
      id: `customer_${Date.now()}`,
      name,
      phone,
      balance: 0,
      createdAt: new Date().toISOString(),
      transactions: [],
    });
    showToast('تمت إضافة الزبون');
  }

  saveCustomers(customers);
  closeModal('customerModal');
  refreshAll();
}

function editCustomer(id) {
  openCustomerModal(id);
}

function deleteCustomer(id) {
  const customers = getCustomers().filter(c => c.id !== id);
  saveCustomers(customers);
  if (state.selectedCustomerId === id) closeModal('customerDetailsModal');
  showToast('تم حذف الزبون');
  refreshAll();
}

function openCustomerDetails(id) {
  const customer = getCustomers().find(c => c.id === id);
  if (!customer) return;
  state.selectedCustomerId = id;
  qs('#detailsCustomerName').textContent = customer.name;
  qs('#detailsCustomerPhone').textContent = customer.phone || 'بدون رقم';
  qs('#detailsCustomerBalance').textContent = formatCurrency(customer.balance);

  const container = qs('#transactionsList');
  const transactions = [...(customer.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!transactions.length) {
    container.innerHTML = `<div class="empty-state">ماكو معاملات لهذا الزبون</div>`;
  } else {
    container.innerHTML = transactions.map(item => `
      <article class="transaction-item">
        <div class="transaction-head">
          <span class="badge ${item.type === 'debt' ? 'debt' : 'payment'}">${item.type === 'debt' ? 'دين' : 'تسديد'}</span>
          <strong>${formatCurrency(item.amount)}</strong>
        </div>
        <div class="meta">التاريخ: ${escapeHtml(item.date)}</div>
        <div class="meta">الملاحظة: ${escapeHtml(item.note || 'بدون')}</div>
        <div class="meta">الرصيد بعد العملية: ${formatCurrency(item.balanceAfter)}</div>
      </article>
    `).join('');
  }

  openModal('customerDetailsModal');
}

function openTransactionModal(type) {
  state.transactionMode = type;
  qs('#transactionType').value = type;
  qs('#transactionModalTitle').textContent = type === 'debt' ? 'إضافة دين جديد' : 'إضافة تسديد';
  qs('#transactionAmount').value = '';
  qs('#transactionDate').value = todayLabel();
  qs('#transactionNote').value = '';
  openModal('transactionModal');
}

function saveTransaction() {
  const amount = Number(qs('#transactionAmount').value);
  const date = qs('#transactionDate').value.trim();
  const note = qs('#transactionNote').value.trim();
  const type = qs('#transactionType').value;

  if (!state.selectedCustomerId) return;
  if (!amount || amount <= 0) {
    showToast('اكتب مبلغ صحيح');
    return;
  }

  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === state.selectedCustomerId);
  if (idx === -1) return;

  let balance = Number(customers[idx].balance || 0);
  balance = type === 'debt' ? balance + amount : balance - amount;
  customers[idx].balance = balance;
  customers[idx].transactions = customers[idx].transactions || [];
  customers[idx].transactions.push({
    id: `trx_${Date.now()}`,
    customerId: state.selectedCustomerId,
    type,
    amount,
    date,
    note,
    balanceAfter: balance,
  });

  saveCustomers(customers);
  closeModal('transactionModal');
  openCustomerDetails(state.selectedCustomerId);
  refreshAll();
  showToast(type === 'debt' ? 'تمت إضافة الدين' : 'تمت إضافة التسديدة');
}

function updateDrawingNote(id, note) {
  const drawings = getDrawings();
  const idx = drawings.findIndex(d => d.id === id);
  if (idx === -1) return;
  drawings[idx].note = note;
  saveDrawings(drawings);
  calculateStats();
}

function toggleDrawingStatus(id) {
  const drawings = getDrawings();
  const idx = drawings.findIndex(d => d.id === id);
  if (idx === -1) return;
  drawings[idx].status = drawings[idx].status === 'جديدة' ? 'تمت المراجعة' : 'جديدة';
  saveDrawings(drawings);
  renderDrawings();
  calculateStats();
  showToast('تم تحديث الحالة');
}

function deleteDrawing(id) {
  const drawings = getDrawings().filter(d => d.id !== id);
  saveDrawings(drawings);
  renderDrawings();
  calculateStats();
  showToast('تم حذف الرسمة');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function refreshAll() {
  calculateStats();
  renderCustomers();
  renderDrawings();
}

qsa('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.tab-btn').forEach(b => b.classList.remove('active'));
    qsa('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    qs(`#${btn.dataset.tab}`).classList.add('active');
  });
});

qsa('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

qs('#addCustomerBtn').addEventListener('click', () => openCustomerModal());
qs('#saveCustomerBtn').addEventListener('click', saveCustomer);
qs('#saveTransactionBtn').addEventListener('click', saveTransaction);
qs('#newDebtBtn').addEventListener('click', () => openTransactionModal('debt'));
qs('#newPaymentBtn').addEventListener('click', () => openTransactionModal('payment'));
qs('#customerSearch').addEventListener('input', renderCustomers);
window.addEventListener('storage', refreshAll);

refreshAll();
window.openCustomerDetails = openCustomerDetails;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.updateDrawingNote = updateDrawingNote;
window.toggleDrawingStatus = toggleDrawingStatus;
window.deleteDrawing = deleteDrawing;
