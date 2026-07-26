/* ==========================================================================
   UdharPayInd - Automated Billing & WhatsApp Reminder Platform
   Application Logic, Unified Card View & Service Worker Registration
   ========================================================================== */

// Register Service Worker for PWA Offline Caching & Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('✅ UdharPayInd Service Worker Registered Successfully:', registration.scope);
      })
      .catch(error => {
        console.error('⚠️ Service Worker Registration Failed:', error);
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. Persistent Multi-Account Database Keys & Boot State
  // ==========================================
  const CURRENT_USER_KEY = 'udharpayind_active_user_phone';
  const LOGGED_IN_SESSION_KEY = 'udharpayind_is_logged_in';

  // Initial Default Seed Data (Fresh Empty Database for New Users)
  const defaultClients = [];
  const defaultTransactions = [];

  const defaultTemplates = {
    monthly_bill: `Namaste {Client_Name} ji! 🙏\n\nYour {Service_Type} bill for {Month} is ₹{Amount}.\n\n💳 Pay via UPI ID: {UPI_ID}\n\n📸 Please send a payment screenshot after paying for our records.\n\nThank you for your prompt payment!\n- {Service_Type} Auto-Billing (UdharPayInd)`,
    urgent_overdue: `⚠️ URGENT REMINDER: Namaste {Client_Name} ji.\n\nYour pending balance of ₹{Amount} for {Service_Type} is overdue since {Due_Date}.\n\n💳 Pay via UPI ID: {UPI_ID}\n\n📸 Please send a payment screenshot after paying for our records.\n\nThank you!\n- UdharPayInd Alert`,
    milk_weekly: `🥛 Milk Delivery Weekly Summary:\n\nNamaste {Client_Name} ji! Total milk Udhar for this week is ₹{Amount}.\n\n💳 Pay via UPI ID: {UPI_ID}\n\n📸 Please send a payment screenshot after paying for our records.\nHave a healthy week!\n- UdharPayInd`,
    tuition_fee: `📚 Tuition Fee Notice:\n\nDear Parent of {Client_Name}, July tuition fee of ₹{Amount} is due. Please pay by {Due_Date}.\n\n💳 Pay via UPI ID: {UPI_ID}\n\n📸 Please send a payment screenshot after paying for our records.\nThank you!\n- UdharPayInd Notice`,
    payment_thankyou: `💚 PAYMENT RECEIVED! Thank you {Client_Name} ji. We received ₹{Amount} for {Service_Type} on UPI ID: {UPI_ID}.\n\n📸 Receipt recorded. Thank you for your business!\n- UdharPayInd Receipt`
  };

  const defaultMerchant = {
    businessName: '',
    businessPhone: '',
    pin: '',
    upiId: '',
    defaultDispatch: 'direct',
    phoneNumberId: '',
    accessToken: ''
  };

  // Active User & Login State
  let activePhone = localStorage.getItem(CURRENT_USER_KEY) || '';
  let isLoggedIn = localStorage.getItem(LOGGED_IN_SESSION_KEY) === 'true';

  function getStorageKey(type) {
    return `udharpayind_${activePhone}_${type}`;
  }

  function loadAccountData(phone) {
    activePhone = phone;
    isLoggedIn = true;
    localStorage.setItem(CURRENT_USER_KEY, activePhone);
    localStorage.setItem(LOGGED_IN_SESSION_KEY, 'true');

    const savedClients = JSON.parse(localStorage.getItem(getStorageKey('clients')));
    const savedTransactions = JSON.parse(localStorage.getItem(getStorageKey('transactions')));
    const savedMerchant = JSON.parse(localStorage.getItem(getStorageKey('merchant')));
    const savedTemplates = JSON.parse(localStorage.getItem(getStorageKey('templates')));

    state.clients = savedClients || [];
    state.transactions = savedTransactions || [];
    state.merchant = savedMerchant || { ...defaultMerchant, businessPhone: phone };
    state.templates = savedTemplates || defaultTemplates;

    if (!savedClients) saveClientsDB();
    if (!savedTransactions) saveTransactionsDB();
    if (!savedMerchant) saveMerchantDB();
    if (!savedTemplates) saveTemplatesDB();
  }

  const state = {
    clients: [],
    transactions: [],
    merchant: {},
    templates: {},

    activeCategoryFilter: 'all',
    activeStatusFilter: 'all',
    searchQuery: '',
    selectedTemplateKey: 'monthly_bill',
    currentDispatchClient: null
  };

  function syncServiceWorkerAutoNotifications() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_AUTO_NOTIFICATIONS',
        clients: state.clients
      });
    }
  }

  function saveClientsDB() {
    localStorage.setItem(getStorageKey('clients'), JSON.stringify(state.clients));
    syncServiceWorkerAutoNotifications();
  }

  function saveTransactionsDB() {
    localStorage.setItem(getStorageKey('transactions'), JSON.stringify(state.transactions));
  }

  function saveMerchantDB() {
    localStorage.setItem(getStorageKey('merchant'), JSON.stringify(state.merchant));
  }

  function saveTemplatesDB() {
    localStorage.setItem(getStorageKey('templates'), JSON.stringify(state.templates));
  }

  if (activePhone) {
    loadAccountData(activePhone);
  }

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const clientCardsGrid = document.getElementById('client-cards-grid');
  const globalSearchInput = document.getElementById('global-search');
  const categoryChips = document.querySelectorAll('#category-filter-chips .chip-btn');
  const statusSelectFilter = document.getElementById('status-select-filter');
  const mobileNavButtons = document.querySelectorAll('.mobile-nav-btn');

  // Header Elements & Animated User Logo
  const headerUserBadge = document.getElementById('header-user-badge');
  const headerUserAvatar = document.getElementById('header-user-avatar');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserPhone = document.getElementById('header-user-phone');
  const openLoginModalBtn = document.getElementById('open-login-modal-btn');
  const openMerchantSetupBtn = document.getElementById('open-merchant-setup-btn');

  // Metrics
  const metricTotalUdhar = document.getElementById('metric-total-udhar');
  const metricCollectedMonth = document.getElementById('metric-collected-month');
  const metricRemindersQueued = document.getElementById('metric-reminders-queued');
  const metricOverdueClients = document.getElementById('metric-overdue-clients');
  const clientCountBadge = document.getElementById('client-count-badge');

  // Templates & Mockup
  const templatePresetSelect = document.getElementById('template-preset-select');
  const templateEditor = document.getElementById('template-editor');
  const varChips = document.querySelectorAll('.var-chip');
  const liveWaPreviewBubble = document.getElementById('live-wa-preview-bubble');
  const saveTemplateBtn = document.getElementById('save-template-btn');
  const testDispatchBtn = document.getElementById('test-dispatch-btn');
  const waMockupSender = document.getElementById('wa-mockup-sender');
  const waMockupAvatar = document.getElementById('wa-mockup-avatar');

  // Quick Entry Form
  const quickEntryForm = document.getElementById('quick-entry-form');
  const entryClientSelect = document.getElementById('entry-client-select');
  const entryAmountInput = document.getElementById('entry-amount');
  const entryDateInput = document.getElementById('entry-date');
  const entryNotesInput = document.getElementById('entry-notes');
  const btnTypeDebit = document.getElementById('btn-type-debit');
  const btnTypeCredit = document.getElementById('btn-type-credit');
  const transactionHistoryList = document.getElementById('transaction-history-list');
  let currentEntryType = 'debit';

  // Modals
  const addClientModal = document.getElementById('add-client-modal');
  const openAddClientModalBtn = document.getElementById('open-add-client-modal');
  const closeAddModalBtn = document.getElementById('close-add-modal');
  const cancelAddModalBtn = document.getElementById('cancel-add-modal');
  const addClientForm = document.getElementById('add-client-form');

  const settleModal = document.getElementById('settle-modal');
  const closeSettleModalBtn = document.getElementById('close-settle-modal');
  const cancelSettleModalBtn = document.getElementById('cancel-settle-modal');
  const settleForm = document.getElementById('settle-form');
  const settleClientName = document.getElementById('settle-client-name');
  const settleClientId = document.getElementById('settle-client-id');
  const settleCurrentDue = document.getElementById('settle-current-due');
  const settleAmountInput = document.getElementById('settle-amount-input');

  // Real WhatsApp Dispatch Modal Elements
  const waModal = document.getElementById('wa-modal');
  const closeWaModalBtn = document.getElementById('close-wa-modal');
  const cancelWaModalBtn = document.getElementById('cancel-wa-modal');
  const waModalSenderInfo = document.getElementById('wa-modal-sender-info');
  const waModalRecipient = document.getElementById('wa-modal-recipient');
  const waModalMessageEditor = document.getElementById('wa-modal-message-editor');
  const openWaDirectLink = document.getElementById('open-wa-direct-link');
  const dispatchModeDirectRadio = document.getElementById('dispatch-mode-direct');
  const dispatchModeApiRadio = document.getElementById('dispatch-mode-api');
  const cloudApiInspector = document.getElementById('cloud-api-inspector');
  const apiJsonPreview = document.getElementById('api-json-preview');

  // Merchant Setup Modal Elements
  const merchantSetupModal = document.getElementById('merchant-setup-modal');
  const closeMerchantModalBtn = document.getElementById('close-merchant-modal');
  const cancelMerchantModalBtn = document.getElementById('cancel-merchant-modal');
  const merchantSetupForm = document.getElementById('merchant-setup-form');
  const merchantBusinessNameInput = document.getElementById('merchant-business-name');
  const merchantBusinessPhoneInput = document.getElementById('merchant-business-phone');
  const merchantUpiIdInput = document.getElementById('merchant-upi-id');
  const merchantDefaultDispatchSelect = document.getElementById('merchant-default-dispatch');
  const merchantPhoneNumberIdInput = document.getElementById('merchant-phone-number-id');
  const merchantAccessTokenInput = document.getElementById('merchant-access-token');

  // Force purge legacy demo data so new/fresh app sessions start with ZERO demo clients
  function purgeLegacyDemoData() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('udharpayind_')) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(val) && val.some(c => c && c.name === 'Ramesh Kumar')) {
            localStorage.removeItem(key);
          }
        } catch (e) {}
      }
    }
  }
  purgeLegacyDemoData();

  // Login Modal Elements
  const loginAccountModal = document.getElementById('login-account-modal');
  const closeLoginModalBtn = document.getElementById('close-login-modal');
  const cancelLoginModalBtn = document.getElementById('cancel-login-modal');
  const loginAccountForm = document.getElementById('login-account-form');
  const loginNameInput = document.getElementById('login-name-input');
  const loginPhoneInput = document.getElementById('login-phone-input');
  const loginPinInput = document.getElementById('login-pin-input');
  const loginUpiInput = document.getElementById('login-upi-input');

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toastContainer = document.getElementById('toast-container');

  if (entryDateInput) {
    entryDateInput.value = new Date().toISOString().split('T')[0];
  }

  // ==========================================
  // 3. Helper & Format Functions
  // ==========================================
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '⚠️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function cleanPhoneNumber(phoneStr) {
    let cleaned = phoneStr.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  }

  // Dynamically update logged-in state & animated user badge logo
  function updateMerchantHeaderDisplay() {
    const bizName = state.merchant.businessName || 'Sharma Dairy';
    const bizPhone = state.merchant.businessPhone || activePhone;
    
    // Extract 2 initials for animated glowing avatar logo
    const words = bizName.trim().split(' ');
    let initials = 'UP';
    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      initials = words[0].substring(0, 2).toUpperCase();
    }

    if (isLoggedIn) {
      openLoginModalBtn.style.display = 'none'; // HIDE LOGIN BUTTON WHEN LOGGED IN
      headerUserBadge.style.display = 'inline-flex'; // SHOW ANIMATED LOGO BADGE
      headerUserName.textContent = bizName;
      headerUserPhone.textContent = bizPhone;
      headerUserAvatar.textContent = initials;
    } else {
      openLoginModalBtn.style.display = 'inline-flex'; // SHOW LOGIN BUTTON IF LOGGED OUT
      headerUserBadge.style.display = 'none'; // HIDE BADGE
    }

    waMockupSender.textContent = bizName;
    waMockupAvatar.textContent = initials;
  }

  function getCategoryAvatarClass(category) {
    switch (category) {
      case 'Milk': return 'avatar-milk';
      case 'Grocery': return 'avatar-grocery';
      case 'Tuition': return 'avatar-tuition';
      case 'Rent': return 'avatar-rent';
      default: return 'avatar-milk';
    }
  }

  function getCategoryIcon(category) {
    switch (category) {
      case 'Milk': return '🥛 Milk';
      case 'Grocery': return '🛒 Grocery';
      case 'Tuition': return '📚 Tuition';
      case 'Rent': return '🏠 Rent';
      default: return '📦 Service';
    }
  }

  function getDueStatusPillHTML(client) {
    if (client.amountDue <= 0) {
      return `<span class="due-status-pill due-status-ok">✅ Paid</span>`;
    }
    if (client.daysOverdue > 15) {
      return `<span class="due-status-pill due-status-overdue">🔴 ${client.daysOverdue}d Overdue</span>`;
    }
    return `<span class="due-status-pill due-status-near">⏰ Due Soon</span>`;
  }

  function checkAndShowDueAlertBanner() {
    const pendingClients = state.clients.filter(c => c.amountDue > 0);
    const totalPendingAmt = pendingClients.reduce((sum, c) => sum + c.amountDue, 0);

    if (pendingClients.length === 0) {
      if (dueReminderAlertBanner) dueReminderAlertBanner.style.display = 'none';
      return;
    }

    if (dueReminderAlertBanner) dueReminderAlertBanner.style.display = 'flex';
    if (dueBannerBadge) dueBannerBadge.textContent = `${pendingClients.length} Due Pending`;
    if (dueBannerText) {
      dueBannerText.textContent = `${pendingClients.length} clients have payment due dates near or overdue (${formatCurrency(totalPendingAmt)} Total Due). Trigger device notification or send WhatsApp reminders!`;
    }
  }

  function sendDevicePushNotification(title, body) {
    if (!('Notification' in window)) {
      showToast('System Notifications not supported on this device/browser.', 'info');
      return;
    }

    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            vibrate: [200, 100, 200, 100, 200],
            tag: 'udharpayind-due-reminder',
            renotify: true
          });
        });
      } else {
        new Notification(title, {
          body: body,
          icon: 'icon-192.png'
        });
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          sendDevicePushNotification(title, body);
        }
      });
    }
  }

  function triggerAllDueNotifications() {
    const pendingClients = state.clients.filter(c => c.amountDue > 0);
    if (pendingClients.length === 0) {
      showToast('No pending payment due dates found!', 'info');
      return;
    }

    const firstClient = pendingClients[0];
    const title = `🔔 UdharPayInd Due Date Alert!`;
    const body = `${pendingClients.length} client(s) have upcoming bills! (e.g. ${firstClient.name} - ${formatCurrency(firstClient.amountDue)} due for ${firstClient.category}). Tap to open dashboard.`;

    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          sendDevicePushNotification(title, body);
          showToast('🔔 Phone & Laptop System Push Notifications Enabled!', 'success');
        } else {
          showToast('Notification permission denied by user.', 'warning');
        }
      });
    } else {
      sendDevicePushNotification(title, body);
      showToast(`🔔 Sent System Notification for ${pendingClients.length} pending due dates!`, 'success');
    }
  }

  function processTemplateVariables(templateStr, client = null) {
    const targetName = client ? client.name : 'Ramesh Kumar';
    const targetAmount = client ? formatCurrency(client.amountDue) : '₹1,450';
    const targetService = client ? getCategoryIcon(client.category) : 'Milk Supplier';
    const targetDueDate = '1st of Month';
    const targetUpiId = state.merchant.upiId || 'sharmadairy@upi';
    const targetMonth = 'July';

    return templateStr
      .replace(/{Client_Name}/g, targetName)
      .replace(/{Amount}/g, targetAmount)
      .replace(/{UPI_ID}/g, targetUpiId)
      .replace(/{Service_Type}/g, targetService)
      .replace(/{Due_Date}/g, targetDueDate)
      .replace(/{Month}/g, targetMonth);
  }

  // ==========================================
  // 4. REAL-TIME DYNAMIC METRICS CALCULATOR
  // ==========================================
  function updateMetrics() {
    const totalDue = state.clients.reduce((acc, c) => acc + (c.amountDue || 0), 0);
    const totalCollected = state.transactions
      .filter(t => t.type === 'credit')
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    const overdueCount = state.clients.filter(c => c.daysOverdue > 15 && c.amountDue > 0).length;
    const queuedCount = state.clients.filter(c => c.amountDue > 0).length;

    metricTotalUdhar.textContent = formatCurrency(totalDue);
    metricCollectedMonth.textContent = formatCurrency(totalCollected);
    metricOverdueClients.textContent = `${overdueCount} Overdue`;
    metricRemindersQueued.textContent = `${queuedCount} Pending`;
    clientCountBadge.textContent = state.clients.length;

    checkAndShowDueAlertBanner();
  }

  // ==========================================
  // 5. MOBILE BOTTOM NAVIGATION SWITCHER
  // ==========================================
  mobileNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      // 1. Highlight clicked nav button
      mobileNavButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. Switch active mobile section
      document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('mobile-active');
      });

      const targetSec = document.getElementById(targetId);
      if (targetSec) {
        targetSec.classList.add('mobile-active');
        targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ==========================================
  // 6. Render Active Clients CARD VIEW (Used for BOTH Computer & Mobile Mode)
  // ==========================================
  function renderLedgerTable() {
    clientCardsGrid.innerHTML = '';

    const filteredClients = state.clients.filter(client => {
      if (state.activeCategoryFilter !== 'all' && client.category !== state.activeCategoryFilter) return false;
      if (state.activeStatusFilter === 'overdue' && (client.daysOverdue <= 15 || client.amountDue <= 0)) return false;
      if (state.activeStatusFilter === 'due_soon' && client.amountDue <= 0) return false;
      if (state.activeStatusFilter === 'paid' && client.amountDue > 0) return false;
      if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase();
        const matchName = client.name.toLowerCase().includes(query);
        const matchPhone = client.phone.includes(query);
        const matchCategory = client.category.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchCategory) return false;
      }
      return true;
    });

    if (filteredClients.length === 0) {
      clientCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 2rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--whatsapp-green);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">✨</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
            Clean & Fresh Ledger
          </div>
          <div style="font-size: 0.88rem; max-width: 480px; margin: 0 auto 1.25rem auto; color: var(--text-secondary);">
            No client records found. Click "+ Add Client / Udhar" to record your first customer.
          </div>
          <button class="btn btn-primary" onclick="document.getElementById('open-add-client-modal').click()">
            + Add First Client
          </button>
        </div>
      `;
      return;
    }

    filteredClients.forEach(client => {
      const amountClass = client.amountDue > 5000 ? 'amount-high' : client.amountDue > 0 ? 'amount-medium' : 'amount-zero';

      // UNIFIED CLIENT CARD
      const card = document.createElement('div');
      card.className = 'client-card-item';
      card.innerHTML = `
        <div class="client-card-top">
          <div class="client-info-cell">
            <div class="avatar ${getCategoryAvatarClass(client.category)}">
              ${client.name.charAt(0)}
            </div>
            <div class="client-details">
              <div class="client-name">${client.name}</div>
              <div class="client-phone">${client.phone}</div>
            </div>
          </div>
          <span class="category-badge">${getCategoryIcon(client.category)}</span>
        </div>

        <div class="client-card-meta">
          <div class="card-meta-item">
            <span class="card-meta-label">Outstanding Due</span>
            <span class="due-amount-cell ${amountClass}">${formatCurrency(client.amountDue)}</span>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Billing Cycle</span>
            <span class="card-meta-val">${client.billingFrequency}</span>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Last Sent</span>
            <span class="card-meta-val" style="font-size: 0.78rem; color: var(--text-muted);">${client.lastReminder}</span>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Due Status</span>
            <div style="margin-top: 4px;">
              ${getDueStatusPillHTML(client)}
            </div>
          </div>
        </div>

        <div class="client-card-actions">
          <button class="btn wa-send-btn trigger-wa-btn" data-id="${client.id}" style="flex: 1;">
            📱 Send Remind
          </button>
          <button class="btn settle-btn trigger-settle-btn" data-id="${client.id}">
            💚 Settle
          </button>
          <button class="btn delete-btn trigger-delete-btn" data-id="${client.id}">
            🗑️
          </button>
        </div>
      `;
      clientCardsGrid.appendChild(card);
    });

    // Attach Event Listeners to Card Buttons

    document.querySelectorAll('.trigger-wa-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openWhatsAppModal(id);
      });
    });

    document.querySelectorAll('.trigger-settle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openSettleModal(id);
      });
    });

    document.querySelectorAll('.trigger-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const client = state.clients.find(c => c.id === id);
        if (client) {
          if (confirm(`Are you sure you want to remove client "${client.name}" from your ledger?`)) {
            state.clients = state.clients.filter(c => c.id !== id);
            saveClientsDB(); // PERSIST TO DATABASE
            updateMetrics();
            renderLedgerTable();
            populateEntryClientDropdown();
            showToast(`Client ${client.name} has been removed.`, 'warning');
          }
        }
      });
    });
  }

  function populateEntryClientDropdown() {
    entryClientSelect.innerHTML = '';
    state.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${getCategoryIcon(c.category)} - Due: ${formatCurrency(c.amountDue)})`;
      entryClientSelect.appendChild(opt);
    });
  }

  function renderTransactionHistory() {
    transactionHistoryList.innerHTML = '';
    if (state.transactions.length === 0) {
      transactionHistoryList.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No recent transactions recorded.</div>`;
      return;
    }

    state.transactions.slice().reverse().forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      const isDebit = tx.type === 'debit';
      const iconClass = isDebit ? 'tx-debit-icon' : 'tx-credit-icon';
      const amountSign = isDebit ? '+' : '-';
      const amountColor = isDebit ? 'var(--rose-danger)' : 'var(--emerald-success)';

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="tx-badge ${iconClass}">${isDebit ? '⬆' : '⬇'}</div>
          <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${tx.clientName}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${tx.notes || 'Ledger Entry'} • ${tx.date}</div>
          </div>
        </div>
        <div style="font-weight: 800; font-size: 1rem; color: ${amountColor}">
          ${amountSign} ${formatCurrency(tx.amount)}
        </div>
      `;
      transactionHistoryList.appendChild(item);
    });
  }

  // ==========================================
  // 7. Template Engine & Live Preview
  // ==========================================
  function updateTemplateEditorAndPreview() {
    const rawTemplate = templateEditor.value;
    const processedText = processTemplateVariables(rawTemplate);
    liveWaPreviewBubble.childNodes[0].nodeValue = processedText + "\n\n";
  }

  templatePresetSelect.addEventListener('change', (e) => {
    state.selectedTemplateKey = e.target.value;
    templateEditor.value = state.templates[state.selectedTemplateKey] || '';
    updateTemplateEditorAndPreview();
  });

  templateEditor.addEventListener('input', () => updateTemplateEditorAndPreview());

  varChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const varTag = chip.getAttribute('data-var');
      const start = templateEditor.selectionStart;
      const end = templateEditor.selectionEnd;
      const val = templateEditor.value;

      templateEditor.value = val.substring(0, start) + varTag + val.substring(end);
      templateEditor.focus();
      templateEditor.selectionStart = templateEditor.selectionEnd = start + varTag.length;
      updateTemplateEditorAndPreview();
      showToast(`Inserted variable ${varTag}`, 'info');
    });
  });

  saveTemplateBtn.addEventListener('click', () => {
    state.templates[state.selectedTemplateKey] = templateEditor.value;
    saveTemplatesDB(); // PERSIST
    showToast('WhatsApp Template saved to database!', 'success');
  });

  testDispatchBtn.addEventListener('click', () => {
    openWhatsAppModal(state.clients[0].id);
  });

  // ==========================================
  // 8. REAL WHATSAPP DISPATCH MODAL WITH INLINE EDITING & SCROLLBAR
  // ==========================================
  function updateDispatchModalTargets() {
    const client = state.currentDispatchClient || state.clients[0];
    const editedMessage = waModalMessageEditor.value;

    const cleanPhone = cleanPhoneNumber(client.phone);
    const encodedText = encodeURIComponent(editedMessage);
    const waDirectUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

    openWaDirectLink.href = waDirectUrl;

    const cloudApiPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: {
        preview_url: true,
        body: editedMessage
      }
    };

    apiJsonPreview.textContent = JSON.stringify(cloudApiPayload, null, 2);
  }

  function openWhatsAppModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    state.currentDispatchClient = client;

    waModalSenderInfo.textContent = `WA Biz: ${state.merchant.businessPhone}`;
    waModalRecipient.textContent = `${client.name} (${client.phone})`;

    const message = processTemplateVariables(templateEditor.value || state.templates.monthly_bill, client);
    waModalMessageEditor.value = message;

    updateDispatchModalTargets();

    if (state.merchant.defaultDispatch === 'cloud_api') {
      dispatchModeApiRadio.checked = true;
      cloudApiInspector.style.display = 'block';
      openWaDirectLink.textContent = '⚡ Execute Meta Cloud API Send';
    } else {
      dispatchModeDirectRadio.checked = true;
      cloudApiInspector.style.display = 'none';
      openWaDirectLink.textContent = '🚀 Dispatch via WhatsApp Web / App';
    }

    waModal.classList.add('active');
  }

  waModalMessageEditor.addEventListener('input', () => {
    updateDispatchModalTargets();
  });

  dispatchModeDirectRadio.addEventListener('change', () => {
    cloudApiInspector.style.display = 'none';
    openWaDirectLink.textContent = '🚀 Dispatch via WhatsApp Web / App';
  });

  dispatchModeApiRadio.addEventListener('change', () => {
    cloudApiInspector.style.display = 'block';
    openWaDirectLink.textContent = '⚡ Execute Meta Cloud API Send';
  });

  openWaDirectLink.addEventListener('click', (e) => {
    const client = state.currentDispatchClient;
    if (dispatchModeApiRadio.checked) {
      e.preventDefault();
      client.lastReminder = 'Sent via Cloud API (' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ')';
      saveClientsDB(); // PERSIST
      renderLedgerTable();
      waModal.classList.remove('active');
      showToast(`Meta Cloud API HTTP 200 OK: Reminder dispatched to ${client.name}!`, 'success');
    } else {
      client.lastReminder = 'Sent via WhatsApp App (' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ')';
      saveClientsDB(); // PERSIST
      renderLedgerTable();
      waModal.classList.remove('active');
      showToast(`Opening WhatsApp Web/App for ${client.name}...`, 'success');
    }
  });

  // ==========================================
  // 9. UNIFIED MERCHANT LOGIN & ACCOUNT SETUP WORKFLOW
  // ==========================================
  function openLoginModal() {
    loginNameInput.value = state.merchant.businessName || '';
    loginPhoneInput.value = state.merchant.businessPhone || activePhone || '';
    loginPinInput.value = state.merchant.pin || '';
    if (loginUpiInput) loginUpiInput.value = state.merchant.upiId || '';
    loginAccountModal.classList.add('active');
  }

  if (openLoginModalBtn) openLoginModalBtn.addEventListener('click', openLoginModal);
  if (headerUserBadge) headerUserBadge.addEventListener('click', openLoginModal);

  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', () => loginAccountModal.classList.remove('active'));
  if (cancelLoginModalBtn) cancelLoginModalBtn.addEventListener('click', () => loginAccountModal.classList.remove('active'));

  if (loginAccountForm) {
    loginAccountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = loginNameInput.value.trim();
      const phone = loginPhoneInput.value.trim();
      const pin = loginPinInput.value.trim();
      const upi = loginUpiInput ? loginUpiInput.value.trim() : '';

      if (!name) {
        alert('Please enter a valid Merchant/Business Display Name.');
        return;
      }
      if (phone.length < 10) {
        alert('Please enter a valid 10-digit mobile phone number.');
        return;
      }
      if (pin.length !== 4) {
        alert('Please enter a 4-digit security PIN.');
        return;
      }
      if (!upi) {
        alert('Please enter your primary Merchant UPI ID.');
        return;
      }

      loadAccountData(phone);
      state.merchant.businessName = name;
      state.merchant.businessPhone = phone;
      state.merchant.pin = pin;
      state.merchant.upiId = upi;
      saveMerchantDB();

      updateMerchantHeaderDisplay();
      updateTemplateEditorAndPreview();
      updateMetrics();
      renderLedgerTable();
      populateEntryClientDropdown();
      renderTransactionHistory();

      loginAccountModal.classList.remove('active');
      showToast(`Saved & logged in as ${state.merchant.businessName}!`, 'success');
    });
  }

  // ==========================================
  // 11. SETTLE PAYMENT & ADD CLIENT WORKFLOWS
  // ==========================================
  function openSettleModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    settleClientId.value = client.id;
    settleClientName.textContent = client.name;
    settleCurrentDue.textContent = formatCurrency(client.amountDue);
    settleAmountInput.value = client.amountDue > 0 ? client.amountDue : '';
    settleModal.classList.add('active');
  }

  closeAddModalBtn.addEventListener('click', () => addClientModal.classList.remove('active'));
  cancelAddModalBtn.addEventListener('click', () => addClientModal.classList.remove('active'));
  closeSettleModalBtn.addEventListener('click', () => settleModal.classList.remove('active'));
  cancelSettleModalBtn.addEventListener('click', () => settleModal.classList.remove('active'));
  closeWaModalBtn.addEventListener('click', () => waModal.classList.remove('active'));
  cancelWaModalBtn.addEventListener('click', () => waModal.classList.remove('active'));
  openAddClientModalBtn.addEventListener('click', () => addClientModal.classList.add('active'));

  // ADD NEW CLIENT FORM SUBMIT -> SAVES PERSISTENTLY
  addClientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-client-name').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const category = document.getElementById('new-client-category').value;
    const amount = parseFloat(document.getElementById('new-client-amount').value) || 0;
    const frequency = document.getElementById('new-client-frequency').value;

    const newClient = {
      id: `client-${Date.now()}`,
      name,
      phone,
      category,
      amountDue: amount,
      billingFrequency: frequency,
      lastReminder: 'Just created',
      autoSend: true,
      daysOverdue: 0
    };

    state.clients.unshift(newClient);

    if (amount > 0) {
      state.transactions.push({
        id: `tx-${Date.now()}`,
        clientName: name,
        type: 'debit',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        notes: `Initial ${category} Udhar Record`
      });
      saveTransactionsDB(); // PERSIST TRANSACTIONS
    }

    saveClientsDB(); // PERSIST CLIENTS TO DATABASE

    addClientModal.classList.remove('active');
    addClientForm.reset();

    updateMetrics();
    renderLedgerTable();
    populateEntryClientDropdown();
    renderTransactionHistory();

    showToast(`New client ${name} saved under ${state.merchant.businessName}!`, 'success');
  });

  // SETTLE PAYMENT FORM SUBMIT -> SAVES PERSISTENTLY
  settleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clientId = settleClientId.value;
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const settleAmt = parseFloat(settleAmountInput.value) || 0;
    const method = document.getElementById('settle-method').value;

    client.amountDue = Math.max(0, client.amountDue - settleAmt);
    client.lastReminder = 'Paid (' + method + ')';

    state.transactions.push({
      id: `tx-${Date.now()}`,
      clientName: client.name,
      type: 'credit',
      amount: settleAmt,
      date: new Date().toISOString().split('T')[0],
      notes: `Settled via ${method}`
    });

    saveClientsDB(); // PERSIST CLIENTS
    saveTransactionsDB(); // PERSIST TRANSACTIONS

    settleModal.classList.remove('active');

    updateMetrics();
    renderLedgerTable();
    populateEntryClientDropdown();
    renderTransactionHistory();

    showToast(`Collected ₹${settleAmt} from ${client.name}! Saved to database.`, 'success');
  });

  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategoryFilter = chip.getAttribute('data-category');
      renderLedgerTable();
    });
  });

  statusSelectFilter.addEventListener('change', (e) => {
    state.activeStatusFilter = e.target.value;
    renderLedgerTable();
  });

  globalSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderLedgerTable();
  });

  btnTypeDebit.addEventListener('click', () => {
    btnTypeDebit.classList.add('active');
    btnTypeCredit.classList.remove('active');
    currentEntryType = 'debit';
  });

  btnTypeCredit.addEventListener('click', () => {
    btnTypeCredit.classList.add('active');
    btnTypeDebit.classList.remove('active');
    currentEntryType = 'credit';
  });

  // QUICK ENTRY FORM SUBMIT -> SAVES PERSISTENTLY
  quickEntryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clientId = entryClientSelect.value;
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const amt = parseFloat(entryAmountInput.value) || 0;
    const dateVal = entryDateInput.value;
    const notesVal = entryNotesInput.value;

    if (currentEntryType === 'debit') {
      client.amountDue += amt;
    } else {
      client.amountDue = Math.max(0, client.amountDue - amt);
    }

    state.transactions.push({
      id: `tx-${Date.now()}`,
      clientName: client.name,
      type: currentEntryType,
      amount: amt,
      date: dateVal,
      notes: notesVal || (currentEntryType === 'debit' ? 'Udhar Entry' : 'Payment Received')
    });

    saveClientsDB(); // PERSIST CLIENTS
    saveTransactionsDB(); // PERSIST TRANSACTIONS

    entryAmountInput.value = '';
    entryNotesInput.value = '';

    updateMetrics();
    renderLedgerTable();
    populateEntryClientDropdown();
    renderTransactionHistory();

    const typeMsg = currentEntryType === 'debit' ? `Added ₹${amt} Udhar to` : `Recorded ₹${amt} Payment from`;
    showToast(`${typeMsg} ${client.name}. Saved to database!`, 'success');
  });

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    showToast(`Switched to ${newTheme.toUpperCase()} theme`, 'info');
  });

  // System Push Notification Buttons & Banner Event Listeners
  const enablePushNotificationsBtn = document.getElementById('enable-push-notifications-btn');
  const dueReminderAlertBanner = document.getElementById('due-reminder-alert-banner');
  const dueBannerBadge = document.getElementById('due-banner-badge');
  const dueBannerText = document.getElementById('due-banner-text');
  const triggerDeviceNotificationBtn = document.getElementById('trigger-device-notification-btn');
  const dismissDueBannerBtn = document.getElementById('dismiss-due-banner-btn');

  if (enablePushNotificationsBtn) {
    enablePushNotificationsBtn.addEventListener('click', triggerAllDueNotifications);
  }
  if (triggerDeviceNotificationBtn) {
    triggerDeviceNotificationBtn.addEventListener('click', triggerAllDueNotifications);
  }
  if (dismissDueBannerBtn) {
    dismissDueBannerBtn.addEventListener('click', () => {
      if (dueReminderAlertBanner) dueReminderAlertBanner.style.display = 'none';
      showToast('Due Alert Banner dismissed.', 'info');
    });
  }

  // Onboarding Setup Popup Modal Elements
  const onboardingModal = document.getElementById('onboarding-modal');
  const onboardingForm = document.getElementById('onboarding-form');
  const onboardNameInput = document.getElementById('onboard-name');
  const onboardPhoneInput = document.getElementById('onboard-phone');
  const onboardPinInput = document.getElementById('onboard-pin');
  const onboardUpiInput = document.getElementById('onboard-upi');
  const onboardCategorySelect = document.getElementById('onboard-category');

  function checkFirstLaunchOnboarding() {
    if (!activePhone || !state.merchant.businessName) {
      if (onboardingModal) onboardingModal.classList.add('active');
    } else {
      if (onboardingModal) onboardingModal.classList.remove('active');
    }
  }

  if (onboardingForm) {
    onboardingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = onboardNameInput.value.trim();
      const phone = onboardPhoneInput.value.trim();
      const pin = onboardPinInput.value.trim();
      const upi = onboardUpiInput.value.trim();

      if (!name || phone.length < 10 || pin.length !== 4 || !upi) {
        alert('Please fill out all setup fields properly (Phone must be 10 digits & PIN must be 4 digits).');
        return;
      }

      loadAccountData(phone);
      state.merchant.businessName = name;
      state.merchant.businessPhone = phone;
      state.merchant.pin = pin;
      state.merchant.upiId = upi;
      state.merchant.category = onboardCategorySelect.value;
      saveMerchantDB();

      updateMerchantHeaderDisplay();
      updateTemplateEditorAndPreview();
      updateMetrics();
      renderLedgerTable();
      populateEntryClientDropdown();
      renderTransactionHistory();

      if (onboardingModal) onboardingModal.classList.remove('active');
      showToast(`Welcome ${name}! Your fresh ledger is ready. Add your first client!`, 'success');

      // Ask for push notification permission on setup
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    });
  }

  // Boot Setup
  checkFirstLaunchOnboarding();
  updateMerchantHeaderDisplay();
  templateEditor.value = state.templates.monthly_bill;
  updateTemplateEditorAndPreview();
  updateMetrics();
  renderLedgerTable();
  populateEntryClientDropdown();
  renderTransactionHistory();
  checkAndShowDueAlertBanner();
  syncServiceWorkerAutoNotifications();
});
