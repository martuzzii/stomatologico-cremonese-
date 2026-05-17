/**
 * Stomatologico Cremonese / Poliambulatorio Cremona
 * GDPR Cookie Consent Module — cookie-consent.js
 * Version: 1.0.0
 *
 * Responsibilities:
 *  - Show banner on first visit
 *  - Three categories: Necessary, Analytics, Marketing
 *  - Accept all / Accept necessary / Customize options
 *  - Store consent in localStorage with timestamp
 *  - Expose window.CookieConsent API
 *  - Block analytics/marketing scripts until consent given
 *  - Render its own banner + settings modal into DOM
 */

(function (window, document) {
  'use strict';

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const STORAGE_KEY      = 'sc_cookie_consent';
  const CONSENT_VERSION  = '1.0';   // Bump this to invalidate stored consents on policy changes
  const BANNER_ID        = 'cookie-consent-banner';
  const MODAL_ID         = 'cookie-consent-modal';

  /* Category definitions */
  const CATEGORIES = {
    necessary: {
      id:          'necessary',
      label:       'Cookie Necessari',
      description: 'Questi cookie sono essenziali per il funzionamento del sito web. Non possono essere disattivati.',
      required:    true,
      default:     true
    },
    analytics: {
      id:          'analytics',
      label:       'Cookie Analitici',
      description: 'Ci aiutano a capire come i visitatori interagiscono con il sito raccogliendo informazioni anonime (es. Google Analytics). Nessun dato personale viene trasmesso.',
      required:    false,
      default:     false
    },
    marketing: {
      id:          'marketing',
      label:       'Cookie di Marketing',
      description: 'Utilizzati per mostrare annunci pertinenti e misurare l\'efficacia delle campagne pubblicitarie. Possono tracciare l\'attività su altri siti web.',
      required:    false,
      default:     false
    }
  };

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    initialized:  false,
    consentGiven: false,
    consent:      null,        // { necessary, analytics, marketing, timestamp, version }
    bannerEl:     null,
    modalEl:      null,
    callbacks:    {            // fired when category consent changes
      analytics: [],
      marketing: []
    }
  };

  /* ============================================================
     UTILITY FUNCTIONS
     ============================================================ */
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Invalidate if version changed
      if (data.version !== CONSENT_VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(consentObj) {
    try {
      const data = {
        ...consentObj,
        version:   CONSENT_VERSION,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      state.consent      = data;
      state.consentGiven = true;
      return data;
    } catch (e) {
      console.warn('[CookieConsent] Could not save consent:', e);
      return consentObj;
    }
  }

  function clearConsent() {
    localStorage.removeItem(STORAGE_KEY);
    state.consent      = null;
    state.consentGiven = false;
  }

  /* ============================================================
     SCRIPT LOADING
     Loads blocked scripts when consent is granted.
     ============================================================ */

  /**
   * Unblock and execute deferred scripts matching a category.
   * Scripts should be written as:
   *   <script type="text/plain" data-cookie-category="analytics" data-src="..."></script>
   * OR inline:
   *   <script type="text/plain" data-cookie-category="analytics">... code ...</script>
   *
   * @param {string} category
   */
  function enableScripts(category) {
    const deferredScripts = document.querySelectorAll(
      `script[type="text/plain"][data-cookie-category="${category}"]`
    );

    deferredScripts.forEach(script => {
      const newScript = document.createElement('script');

      // Copy attributes
      Array.from(script.attributes).forEach(attr => {
        if (attr.name !== 'type' && attr.name !== 'data-cookie-category') {
          newScript.setAttribute(attr.name, attr.value);
        }
      });

      // External src
      const src = script.getAttribute('data-src');
      if (src) {
        newScript.src = src;
        newScript.async = true;
      }

      // Inline content
      if (script.textContent.trim()) {
        newScript.textContent = script.textContent;
      }

      document.head.appendChild(newScript);
    });

    console.log(`[CookieConsent] Scripts enabled for category: ${category}`);
  }

  /**
   * Fire registered callbacks for a category.
   * @param {string} category
   * @param {boolean} granted
   */
  function fireCallbacks(category, granted) {
    const cbs = state.callbacks[category] || [];
    cbs.forEach(cb => {
      try { cb(granted); } catch (e) { /* ignore */ }
    });
  }

  /**
   * Apply consent — enable/disable scripts & fire callbacks.
   * @param {Object} consentObj
   */
  function applyConsent(consentObj) {
    Object.keys(CATEGORIES).forEach(cat => {
      if (cat === 'necessary') return; // always enabled
      const granted = !!consentObj[cat];
      if (granted) {
        enableScripts(cat);
      }
      fireCallbacks(cat, granted);
    });
  }

  /* ============================================================
     BANNER RENDERING
     ============================================================ */
  function buildBannerHTML() {
    return `
      <div id="${BANNER_ID}"
           class="cookie-banner"
           role="dialog"
           aria-modal="true"
           aria-label="Consenso ai cookie"
           aria-describedby="cookie-banner-description">
        <div class="cookie-banner__inner">
          <div class="cookie-banner__text">
            <p class="cookie-banner__title">🍪 Utilizziamo i cookie</p>
            <p id="cookie-banner-description">
              Utilizziamo cookie propri e di terze parti per migliorare la tua esperienza,
              analizzare il traffico e personalizzare i contenuti.
              Leggi la nostra
              <a href="/cookie-policy/" target="_blank" rel="noopener noreferrer">Cookie Policy</a>
              e la
              <a href="/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </p>
          </div>
          <div class="cookie-banner__actions">
            <button class="btn btn-sm btn-ghost"
                    id="cookie-customize-btn"
                    aria-haspopup="dialog">
              Personalizza
            </button>
            <button class="btn btn-sm btn-white"
                    id="cookie-necessary-btn">
              Solo necessari
            </button>
            <button class="btn btn-sm btn-primary btn-pulse"
                    id="cookie-accept-all-btn">
              Accetta tutti
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function buildModalHTML() {
    const categoriesHtml = Object.values(CATEGORIES).map(cat => `
      <div class="cookie-category">
        <div class="cookie-category__header">
          <span class="cookie-category__name">${sanitize(cat.label)}</span>
          <label class="toggle" aria-label="${sanitize(cat.label)}">
            <input type="checkbox"
                   id="cookie-toggle-${cat.id}"
                   name="${cat.id}"
                   ${cat.required ? 'checked disabled' : ''}
                   ${cat.default && !cat.required ? 'checked' : ''}
                   aria-describedby="cookie-desc-${cat.id}">
            <span class="toggle__track"></span>
          </label>
        </div>
        <p class="cookie-category__description" id="cookie-desc-${cat.id}">
          ${sanitize(cat.description)}
        </p>
      </div>
    `).join('');

    return `
      <div id="${MODAL_ID}"
           class="cookie-modal"
           role="dialog"
           aria-modal="true"
           aria-label="Impostazioni cookie"
           aria-describedby="cookie-modal-desc">
        <div class="cookie-modal__box">
          <h2 class="cookie-modal__title">Impostazioni Cookie</h2>
          <p class="cookie-modal__description" id="cookie-modal-desc">
            Personalizza le tue preferenze sui cookie. I cookie necessari non possono essere disattivati
            in quanto sono indispensabili per il corretto funzionamento del sito.
          </p>

          <div id="cookie-categories">
            ${categoriesHtml}
          </div>

          <div class="cookie-modal__footer">
            <button class="btn btn-sm btn-secondary" id="cookie-modal-necessary-btn">
              Solo necessari
            </button>
            <button class="btn btn-sm btn-primary" id="cookie-modal-save-btn">
              Salva preferenze
            </button>
            <button class="btn btn-sm btn-primary" id="cookie-modal-accept-all-btn">
              Accetta tutti
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     SHOW / HIDE BANNER
     ============================================================ */
  function showBanner() {
    if (!state.bannerEl) return;
    // Delay slightly for browser to register the element before animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.bannerEl.classList.add('is-visible');
        state.bannerEl.removeAttribute('aria-hidden');
      });
    });
  }

  function hideBanner() {
    if (!state.bannerEl) return;
    state.bannerEl.classList.remove('is-visible');
    state.bannerEl.setAttribute('aria-hidden', 'true');
  }

  /* ============================================================
     OPEN / CLOSE MODAL
     ============================================================ */
  function openModal() {
    if (!state.modalEl) return;

    // Sync toggle states with current consent
    const currentConsent = state.consent || {};
    Object.keys(CATEGORIES).forEach(cat => {
      if (cat === 'necessary') return;
      const toggle = document.getElementById(`cookie-toggle-${cat}`);
      if (toggle) {
        toggle.checked = !!currentConsent[cat];
      }
    });

    state.modalEl.classList.add('is-open');
    state.modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first interactive element
    const firstBtn = state.modalEl.querySelector('button, [tabindex="0"]');
    if (firstBtn) setTimeout(() => firstBtn.focus(), 50);
  }

  function closeModal() {
    if (!state.modalEl) return;
    state.modalEl.classList.remove('is-open');
    state.modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ============================================================
     CONSENT ACTIONS
     ============================================================ */
  function acceptAll() {
    const consentObj = {
      necessary: true,
      analytics: true,
      marketing: true
    };
    const saved = saveConsent(consentObj);
    applyConsent(saved);
    hideBanner();
    closeModal();
    console.log('[CookieConsent] All cookies accepted.');
  }

  function acceptNecessary() {
    const consentObj = {
      necessary: true,
      analytics: false,
      marketing: false
    };
    const saved = saveConsent(consentObj);
    applyConsent(saved);
    hideBanner();
    closeModal();
    console.log('[CookieConsent] Only necessary cookies accepted.');
  }

  function saveCustomPreferences() {
    const consentObj = { necessary: true };

    Object.keys(CATEGORIES).forEach(cat => {
      if (cat === 'necessary') return;
      const toggle = document.getElementById(`cookie-toggle-${cat}`);
      consentObj[cat] = toggle ? toggle.checked : false;
    });

    const saved = saveConsent(consentObj);
    applyConsent(saved);
    hideBanner();
    closeModal();
    console.log('[CookieConsent] Custom preferences saved:', {
      analytics: consentObj.analytics,
      marketing: consentObj.marketing
    });
  }

  /* ============================================================
     BIND EVENTS
     ============================================================ */
  function bindBannerEvents() {
    if (!state.bannerEl) return;

    const acceptAllBtn = document.getElementById('cookie-accept-all-btn');
    const necessaryBtn = document.getElementById('cookie-necessary-btn');
    const customizeBtn = document.getElementById('cookie-customize-btn');

    if (acceptAllBtn) acceptAllBtn.addEventListener('click', acceptAll);
    if (necessaryBtn) necessaryBtn.addEventListener('click', acceptNecessary);
    if (customizeBtn) customizeBtn.addEventListener('click', openModal);
  }

  function bindModalEvents() {
    if (!state.modalEl) return;

    const acceptAllBtn = document.getElementById('cookie-modal-accept-all-btn');
    const necessaryBtn = document.getElementById('cookie-modal-necessary-btn');
    const saveBtn      = document.getElementById('cookie-modal-save-btn');

    if (acceptAllBtn) acceptAllBtn.addEventListener('click', acceptAll);
    if (necessaryBtn) necessaryBtn.addEventListener('click', acceptNecessary);
    if (saveBtn)      saveBtn.addEventListener('click', saveCustomPreferences);

    // Close on backdrop click
    state.modalEl.addEventListener('click', function (e) {
      if (e.target === state.modalEl) closeModal();
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.modalEl.classList.contains('is-open')) {
        closeModal();
      }
    });

    // Trap focus within modal
    state.modalEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        state.modalEl.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ============================================================
     INJECTION — Insert banner & modal into DOM
     ============================================================ */
  function injectUI() {
    // Avoid duplicate injection
    if (document.getElementById(BANNER_ID)) {
      state.bannerEl = document.getElementById(BANNER_ID);
      state.modalEl  = document.getElementById(MODAL_ID);
      bindBannerEvents();
      bindModalEvents();
      return;
    }

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.id = 'cookie-consent-root';
    wrapper.innerHTML = buildBannerHTML() + buildModalHTML();

    document.body.appendChild(wrapper);

    state.bannerEl = document.getElementById(BANNER_ID);
    state.modalEl  = document.getElementById(MODAL_ID);

    // Initial aria-hidden state
    if (state.bannerEl) state.bannerEl.setAttribute('aria-hidden', 'true');
    if (state.modalEl)  state.modalEl.setAttribute('aria-hidden', 'true');

    bindBannerEvents();
    bindModalEvents();
  }

  /* ============================================================
     MAIN INIT
     ============================================================ */
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Inject UI elements
    injectUI();

    // Check for stored consent
    const stored = loadConsent();

    if (stored) {
      // Consent already given — apply without showing banner
      state.consent      = stored;
      state.consentGiven = true;
      applyConsent(stored);
      console.log('[CookieConsent] Restored consent from storage:', {
        analytics: stored.analytics,
        marketing: stored.marketing,
        timestamp: stored.timestamp
      });
    } else {
      // No consent yet — show banner
      showBanner();
    }
  }

  /* ============================================================
     PUBLIC API — window.CookieConsent
     ============================================================ */
  const CookieConsent = {
    /**
     * Accept all cookie categories.
     */
    acceptAll,

    /**
     * Accept only necessary cookies.
     */
    acceptNecessary,

    /**
     * Open the cookie settings modal.
     */
    openSettings: openModal,

    /**
     * Close the cookie settings modal.
     */
    closeSettings: closeModal,

    /**
     * Check if a specific category has been consented to.
     * @param {string} category - 'necessary' | 'analytics' | 'marketing'
     * @returns {boolean}
     */
    hasConsent: function (category) {
      if (category === 'necessary') return true;
      if (!state.consent) return false;
      return !!state.consent[category];
    },

    /**
     * Get the full consent object.
     * @returns {Object|null}
     */
    getConsent: function () {
      return state.consent ? { ...state.consent } : null;
    },

    /**
     * Register a callback fired when a category consent changes.
     * @param {string} category - 'analytics' | 'marketing'
     * @param {Function} callback - receives (granted: boolean)
     */
    onConsentChange: function (category, callback) {
      if (!state.callbacks[category]) state.callbacks[category] = [];
      state.callbacks[category].push(callback);
    },

    /**
     * Programmatically show the consent banner.
     */
    showBanner,

    /**
     * Revoke consent and clear stored data. Shows banner again.
     */
    revokeConsent: function () {
      clearConsent();
      showBanner();
      console.log('[CookieConsent] Consent revoked.');
    },

    /**
     * Check if consent has been given (any category decision made).
     * @returns {boolean}
     */
    isConsentGiven: function () {
      return state.consentGiven;
    },

    /**
     * Get the consent timestamp.
     * @returns {string|null} ISO timestamp string or null.
     */
    getTimestamp: function () {
      return state.consent ? state.consent.timestamp : null;
    },

    /**
     * Get the consent version.
     * @returns {string}
     */
    getVersion: function () {
      return CONSENT_VERSION;
    },

    /**
     * Re-initialise (useful after dynamic page loads / SPA navigation).
     */
    reinit: init
  };

  /* ============================================================
     WIRE TO EXISTING BANNER IN HTML (if present)
     In case the HTML already contains the banner markup with
     data-cookie-* attributes, wire those buttons too.
     ============================================================ */
  function wireExistingBanner() {
    document.querySelectorAll('[data-cookie-accept-all]').forEach(btn => {
      btn.addEventListener('click', acceptAll);
    });
    document.querySelectorAll('[data-cookie-accept-necessary]').forEach(btn => {
      btn.addEventListener('click', acceptNecessary);
    });
    document.querySelectorAll('[data-cookie-customize]').forEach(btn => {
      btn.addEventListener('click', openModal);
    });
    document.querySelectorAll('[data-cookie-revoke]').forEach(btn => {
      btn.addEventListener('click', CookieConsent.revokeConsent.bind(CookieConsent));
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    wireExistingBanner();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ============================================================
     EXPOSE PUBLIC API
     ============================================================ */
  window.CookieConsent = CookieConsent;

})(window, document);
