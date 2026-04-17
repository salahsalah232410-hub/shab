import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4Fj5TT82r-8qTLThEzZOEPynpYqDvlog",
  authDomain: "ggkf-7212f.firebaseapp.com",
  projectId: "ggkf-7212f",
  storageBucket: "ggkf-7212f.firebasestorage.app",
  messagingSenderId: "1066581984320",
  appId: "1:1066581984320:web:2f93338048d15291660ba5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const state = {
  selectedCustomerId: null,
  transactionMode: 'debt',
};

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const audioPlayer = qs('#audioPlayer');

let customersData = [];
let drawingsData = [];

// استماع تلقائي للزبائن
onSnapshot(query(collection(db, "customers"), orderBy("createdAt", "desc")), (snapshot) => {
  customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  refreshAll();
});

// استماع تلقائي للرسومات
onSnapshot(query(collection(db, "drawings"), orderBy("createdAt", "desc")), (snapshot) => {
  drawingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  refreshAll();
});

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

function calculateStats() {
  const totalBalance = customersData.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const transactionsCount = customersData.reduce((sum, c) => sum + (c.transactions?.length || 0), 0);
  const newDrawings = drawingsData.filter(d => d.status === 'جديدة').length;

  qs('#customersCount').textContent = customersData.length;
  qs('#totalBalance').textContent = formatCurrency(totalBalance);
  qs('#newDrawingsCount').textContent = newDrawings;
  qs('#transactionsCount').textContent = transactionsCount;
}

function renderCustomers() {
  const list = qs('#customerList');
  const search = qs('#customerSearch').value.trim();
  let filtered = customersData;

  if (search) {
    filtered = filtered.filter(c => c.name.includes(search) || (c.phone || '').includes(search));
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">ماكو زبائن حالياً</div>`;
    return;
  }

  list.innerHTML = filtered.map(customer => `
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

  if (!drawingsData.length) {
    list.innerHTML = `<div class="empty-state">ماكو رسومات واردة حالياً</div>`;
    return;
  }

  list.innerHTML = drawingsData.map(drawing => `
    <article class="drawing-card">
      <div class="transaction-head">
        <h3 style="margin: 0;">رسمة جديدة</h3>
        <span class="badge ${drawing.status === 'جديدة' ? 'new' : 'done'}">${drawing.status}</span>
      </div>
      
      <div class="drawing-data">
        <div><strong>الاسم:</strong> ${escapeHtml(drawing.recognizedName || drawing.recognizedText || 'غير معروف')}</div>
        <div><strong>الرقم:</strong> ${escapeHtml(drawing.recognizedNumber || 'غير معروف')}</div>
      </div>

      <div class="meta" style="margin-top: 10px; margin-bottom: 14px; font-weight: bold;">تاريخ الإرسال: ${escapeHtml(drawing.dateLabel || '')} - ${escapeHtml(drawing.timeLabel || '')}</div>
      
      <div class="drawing-actions">
        <button class="btn primary" onclick="previewImage('${escapeHtml(drawing.imageData)}')"><i class="fa-solid fa-eye"></i> معاينة اللوحة</button>
        <button class="btn ${drawing.status === 'جديدة' ? 'warning' : 'success'}" onclick="toggleDrawingStatus('${drawing.id}')"><i class="fa-solid fa-check"></i> ${drawing.status === 'جديدة' ? 'تمت المراجعة' : 'إلغاء المراجعة'}</button>
        <button class="btn danger" onclick="deleteDrawing('${drawing.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
        
        ${drawing.audioData ? `
          <button class="btn info" onclick="playAudio('${drawing.audioData}')"><i class="fa-solid fa-volume-high"></i> استماع</button>
        ` : ''}
        ${drawing.audioText ? `
          <button class="btn ghost" onclick="showVoiceText('${escapeHtml(drawing.audioText)}')"><i class="fa-solid fa-file-lines"></i> معاينة النص</button>
        ` : ''}
      </div>
    </article>
  `).join('');
}

window.previewImage = function(imgData) {
  qs('#previewImageSrc').src = imgData;
  openModal('previewModal');
}

window.playAudio = function(audioBase64) {
  audioPlayer.src = audioBase64;
  audioPlayer.play().catch(e => showToast('حدث خطأ في تشغيل الصوت'));
  showToast('جاري تشغيل الصوت...');
}

window.showVoiceText = function(text) {
  qs('#voiceTextContent').textContent = text;
  openModal('voiceTextModal');
}

function openCustomerModal(editId = null) {
  qs('#customerId').value = editId || '';
  if (editId) {
    const customer = customersData.find(c => c.id === editId);
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

async function saveCustomer() {
  const id = qs('#customerId').value;
  const name = qs('#customerName').value.trim();
  const phone = qs('#customerPhone').value.trim();

  if (!name) {
    showToast('اكتب اسم الزبون');
    return;
  }

  if (id) {
    await updateDoc(doc(db, "customers", id), { name, phone });
    showToast('تم تعديل الزبون');
  } else {
    await addDoc(collection(db, "customers"), {
      name,
      phone,
      balance: 0,
      createdAt: serverTimestamp(),
      transactions: [],
    });
    showToast('تمت إضافة الزبون');
  }
  closeModal('customerModal');
}

window.editCustomer = function(id) {
  openCustomerModal(id);
}

window.deleteCustomer = async function(id) {
  await deleteDoc(doc(db, "customers", id));
  if (state.selectedCustomerId === id) closeModal('customerDetailsModal');
  showToast('تم حذف الزبون');
}

window.openCustomerDetails = function(id) {
  const customer = customersData.find(c => c.id === id);
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

async function saveTransaction() {
  const amount = Number(qs('#transactionAmount').value);
  const date = qs('#transactionDate').value.trim();
  const note = qs('#transactionNote').value.trim();
  const type = qs('#transactionType').value;

  if (!state.selectedCustomerId || !amount || amount <= 0) return;

  const customer = customersData.find(c => c.id === state.selectedCustomerId);
  if (!customer) return;

  let balance = Number(customer.balance || 0);
  balance = type === 'debt' ? balance + amount : balance - amount;

  const newTransaction = {
    id: `trx_${Date.now()}`,
    type,
    amount,
    date,
    note,
    balanceAfter: balance,
  };

  const updatedTransactions = customer.transactions ? [...customer.transactions, newTransaction] : [newTransaction];

  await updateDoc(doc(db, "customers", state.selectedCustomerId), {
    balance: balance,
    transactions: updatedTransactions
  });

  closeModal('transactionModal');
  openCustomerDetails(state.selectedCustomerId);
  showToast(type === 'debt' ? 'تمت إضافة الدين' : 'تمت إضافة التسديدة');
}

window.toggleDrawingStatus = async function(id) {
  const drawing = drawingsData.find(d => d.id === id);
  if (!drawing) return;
  const newStatus = drawing.status === 'جديدة' ? 'تمت المراجعة' : 'جديدة';
  await updateDoc(doc(db, "drawings", id), { status: newStatus });
  showToast('تم تحديث الحالة');
}

window.deleteDrawing = async function(id) {
  await deleteDoc(doc(db, "drawings", id));
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
  btn.addEventListener('click', () => {
    closeModal(btn.dataset.close);
    // إيقاف الصوت عند إغلاق النوافذ
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  });
});

qs('#addCustomerBtn').addEventListener('click', () => openCustomerModal());
qs('#saveCustomerBtn').addEventListener('click', saveCustomer);
qs('#saveTransactionBtn').addEventListener('click', saveTransaction);
qs('#newDebtBtn').addEventListener('click', () => openTransactionModal('debt'));
qs('#newPaymentBtn').addEventListener('click', () => openTransactionModal('payment'));
qs('#customerSearch').addEventListener('input', renderCustomers);
