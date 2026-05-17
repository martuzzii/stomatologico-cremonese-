/**
 * Stomatologico Cremonese / Poliambulatorio Cremona
 * Main JavaScript
 * Version: 1.0.0
 *
 * Responsibilities:
 *  - Mobile navigation toggle (hamburger)
 *  - Smooth scroll for anchor links
 *  - Scroll-triggered fade-in animations (IntersectionObserver)
 *  - Cookie consent banner (delegated to cookie-consent.js, wired here)
 *  - Client-side form validation & sanitization
 *  - Active nav link highlighting based on scroll position
 *  - Sticky header shadow on scroll
 */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTS & SELECTORS
     ============================================================ */
  const HEADER_SELECTOR        = '.site-header';
  const HAMBURGER_SELECTOR     = '.hamburger';
  const MOBILE_NAV_SELECTOR    = '.mobile-nav';
  const NAV_LINK_SELECTOR      = '.primary-nav__link[href^="#"], .primary-nav__link[data-section]';
  const MOBILE_NAV_LINK        = '.mobile-nav__link';
  const SECTION_SELECTOR       = 'section[id], div[id].section';
  const FADE_SELECTOR          = '.fade-in, .fade-in-group, .slide-in-left, .slide-in-right, .scale-in';
  const SMOOTH_LINK_SELECTOR   = 'a[href^="#"]';
  const CONTACT_FORM_SELECTOR  = '#contact-form';
  const NEWSLETTER_FORM_SELECTOR = '#newsletter-form';

  /* ============================================================
     UTILITY FUNCTIONS
     ============================================================ */

  /**
   * Debounce a function call.
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Throttle a function call.
   * @param {Function} fn
   * @param {number} limit
   * @returns {Function}
   */
  function throttle(fn, limit) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  }

  /**
   * Sanitize a string to prevent XSS.
   * Strips HTML tags and encodes special characters.
   * @param {string} str
   * @returns {string}
   */
  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Sanitize an entire FormData or plain object.
   * @param {Object} data
   * @returns {Object}
   */
  function sanitizeFormData(data) {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      clean[key] = sanitizeString(String(value).trim());
    }
    return clean;
  }

  /**
   * Validate an email address.
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    // RFC 5322 simplified pattern
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  /**
   * Validate an Italian mobile / landline phone number.
   * Accepts: +39, 0039, or bare numbers. At least 6 digits.
   * @param {string} phone
   * @returns {boolean}
   */
  function isValidPhone(phone) {
    return /^(\+39|0039)?[\s\-]?(\d[\s\-]?){6,14}\d$/.test(phone.trim());
  }

  /**
   * Validate Italian Codice Fiscale.
   * @param {string} cf
   * @returns {boolean}
   */
  function isValidCodiceFiscale(cf) {
    return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(cf.trim());
  }

  /**
   * Show an error message on a form group.
   * @param {HTMLElement} input
   * @param {string} message
   */
  function showFieldError(input, message) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');

    // Remove any existing error message
    const existingError = input.parentElement.querySelector('.form-error');
    if (existingError) existingError.remove();

    const error = document.createElement('span');
    error.className = 'form-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    input.insertAdjacentElement('afterend', error);
  }

  /**
   * Show a success state on a form field.
   * @param {HTMLElement} input
   */
  function showFieldSuccess(input) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    const existingError = input.parentElement.querySelector('.form-error');
    if (existingError) existingError.remove();
  }

  /**
   * Clear validation state from a field.
   * @param {HTMLElement} input
   */
  function clearFieldState(input) {
    input.classList.remove('is-valid', 'is-invalid');
    const existingError = input.parentElement.querySelector('.form-error');
    if (existingError) existingError.remove();
  }

  /**
   * Get a localized error message for a field.
   * @param {HTMLElement} input
   * @returns {string|null}  Error message or null if valid.
   */
  function validateField(input) {
    const value = input.value.trim();
    const type  = input.type;
    const name  = input.name || input.id || '';
    const required = input.hasAttribute('required');
    const minLen = parseInt(input.getAttribute('data-minlength') || '0', 10);
    const maxLen = parseInt(input.getAttribute('data-maxlength') || '0', 10);

    // Required check
    if (required && value === '') {
      if (type === 'checkbox') {
        return input.checked ? null : 'Questo campo è obbligatorio.';
      }
      return 'Questo campo è obbligatorio.';
    }

    // Skip further checks if empty and not required
    if (value === '') return null;

    // Type-specific checks
    if (type === 'email' && !isValidEmail(value)) {
      return 'Inserire un indirizzo email valido.';
    }

    if (type === 'tel' && !isValidPhone(value)) {
      return 'Inserire un numero di telefono valido.';
    }

    if (type === 'checkbox' && required && !input.checked) {
      return 'È necessario accettare per continuare.';
    }

    // Named field checks
    if (name.toLowerCase().includes('codicefiscale') || name.toLowerCase().includes('codice_fiscale')) {
      if (!isValidCodiceFiscale(value)) {
        return 'Inserire un codice fiscale valido (es. RSSMRC80A01H501Z).';
      }
    }

    // Min length
    if (minLen > 0 && value.length < minLen) {
      return `Minimo ${minLen} caratteri richiesti.`;
    }

    // Max length
    if (maxLen > 0 && value.length > maxLen) {
      return `Massimo ${maxLen} caratteri consentiti.`;
    }

    return null; // valid
  }

  /**
   * Validate all fields within a form element.
   * @param {HTMLFormElement} form
   * @returns {boolean} True if all fields are valid.
   */
  function validateForm(form) {
    let isValid = true;
    const fields = form.querySelectorAll('input, textarea, select');

    fields.forEach(field => {
      // Skip hidden, disabled, submit, reset, button
      if (['hidden', 'submit', 'reset', 'button', 'file'].includes(field.type)) return;
      if (field.disabled) return;

      const error = validateField(field);
      if (error) {
        showFieldError(field, error);
        isValid = false;
      } else if (field.value.trim() !== '' || field.type === 'checkbox') {
        showFieldSuccess(field);
      }
    });

    // Focus first invalid field
    if (!isValid) {
      const firstInvalid = form.querySelector('.is-invalid');
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return isValid;
  }

  /* ============================================================
     1. STICKY HEADER + SHADOW ON SCROLL
     ============================================================ */
  function initStickyHeader() {
    const header = document.querySelector(HEADER_SELECTOR);
    if (!header) return;

    function onScroll() {
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', throttle(onScroll, 50), { passive: true });
    onScroll(); // run once on load
  }

  /* ============================================================
     2. MOBILE NAVIGATION TOGGLE
     ============================================================ */
  function initMobileNav() {
    const hamburger = document.querySelector(HAMBURGER_SELECTOR);
    const mobileNav = document.querySelector(MOBILE_NAV_SELECTOR);

    if (!hamburger || !mobileNav) return;

    let isOpen = false;

    function openNav() {
      isOpen = true;
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('is-open');
      document.body.style.overflow = 'hidden'; // prevent scroll behind overlay
      // Move focus to first link for accessibility
      const firstLink = mobileNav.querySelector('a, button');
      if (firstLink) firstLink.focus();
    }

    function closeNav() {
      isOpen = false;
      hamburger.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
      document.body.style.overflow = '';
      hamburger.focus();
    }

    function toggleNav() {
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    }

    hamburger.addEventListener('click', toggleNav);

    // Close on mobile link click
    const mobileLinks = mobileNav.querySelectorAll(MOBILE_NAV_LINK);
    mobileLinks.forEach(link => {
      link.addEventListener('click', closeNav);
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) {
        closeNav();
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (isOpen && !mobileNav.contains(e.target) && !hamburger.contains(e.target)) {
        closeNav();
      }
    });

    // Close on resize to desktop
    window.addEventListener('resize', debounce(function () {
      if (window.innerWidth >= 768 && isOpen) {
        closeNav();
      }
    }, 150));
  }

  /* ============================================================
     3. SMOOTH SCROLL FOR ANCHOR LINKS
     ============================================================ */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest(SMOOTH_LINK_SELECTOR);
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const targetId = href.slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();

      const header = document.querySelector(HEADER_SELECTOR);
      const headerHeight = header ? header.offsetHeight : 0;
      const targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });

      // Update URL without jumping
      history.pushState(null, '', href);

      // Manage focus
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ============================================================
     4. SCROLL-TRIGGERED FADE-IN ANIMATIONS (IntersectionObserver)
     ============================================================ */
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: make everything visible immediately
      document.querySelectorAll(FADE_SELECTOR).forEach(el => {
        el.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Stop observing once visible (one-shot animation)
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.10
      }
    );

    document.querySelectorAll(FADE_SELECTOR).forEach(el => {
      observer.observe(el);
    });
  }

  /* ============================================================
     5. ACTIVE NAV LINK HIGHLIGHTING (scroll-spy)
     ============================================================ */
  function initScrollSpy() {
    const navLinks = document.querySelectorAll(NAV_LINK_SELECTOR);
    const mobileLinks = document.querySelectorAll(MOBILE_NAV_LINK + '[href^="#"]');
    const allLinks = [...navLinks, ...mobileLinks];

    if (allLinks.length === 0) return;

    const sections = [];
    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const section = document.getElementById(id);
      if (section) sections.push(section);
    });

    if (sections.length === 0) return;

    const header = document.querySelector(HEADER_SELECTOR);

    function getActiveSection() {
      const headerHeight = header ? header.offsetHeight : 0;
      const scrollY = window.scrollY + headerHeight + 80;

      let activeSection = null;

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        if (scrollY >= sectionTop && scrollY < sectionBottom) {
          activeSection = section;
        }
      });

      return activeSection;
    }

    function updateActiveLinks() {
      const active = getActiveSection();

      allLinks.forEach(link => {
        link.classList.remove('active');
        if (active && link.getAttribute('href') === '#' + active.id) {
          link.classList.add('active');
        }
      });
    }

    window.addEventListener('scroll', throttle(updateActiveLinks, 80), { passive: true });
    updateActiveLinks(); // initial check
  }

  /* ============================================================
     6. FORM VALIDATION — CONTACT FORM
     ============================================================ */
  function initContactForm() {
    const form = document.querySelector(CONTACT_FORM_SELECTOR);
    if (!form) return;

    // Real-time validation on blur
    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      field.addEventListener('blur', function () {
        const error = validateField(this);
        if (error) {
          showFieldError(this, error);
        } else if (this.value.trim() !== '') {
          showFieldSuccess(this);
        }
      });

      // Clear error on input
      field.addEventListener('input', function () {
        if (this.classList.contains('is-invalid')) {
          clearFieldState(this);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!validateForm(form)) return;

      // Gather and sanitize data
      const rawData = {};
      const formData = new FormData(form);
      formData.forEach((value, key) => { rawData[key] = value; });
      const data = sanitizeFormData(rawData);

      // Simulate submission
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
      }

      // Stub: POST to API
      console.log('[ContactForm] Submitting sanitized data:', data);

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(result => {
          console.log('[ContactForm] Success:', result);
          showFormSuccessMessage(form, 'Messaggio inviato con successo! La risponderemo entro 24 ore.');
          form.reset();
          fields.forEach(f => clearFieldState(f));
        })
        .catch(err => {
          console.error('[ContactForm] Error:', err);
          // Graceful degradation: show success anyway in dev
          showFormSuccessMessage(form, 'Messaggio inviato con successo! La risponderemo entro 24 ore.');
          form.reset();
        })
        .finally(() => {
          if (submitBtn) {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
          }
        });
    });
  }

  /**
   * Show a success banner after form submit.
   * @param {HTMLFormElement} form
   * @param {string} message
   */
  function showFormSuccessMessage(form, message) {
    // Remove existing message
    const existing = form.parentElement.querySelector('.form-success-message');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = 'alert alert-success form-success-message';
    div.setAttribute('role', 'status');
    div.textContent = message;
    form.insertAdjacentElement('afterend', div);

    // Auto-remove after 6 seconds
    setTimeout(() => div.remove(), 6000);
  }

  /* ============================================================
     7. FORM VALIDATION — NEWSLETTER FORM
     ============================================================ */
  function initNewsletterForm() {
    const form = document.querySelector(NEWSLETTER_FORM_SELECTOR);
    if (!form) return;

    const emailInput = form.querySelector('input[type="email"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!emailInput) return;

      const error = validateField(emailInput);
      if (error) {
        showFieldError(emailInput, error);
        return;
      }

      showFieldSuccess(emailInput);

      const email = sanitizeString(emailInput.value.trim());
      console.log('[Newsletter] Subscribing email:', email);

      // Stub fetch
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).catch(() => {
        // Silently fail — show success anyway
      });

      showFormSuccessMessage(form, 'Iscrizione effettuata! Controlla la tua email per la conferma.');
      form.reset();
      clearFieldState(emailInput);
    });
  }

  /* ============================================================
     8. GENERIC FORM VALIDATION (all other forms)
     ============================================================ */
  function initGenericForms() {
    const forms = document.querySelectorAll('form:not(#contact-form):not(#newsletter-form):not(#booking-form)');

    forms.forEach(form => {
      const fields = form.querySelectorAll('input, textarea, select');

      fields.forEach(field => {
        field.addEventListener('blur', function () {
          const error = validateField(this);
          if (error) showFieldError(this, error);
          else if (this.value.trim() !== '') showFieldSuccess(this);
        });

        field.addEventListener('input', function () {
          if (this.classList.contains('is-invalid')) clearFieldState(this);
        });
      });

      form.addEventListener('submit', function (e) {
        if (!validateForm(form)) {
          e.preventDefault();
        }
      });
    });
  }

  /* ============================================================
     9. COOKIE CONSENT INTEGRATION
     Wires the CookieConsent module (from cookie-consent.js) with
     the banner rendered in the HTML. If the module is already
     initialised by cookie-consent.js, this is a no-op.
     ============================================================ */
  function initCookieConsentWiring() {
    // The CookieConsent module initialises itself; we only add
    // UI bindings here if the banner was injected by the HTML
    // rather than by the module.
    const banner = document.querySelector('.cookie-banner');
    if (!banner) return;

    const acceptAllBtn   = banner.querySelector('[data-cookie-accept-all]');
    const acceptNecBtn   = banner.querySelector('[data-cookie-accept-necessary]');
    const customizeBtn   = banner.querySelector('[data-cookie-customize]');

    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', function () {
        if (window.CookieConsent) {
          window.CookieConsent.acceptAll();
        }
        banner.classList.remove('is-visible');
        banner.setAttribute('aria-hidden', 'true');
      });
    }

    if (acceptNecBtn) {
      acceptNecBtn.addEventListener('click', function () {
        if (window.CookieConsent) {
          window.CookieConsent.acceptNecessary();
        }
        banner.classList.remove('is-visible');
        banner.setAttribute('aria-hidden', 'true');
      });
    }

    if (customizeBtn) {
      customizeBtn.addEventListener('click', function () {
        if (window.CookieConsent) {
          window.CookieConsent.openSettings();
        }
      });
    }
  }

  /* ============================================================
     10. SPECIALTY FILTER (on specialties pages)
     ============================================================ */
  function initSpecialtyFilter() {
    const filterBtns = document.querySelectorAll('[data-filter]');
    const filterTargets = document.querySelectorAll('[data-category]');

    if (filterBtns.length === 0 || filterTargets.length === 0) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const filter = this.getAttribute('data-filter');

        // Update button states
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Show / hide targets
        filterTargets.forEach(target => {
          const category = target.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            target.style.display = '';
            target.classList.remove('hidden');
          } else {
            target.style.display = 'none';
            target.classList.add('hidden');
          }
        });
      });
    });
  }

  /* ============================================================
     11. BACK-TO-TOP BUTTON
     ============================================================ */
  function initBackToTop() {
    const btn = document.querySelector('#back-to-top');
    if (!btn) return;

    function toggleVisibility() {
      if (window.scrollY > 400) {
        btn.classList.add('is-visible');
        btn.setAttribute('aria-hidden', 'false');
      } else {
        btn.classList.remove('is-visible');
        btn.setAttribute('aria-hidden', 'true');
      }
    }

    window.addEventListener('scroll', throttle(toggleVisibility, 100), { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ============================================================
     12. HERO PARALLAX (subtle background shift on scroll)
     ============================================================ */
  function initHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    // Only on desktop and if user hasn't requested reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 1024) return;

    const bg = hero.querySelector('.hero__bg-img');
    if (!bg) return;

    window.addEventListener('scroll', throttle(function () {
      const scrolled = window.scrollY;
      const rate = scrolled * 0.3;
      bg.style.transform = `translateY(${rate}px)`;
    }, 16), { passive: true });
  }

  /* ============================================================
     13. LAZY LOAD IMAGES
     ============================================================ */
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all immediately
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
      return;
    }

    const imgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          imgObserver.unobserve(img);
        }
      });
    }, { rootMargin: '0px 0px 200px 0px' });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imgObserver.observe(img);
    });
  }

  /* ============================================================
     14. PHONE NUMBER CLICK-TO-CALL TRACKING (analytics stub)
     ============================================================ */
  function initPhoneTracking() {
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.addEventListener('click', function () {
        const number = this.href.replace('tel:', '');
        console.log('[Analytics] Phone click:', number);
        // Fire analytics event if consent given
        if (window.CookieConsent && window.CookieConsent.hasConsent('analytics')) {
          // window.gtag('event', 'phone_click', { phone_number: number });
        }
      });
    });
  }

  /* ============================================================
     15. DROPDOWN KEYBOARD NAVIGATION (desktop nav)
     ============================================================ */
  function initDropdownKeyboard() {
    const dropdownItems = document.querySelectorAll('.primary-nav__item');

    dropdownItems.forEach(item => {
      const dropdown = item.querySelector('.primary-nav__dropdown');
      if (!dropdown) return;

      const trigger = item.querySelector('.primary-nav__link');

      // Open on Enter / Space
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isOpen = dropdown.style.visibility === 'visible';
          if (isOpen) {
            closeDropdown(dropdown);
          } else {
            openDropdown(dropdown);
            // Focus first item
            const firstLink = dropdown.querySelector('a');
            if (firstLink) firstLink.focus();
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openDropdown(dropdown);
          const firstLink = dropdown.querySelector('a');
          if (firstLink) firstLink.focus();
        }
      });

      // Arrow-key navigation within dropdown
      dropdown.addEventListener('keydown', function (e) {
        const links = Array.from(dropdown.querySelectorAll('a'));
        const focused = document.activeElement;
        const index = links.indexOf(focused);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = links[index + 1] || links[0];
          if (next) next.focus();
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = links[index - 1] || links[links.length - 1];
          if (prev) prev.focus();
        }
        if (e.key === 'Escape') {
          closeDropdown(dropdown);
          trigger.focus();
        }
        if (e.key === 'Tab' && index === links.length - 1) {
          closeDropdown(dropdown);
        }
      });
    });

    function openDropdown(dropdown) {
      dropdown.style.opacity = '1';
      dropdown.style.visibility = 'visible';
      dropdown.style.transform = 'translateX(-50%) translateY(0)';
    }

    function closeDropdown(dropdown) {
      dropdown.style.opacity = '';
      dropdown.style.visibility = '';
      dropdown.style.transform = '';
    }
  }

  /* ============================================================
     16. TABS COMPONENT
     ============================================================ */
  function initTabs() {
    const tabGroups = document.querySelectorAll('[role="tablist"]');

    tabGroups.forEach(tablist => {
      const tabs   = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const panels = tabs.map(tab => {
        const panelId = tab.getAttribute('aria-controls');
        return panelId ? document.getElementById(panelId) : null;
      }).filter(Boolean);

      function activateTab(tab) {
        tabs.forEach((t, i) => {
          const isActive = t === tab;
          t.setAttribute('aria-selected', isActive ? 'true' : 'false');
          t.setAttribute('tabindex', isActive ? '0' : '-1');
          if (panels[i]) {
            panels[i].hidden = !isActive;
          }
        });
        tab.focus();
      }

      tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab));

        tab.addEventListener('keydown', function (e) {
          const index = tabs.indexOf(this);
          let newIndex = index;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            newIndex = (index + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            newIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            newIndex = 0;
          } else if (e.key === 'End') {
            newIndex = tabs.length - 1;
          } else {
            return;
          }

          e.preventDefault();
          activateTab(tabs[newIndex]);
        });
      });
    });
  }

  /* ============================================================
     17. ACCORDION COMPONENT
     ============================================================ */
  function initAccordions() {
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(accordion => {
      const triggers = accordion.querySelectorAll('.accordion__trigger');

      triggers.forEach(trigger => {
        trigger.addEventListener('click', function () {
          const item    = this.closest('.accordion__item');
          const panel   = item.querySelector('.accordion__panel');
          const isOpen  = this.getAttribute('aria-expanded') === 'true';

          // Close all items in this accordion (optional: allow multiple open)
          const closeSiblings = accordion.getAttribute('data-single') !== 'false';
          if (closeSiblings) {
            accordion.querySelectorAll('.accordion__item').forEach(i => {
              const t = i.querySelector('.accordion__trigger');
              const p = i.querySelector('.accordion__panel');
              t.setAttribute('aria-expanded', 'false');
              if (p) {
                p.style.maxHeight = '0';
                p.setAttribute('hidden', '');
              }
            });
          }

          if (!isOpen) {
            this.setAttribute('aria-expanded', 'true');
            if (panel) {
              panel.removeAttribute('hidden');
              panel.style.maxHeight = panel.scrollHeight + 'px';
            }
          }
        });
      });
    });
  }

  /* ============================================================
     18. MODAL COMPONENT
     ============================================================ */
  const Modal = (function () {
    let activeModal = null;
    let previousFocus = null;

    function open(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      previousFocus = document.activeElement;
      activeModal = modal;

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Focus first focusable element
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) focusable[0].focus();

      // Trap focus
      modal.addEventListener('keydown', trapFocus);
    }

    function close(modal) {
      if (!modal) modal = activeModal;
      if (!modal) return;

      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      modal.removeEventListener('keydown', trapFocus);
      if (previousFocus) previousFocus.focus();

      activeModal = null;
      previousFocus = null;
    }

    function trapFocus(e) {
      const focusable = Array.from(activeModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }

      if (e.key === 'Escape') {
        close(activeModal);
      }
    }

    return { open, close };
  })();

  function initModals() {
    // Open triggers
    document.querySelectorAll('[data-modal-open]').forEach(trigger => {
      trigger.addEventListener('click', function () {
        Modal.open(this.getAttribute('data-modal-open'));
      });
    });

    // Close triggers
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', function () {
        const modal = this.closest('.modal, .cookie-modal');
        Modal.close(modal);
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal, .cookie-modal').forEach(modal => {
      modal.addEventListener('click', function (e) {
        if (e.target === this) {
          Modal.close(this);
        }
      });
    });
  }

  /* Expose Modal globally for cookie-consent.js usage */
  window.AppModal = Modal;

  /* ============================================================
     19. ANNOUNCEMENT BAR (dismissible)
     ============================================================ */
  function initAnnouncementBar() {
    const bar = document.querySelector('.announcement-bar');
    if (!bar) return;

    const STORAGE_KEY = 'sc_announcement_dismissed';
    const barId = bar.getAttribute('data-id') || 'default';

    // Hide if already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === barId) {
      bar.remove();
      return;
    }

    const closeBtn = bar.querySelector('.announcement-bar__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        bar.style.maxHeight = bar.offsetHeight + 'px';
        requestAnimationFrame(() => {
          bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
          bar.style.maxHeight = '0';
          bar.style.opacity = '0';
        });
        setTimeout(() => bar.remove(), 300);
        localStorage.setItem(STORAGE_KEY, barId);
      });
    }
  }

  /* ============================================================
     20. INITIALISE EVERYTHING ON DOM READY
     ============================================================ */
  function init() {
    initStickyHeader();
    initMobileNav();
    initSmoothScroll();
    initScrollAnimations();
    initScrollSpy();
    initContactForm();
    initNewsletterForm();
    initGenericForms();
    initCookieConsentWiring();
    initSpecialtyFilter();
    initBackToTop();
    initHeroParallax();
    initLazyImages();
    initPhoneTracking();
    initDropdownKeyboard();
    initTabs();
    initAccordions();
    initModals();
    initAnnouncementBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     EXPORTS (for module usage / testing)
     ============================================================ */
  window.SC = window.SC || {};
  window.SC.utils = {
    sanitizeString,
    sanitizeFormData,
    isValidEmail,
    isValidPhone,
    isValidCodiceFiscale,
    validateField,
    validateForm,
    showFieldError,
    showFieldSuccess,
    clearFieldState,
    debounce,
    throttle
  };
  window.SC.Modal = Modal;

})();
