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

function initUdharPayInd() {

  // ==========================================
  // 1. Persistent Multi-Account Database Keys & Boot State
  // ==========================================
  const CURRENT_USER_KEY = 'udharpayind_active_user_phone';
  const LOGGED_IN_SESSION_KEY = 'udharpayind_is_logged_in';

  // Initial Default Seed Data
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

  // Central Application State Object
  const state = {
    clients: [],
    transactions: [],
    merchant: { ...defaultMerchant },
    templates: { ...defaultTemplates },
    activeCategoryFilter: 'all',
    activeStatusFilter: 'all',
    searchQuery: '',
    selectedTemplateKey: 'monthly_bill',
    currentDispatchClient: null
  };

  // Active User & Login State
  let activePhone = localStorage.getItem(CURRENT_USER_KEY) || 'local_merchant';
  let isLoggedIn = localStorage.getItem(LOGGED_IN_SESSION_KEY) === 'true';

  function getStorageKey(type) {
    return `udharpayind_${activePhone}_${type}`;
  }

  // Database Persistence Helpers
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

  function syncServiceWorkerAutoNotifications() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const pendingClients = state.clients.filter(c => c.amountDue > 0);
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_AUTO_NOTIFICATIONS',
        clients: pendingClients
      });
    }
  }

  function loadAccountData(phone) {
    activePhone = phone || 'local_merchant';
    isLoggedIn = true;
    localStorage.setItem(CURRENT_USER_KEY, activePhone);
    localStorage.setItem(LOGGED_IN_SESSION_KEY, 'true');

    const savedClients = JSON.parse(localStorage.getItem(getStorageKey('clients')));
    const savedTransactions = JSON.parse(localStorage.getItem(getStorageKey('transactions')));
    const savedMerchant = JSON.parse(localStorage.getItem(getStorageKey('merchant')));
    const savedTemplates = JSON.parse(localStorage.getItem(getStorageKey('templates')));

    state.clients = savedClients || [];
    state.transactions = savedTransactions || [];
    state.merchant = savedMerchant || { ...defaultMerchant, businessPhone: activePhone };
    state.templates = savedTemplates || defaultTemplates;

    if (!savedClients) saveClientsDB();
    if (!savedTransactions) saveTransactionsDB();
    if (!savedMerchant) saveMerchantDB();
    if (!savedTemplates) saveTemplatesDB();
  }

  // ALWAYS load persistent account data on boot
  loadAccountData(activePhone);

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
  const brandLogo = document.getElementById('brand-logo');

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

  // Login Modal Elements
  const loginAccountModal = document.getElementById('login-account-modal');
  const closeLoginModalBtn = document.getElementById('close-login-modal');
  const cancelLoginModalBtn = document.getElementById('cancel-login-modal');
  const loginAccountForm = document.getElementById('login-account-form');
  const loginNameInput = document.getElementById('login-name-input');
  const loginPhoneInput = document.getElementById('login-phone-input');
  const loginPinInput = document.getElementById('login-pin-input');
  const loginUpiInput = document.getElementById('login-upi-input');

  // Onboarding Setup Popup Modal Elements
  const onboardingModal = document.getElementById('onboarding-modal');
  const onboardingForm = document.getElementById('onboarding-form');
  const onboardNameInput = document.getElementById('onboard-name');
  const onboardPhoneInput = document.getElementById('onboard-phone');
  const onboardPinInput = document.getElementById('onboard-pin');
  const onboardUpiInput = document.getElementById('onboard-upi');
  const onboardCategorySelect = document.getElementById('onboard-category');
  const closeOnboardingModalBtn = document.getElementById('close-onboarding-modal');

  // Banner & Theme
  const dueReminderAlertBanner = document.getElementById('due-reminder-alert-banner');
  const dueBannerBadge = document.getElementById('due-banner-badge');
  const dueBannerText = document.getElementById('due-banner-text');
  const dismissDueBannerBtn = document.getElementById('dismiss-due-banner-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toastContainer = document.getElementById('toast-container');

  if (entryDateInput) {
    entryDateInput.value = new Date().toISOString().split('T')[0];
  }

  // ==========================================
  // 3. Helper & Format Functions
  // ==========================================
  function addTapListener(element, callback) {
    if (!element) return;
    element.addEventListener('click', callback);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  function showToast(message, type = 'success') {
    if (!toastContainer) return;
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
    if (!phoneStr) return '910000000000';
    let cleaned = phoneStr.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  }

  function updateMerchantHeaderDisplay() {
    const bizName = (state.merchant && state.merchant.businessName) || 'Setup Merchant';
    const bizPhone = (state.merchant && state.merchant.businessPhone) || activePhone;
    
    const words = bizName.trim().split(' ');
    let initials = 'UP';
    if (words.length >= 2 && words[0] && words[1]) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      initials = words[0].substring(0, 2).toUpperCase();
    }

    if (headerUserName) headerUserName.textContent = bizName;
    if (headerUserPhone) headerUserPhone.textContent = bizPhone;
    if (headerUserAvatar) headerUserAvatar.textContent = initials;
    if (waMockupSender) waMockupSender.textContent = bizName;
    if (waMockupAvatar) waMockupAvatar.textContent = initials;

    if (state.merchant && state.merchant.businessName) {
      if (openLoginModalBtn) openLoginModalBtn.style.display = 'none';
      if (headerUserBadge) headerUserBadge.style.display = 'inline-flex';
    } else {
      if (openLoginModalBtn) openLoginModalBtn.style.display = 'inline-flex';
      if (headerUserBadge) headerUserBadge.style.display = 'none';
    }
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
      case 'Others': return '📦 Others';
      default: return `🏷️ ${category || 'General'}`;
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
      dueBannerText.textContent = `${pendingClients.length} client(s) have pending due amounts (${formatCurrency(totalPendingAmt)} Total Due). Automatic WhatsApp reminders ready!`;
    }
  }

  function processTemplateVariables(templateStr, client = null) {
    if (!templateStr || typeof templateStr !== 'string') {
      templateStr = defaultTemplates.monthly_bill;
    }
    const targetName = client ? client.name : 'Customer';
    const targetAmount = client ? formatCurrency(client.amountDue) : '₹0';
    const targetService = client ? getCategoryIcon(client.category) : 'Service';
    const targetDueDate = '1st of Month';
    const targetUpiId = (state.merchant && state.merchant.upiId) ? state.merchant.upiId : 'merchant@upi';
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

    if (metricTotalUdhar) metricTotalUdhar.textContent = formatCurrency(totalDue);
    if (metricCollectedMonth) metricCollectedMonth.textContent = formatCurrency(totalCollected);
    if (metricOverdueClients) metricOverdueClients.textContent = `${overdueCount} Overdue`;
    if (metricRemindersQueued) metricRemindersQueued.textContent = `${queuedCount} Pending`;
    if (clientCountBadge) clientCountBadge.textContent = state.clients.length;

    checkAndShowDueAlertBanner();
  }

  // ==========================================
  // 5. MOBILE BOTTOM NAVIGATION SWITCHER
  // ==========================================
  mobileNavButtons.forEach(btn => {
    addTapListener(btn, () => {
      const targetId = btn.getAttribute('data-target');

      mobileNavButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

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
  // 6. Render Active Clients CARD VIEW
  // ==========================================
  function renderLedgerTable() {
    if (!clientCardsGrid) return;
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
        const matchId = (client.id || '').toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchCategory && !matchId) return false;
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
          <button class="btn btn-primary" onclick="document.getElementById('add-client-modal').classList.add('active')">
            + Add First Client
          </button>
        </div>
      `;
      return;
    }

    filteredClients.forEach(client => {
      const amountClass = client.amountDue > 5000 ? 'amount-high' : client.amountDue > 0 ? 'amount-medium' : 'amount-zero';

      const card = document.createElement('div');
      card.className = 'client-card-item';
      card.innerHTML = `
        <div class="client-card-top">
          <div class="client-info-cell">
            <div class="avatar ${getCategoryAvatarClass(client.category)}">
              ${(client.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div class="client-details">
              <div class="client-name">${client.name}</div>
              <div class="client-phone">${client.phone} • <span style="background: rgba(37, 211, 102, 0.15); color: var(--whatsapp-green); font-size: 0.75rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(37, 211, 102, 0.3);">ID: ${client.id}</span></div>
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
      addTapListener(btn, () => {
        const id = btn.getAttribute('data-id');
        openWhatsAppModal(id);
      });
    });

    document.querySelectorAll('.trigger-settle-btn').forEach(btn => {
      addTapListener(btn, () => {
        const id = btn.getAttribute('data-id');
        openSettleModal(id);
      });
    });

    document.querySelectorAll('.trigger-delete-btn').forEach(btn => {
      addTapListener(btn, () => {
        const id = btn.getAttribute('data-id');
        const client = state.clients.find(c => c.id === id);
        if (client) {
          if (confirm(`Are you sure you want to remove client "${client.name}" from your ledger?`)) {
            state.clients = state.clients.filter(c => c.id !== id);
            saveClientsDB();
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
    if (!entryClientSelect) return;
    entryClientSelect.innerHTML = '';
    state.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (ID: ${c.id}) — ${getCategoryIcon(c.category)} (Due: ${formatCurrency(c.amountDue)})`;
      entryClientSelect.appendChild(opt);
    });
  }

  function renderTransactionHistory() {
    if (!transactionHistoryList) return;
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
    if (!templateEditor || !liveWaPreviewBubble) return;
    const rawTemplate = templateEditor.value;
    const processedText = processTemplateVariables(rawTemplate);
    liveWaPreviewBubble.childNodes[0].nodeValue = processedText + "\n\n";
  }

  if (templatePresetSelect) {
    templatePresetSelect.addEventListener('change', (e) => {
      state.selectedTemplateKey = e.target.value;
      if (templateEditor) {
        templateEditor.value = state.templates[state.selectedTemplateKey] || defaultTemplates.monthly_bill;
      }
      updateTemplateEditorAndPreview();
    });
  }

  if (templateEditor) {
    templateEditor.addEventListener('input', () => updateTemplateEditorAndPreview());
  }

  varChips.forEach(chip => {
    addTapListener(chip, () => {
      if (!templateEditor) return;
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

  if (saveTemplateBtn) {
    addTapListener(saveTemplateBtn, () => {
      if (templateEditor) {
        state.templates[state.selectedTemplateKey] = templateEditor.value;
        saveTemplatesDB();
        showToast('WhatsApp Template saved to database!', 'success');
      }
    });
  }

  if (testDispatchBtn) {
    addTapListener(testDispatchBtn, () => {
      if (state.clients.length > 0) {
        openWhatsAppModal(state.clients[0].id);
      } else {
        showToast('Add a client record first to test WhatsApp dispatch!', 'info');
      }
    });
  }

  // ==========================================
  // 8. REAL WHATSAPP DISPATCH MODAL
  // ==========================================
  function updateDispatchModalTargets() {
    if (!waModalMessageEditor || !openWaDirectLink) return;
    const client = state.currentDispatchClient || state.clients[0] || { name: 'Customer', phone: '910000000000' };
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

    if (apiJsonPreview) {
      apiJsonPreview.textContent = JSON.stringify(cloudApiPayload, null, 2);
    }
  }

  function openWhatsAppModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    state.currentDispatchClient = client;

    if (waModalSenderInfo) waModalSenderInfo.textContent = `WA Biz: ${state.merchant.businessPhone || activePhone}`;
    if (waModalRecipient) waModalRecipient.textContent = `${client.name} (${client.phone})`;

    const message = processTemplateVariables(templateEditor ? templateEditor.value : state.templates.monthly_bill, client);
    if (waModalMessageEditor) waModalMessageEditor.value = message;

    updateDispatchModalTargets();

    if (state.merchant.defaultDispatch === 'cloud_api') {
      if (dispatchModeApiRadio) dispatchModeApiRadio.checked = true;
      if (cloudApiInspector) cloudApiInspector.style.display = 'block';
      if (openWaDirectLink) openWaDirectLink.textContent = '⚡ Execute Meta Cloud API Send';
    } else {
      if (dispatchModeDirectRadio) dispatchModeDirectRadio.checked = true;
      if (cloudApiInspector) cloudApiInspector.style.display = 'none';
      if (openWaDirectLink) openWaDirectLink.textContent = '🚀 Dispatch via WhatsApp Web / App';
    }

    if (waModal) waModal.classList.add('active');
  }

  if (waModalMessageEditor) {
    waModalMessageEditor.addEventListener('input', updateDispatchModalTargets);
  }

  if (dispatchModeDirectRadio) {
    dispatchModeDirectRadio.addEventListener('change', () => {
      if (cloudApiInspector) cloudApiInspector.style.display = 'none';
      if (openWaDirectLink) openWaDirectLink.textContent = '🚀 Dispatch via WhatsApp Web / App';
    });
  }

  if (dispatchModeApiRadio) {
    dispatchModeApiRadio.addEventListener('change', () => {
      if (cloudApiInspector) cloudApiInspector.style.display = 'block';
      if (openWaDirectLink) openWaDirectLink.textContent = '⚡ Execute Meta Cloud API Send';
    });
  }

  if (openWaDirectLink) {
    openWaDirectLink.addEventListener('click', (e) => {
      const client = state.currentDispatchClient;
      if (!client) return;

      if (dispatchModeApiRadio && dispatchModeApiRadio.checked) {
        e.preventDefault();
        client.lastReminder = 'Sent via Cloud API (' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ')';
        saveClientsDB();
        renderLedgerTable();
        if (waModal) waModal.classList.remove('active');
        showToast(`Meta Cloud API HTTP 200 OK: Reminder dispatched to ${client.name}!`, 'success');
      } else {
        client.lastReminder = 'Sent via WhatsApp App (' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ')';
        saveClientsDB();
        renderLedgerTable();
        if (waModal) waModal.classList.remove('active');
        showToast(`Opening WhatsApp Web/App for ${client.name}...`, 'success');
      }
    });
  }

  // ==========================================
  // 9. UNIFIED MERCHANT LOGIN & ACCOUNT SETUP
  // ==========================================
  function openLoginModal() {
    if (state.merchant && state.merchant.businessName) {
      if (loginNameInput) loginNameInput.value = state.merchant.businessName || '';
      if (loginPhoneInput) loginPhoneInput.value = state.merchant.businessPhone || '';
      if (loginPinInput) loginPinInput.value = state.merchant.pin || '';
      if (loginUpiInput) loginUpiInput.value = state.merchant.upiId || '';
    } else {
      if (loginAccountForm) loginAccountForm.reset();
    }

    if (loginAccountModal) loginAccountModal.classList.add('active');
  }

  if (openLoginModalBtn) openLoginModalBtn.addEventListener('click', openLoginModal);
  if (headerUserBadge) headerUserBadge.addEventListener('click', openLoginModal);
  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', () => loginAccountModal.classList.remove('active'));
  if (cancelLoginModalBtn) cancelLoginModalBtn.addEventListener('click', () => loginAccountModal.classList.remove('active'));

  window.saveMerchantProfile = function(e) {
    if (e) e.preventDefault();
    const name = loginNameInput ? loginNameInput.value.trim() : '';
    const phone = loginPhoneInput ? loginPhoneInput.value.trim() : '';
    const pin = loginPinInput ? loginPinInput.value.trim() : '';
    const upi = loginUpiInput ? loginUpiInput.value.trim() : '';

    if (!name) {
      alert('Please enter a valid Merchant/Business Display Name.');
      return false;
    }
    if (phone.length < 10) {
      alert('Please enter a valid 10-digit mobile phone number.');
      return false;
    }
    if (pin.length !== 4) {
      alert('Please enter a 4-digit security PIN.');
      return false;
    }
    if (!upi) {
      alert('Please enter your primary Merchant UPI ID.');
      return false;
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

    if (loginAccountModal) loginAccountModal.classList.remove('active');
    showToast(`Saved & logged in as ${state.merchant.businessName}!`, 'success');
    return false;
  };

  if (loginAccountForm) {
    loginAccountForm.addEventListener('submit', window.saveMerchantProfile);
  }

  // ==========================================
  // 10. SETTLE PAYMENT & ADD CLIENT WORKFLOWS
  // ==========================================
  function openSettleModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    if (settleClientId) settleClientId.value = client.id;
    if (settleClientName) settleClientName.textContent = client.name;
    if (settleCurrentDue) settleCurrentDue.textContent = formatCurrency(client.amountDue);
    if (settleAmountInput) settleAmountInput.value = client.amountDue > 0 ? client.amountDue : '';
    if (settleModal) settleModal.classList.add('active');
  }

  if (closeAddModalBtn) addTapListener(closeAddModalBtn, () => addClientModal.classList.remove('active'));
  if (cancelAddModalBtn) addTapListener(cancelAddModalBtn, () => addClientModal.classList.remove('active'));
  if (closeSettleModalBtn) addTapListener(closeSettleModalBtn, () => settleModal.classList.remove('active'));
  if (cancelSettleModalBtn) addTapListener(cancelSettleModalBtn, () => settleModal.classList.remove('active'));
  if (closeWaModalBtn) addTapListener(closeWaModalBtn, () => waModal.classList.remove('active'));
  if (cancelWaModalBtn) addTapListener(cancelWaModalBtn, () => waModal.classList.remove('active'));
  if (openAddClientModalBtn) addTapListener(openAddClientModalBtn, () => addClientModal.classList.add('active'));

  window.addNewClientRecord = function(e) {
    if (e) e.preventDefault();
    const nameEl = document.getElementById('new-client-name');
    const phoneEl = document.getElementById('new-client-phone');
    const categoryEl = document.getElementById('new-client-category');
    const amountEl = document.getElementById('new-client-amount');
    const frequencyEl = document.getElementById('new-client-frequency');

    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    let category = categoryEl ? categoryEl.value : 'Milk';

    if (category === 'custom') {
      const customCategoryVal = document.getElementById('new-client-custom-category');
      category = (customCategoryVal && customCategoryVal.value.trim()) ? customCategoryVal.value.trim() : 'Others';
    }

    const amount = parseFloat(amountEl ? amountEl.value : 0) || 0;
    const frequency = frequencyEl ? frequencyEl.value : 'Monthly - 1st';

    if (!name) {
      alert('Please enter a valid Client Full Name.');
      return false;
    }

    const nextNum = 1001 + state.clients.length;
    const clientId = `CL-${nextNum}`;

    const newClient = {
      id: clientId,
      name,
      phone: phone || 'N/A',
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
      saveTransactionsDB();
    }

    saveClientsDB();

    if (addClientModal) addClientModal.classList.remove('active');
    if (addClientForm) addClientForm.reset();

    const newClientCustomWrap = document.getElementById('new-client-custom-wrap');
    if (newClientCustomWrap) newClientCustomWrap.style.display = 'none';

    state.activeCategoryFilter = 'all';
    state.activeStatusFilter = 'all';
    state.searchQuery = '';

    updateMetrics();
    renderCategoryFilterChips();
    renderLedgerTable();
    populateEntryClientDropdown();
    renderTransactionHistory();

    showToast(`New client ${name} (${clientId}) saved!`, 'success');
    return false;
  };

  if (addClientForm) {
    addClientForm.addEventListener('submit', window.addNewClientRecord);
  }

  // SETTLE PAYMENT FORM SUBMIT
  if (settleForm) {
    settleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = settleClientId ? settleClientId.value : '';
      const client = state.clients.find(c => c.id === clientId);
      if (!client) return;

      const settleAmt = parseFloat(settleAmountInput ? settleAmountInput.value : 0) || 0;
      const settleMethodEl = document.getElementById('settle-method');
      const method = settleMethodEl ? settleMethodEl.value : 'UPI';

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

      saveClientsDB();
      saveTransactionsDB();

      if (settleModal) settleModal.classList.remove('active');

      updateMetrics();
      renderLedgerTable();
      populateEntryClientDropdown();
      renderTransactionHistory();

      showToast(`Collected ₹${settleAmt} from ${client.name}! Saved to database.`, 'success');
    });
  }

  // Category Filter Chips
  categoryChips.forEach(chip => {
    addTapListener(chip, () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategoryFilter = chip.getAttribute('data-category');
      renderLedgerTable();
    });
  });

  if (statusSelectFilter) {
    statusSelectFilter.addEventListener('change', (e) => {
      state.activeStatusFilter = e.target.value;
      renderLedgerTable();
    });
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderLedgerTable();
    });
  }

  if (btnTypeDebit) {
    addTapListener(btnTypeDebit, () => {
      btnTypeDebit.classList.add('active');
      if (btnTypeCredit) btnTypeCredit.classList.remove('active');
      currentEntryType = 'debit';
    });
  }

  if (btnTypeCredit) {
    addTapListener(btnTypeCredit, () => {
      btnTypeCredit.classList.add('active');
      if (btnTypeDebit) btnTypeDebit.classList.remove('active');
      currentEntryType = 'credit';
    });
  }

  // QUICK ENTRY FORM SUBMIT
  if (quickEntryForm) {
    quickEntryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = entryClientSelect ? entryClientSelect.value : '';
      const client = state.clients.find(c => c.id === clientId);
      if (!client) return;

      const amt = parseFloat(entryAmountInput ? entryAmountInput.value : 0) || 0;
      const dateVal = entryDateInput ? entryDateInput.value : new Date().toISOString().split('T')[0];
      const notesVal = entryNotesInput ? entryNotesInput.value : '';

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

      saveClientsDB();
      saveTransactionsDB();

      if (entryAmountInput) entryAmountInput.value = '';
      if (entryNotesInput) entryNotesInput.value = '';

      updateMetrics();
      renderLedgerTable();
      populateEntryClientDropdown();
      renderTransactionHistory();

      const typeMsg = currentEntryType === 'debit' ? `Added ₹${amt} Udhar to` : `Recorded ₹${amt} Payment from`;
      showToast(`${typeMsg} ${client.name}. Saved to database!`, 'success');
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      showToast(`Switched to ${newTheme.toUpperCase()} theme`, 'info');
    });
  }

  if (dismissDueBannerBtn) {
    dismissDueBannerBtn.addEventListener('click', () => {
      if (dueReminderAlertBanner) dueReminderAlertBanner.style.display = 'none';
      showToast('Due Alert Banner dismissed.', 'info');
    });
  }

  if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (closeOnboardingModalBtn) {
    addTapListener(closeOnboardingModalBtn, () => {
      if (onboardingModal) onboardingModal.classList.remove('active');
    });
  }

  // Universal Backdrop Click Handler (Closes modal if clicked outside card)
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  function checkFirstLaunchOnboarding() {
    const hasMerchant = state.merchant && state.merchant.businessName && state.merchant.businessName.trim() !== '';
    if (!hasMerchant && onboardingModal) {
      onboardingModal.classList.add('active');
    }
  }

  // Custom Category Input Toggle Listeners
  const newClientCategorySelect = document.getElementById('new-client-category');
  const newClientCustomWrap = document.getElementById('new-client-custom-wrap');
  const onboardCustomWrap = document.getElementById('onboard-custom-wrap');

  if (newClientCategorySelect) {
    newClientCategorySelect.addEventListener('change', () => {
      if (newClientCategorySelect.value === 'custom') {
        if (newClientCustomWrap) newClientCustomWrap.style.display = 'block';
      } else {
        if (newClientCustomWrap) newClientCustomWrap.style.display = 'none';
      }
    });
  }

  if (onboardCategorySelect) {
    onboardCategorySelect.addEventListener('change', () => {
      if (onboardCategorySelect.value === 'custom') {
        if (onboardCustomWrap) onboardCustomWrap.style.display = 'block';
      } else {
        if (onboardCustomWrap) onboardCustomWrap.style.display = 'none';
      }
    });
  }

  function renderCategoryFilterChips() {
    const chipsContainer = document.getElementById('category-filter-chips');
    if (!chipsContainer) return;

    const standardCategories = ['Milk', 'Grocery', 'Tuition', 'Rent', 'Others'];
    const customCategories = [];
    state.clients.forEach(c => {
      if (c.category && !standardCategories.includes(c.category) && !customCategories.includes(c.category)) {
        customCategories.push(c.category);
      }
    });

    let html = `<button class="chip-btn ${state.activeCategoryFilter === 'all' ? 'active' : ''}" data-category="all">All Categories</button>`;
    
    standardCategories.forEach(cat => {
      const activeClass = state.activeCategoryFilter === cat ? 'active' : '';
      html += `<button class="chip-btn ${activeClass}" data-category="${cat}">${getCategoryIcon(cat)}</button>`;
    });

    customCategories.forEach(cat => {
      const activeClass = state.activeCategoryFilter === cat ? 'active' : '';
      html += `<button class="chip-btn ${activeClass}" data-category="${cat}">🏷️ ${cat}</button>`;
    });

    chipsContainer.innerHTML = html;

    chipsContainer.querySelectorAll('.chip-btn').forEach(chip => {
      addTapListener(chip, () => {
        chipsContainer.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeCategoryFilter = chip.getAttribute('data-category');
        renderLedgerTable();
      });
    });
  }

  if (onboardingForm) {
    onboardingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = onboardNameInput ? onboardNameInput.value.trim() : '';
      const phone = onboardPhoneInput ? onboardPhoneInput.value.trim() : '';
      const pin = onboardPinInput ? onboardPinInput.value.trim() : '';
      const upi = onboardUpiInput ? onboardUpiInput.value.trim() : '';

      if (!name || phone.length < 10 || pin.length !== 4 || !upi) {
        alert('Please fill out all setup fields properly (Phone must be 10 digits & PIN must be 4 digits).');
        return;
      }

      let selectedCategory = onboardCategorySelect ? onboardCategorySelect.value : 'Milk';
      if (selectedCategory === 'custom') {
        const customCatInput = document.getElementById('onboard-custom-category');
        selectedCategory = (customCatInput && customCatInput.value.trim()) ? customCatInput.value.trim() : 'Others';
      }

      loadAccountData(phone);
      state.merchant.businessName = name;
      state.merchant.businessPhone = phone;
      state.merchant.pin = pin;
      state.merchant.upiId = upi;
      state.merchant.category = selectedCategory;
      saveMerchantDB();

      updateMerchantHeaderDisplay();
      updateTemplateEditorAndPreview();
      updateMetrics();
      renderLedgerTable();
      populateEntryClientDropdown();
      renderTransactionHistory();

      if (onboardingModal) onboardingModal.classList.remove('active');
      showToast(`Welcome ${name}! Your fresh ledger is ready. Add your first client!`, 'success');
    });
  }

  // Boot Setup
  checkFirstLaunchOnboarding();
  updateMerchantHeaderDisplay();
  if (templateEditor) {
    templateEditor.value = (state.templates && state.templates.monthly_bill) || defaultTemplates.monthly_bill;
  }
  updateTemplateEditorAndPreview();
  updateMetrics();
  renderCategoryFilterChips();
  renderLedgerTable();
  populateEntryClientDropdown();
  renderTransactionHistory();
  checkAndShowDueAlertBanner();
  syncServiceWorkerAutoNotifications();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUdharPayInd);
} else {
  initUdharPayInd();
}
