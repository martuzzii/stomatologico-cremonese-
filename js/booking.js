/**
 * Stomatologico Cremonese / Poliambulatorio Cremona
 * Booking System — booking.js
 * Version: 1.0.0
 *
 * Responsibilities:
 *  - Visual calendar component (vanilla JS, no libraries)
 *  - Doctor / specialty selection (step 1)
 *  - Available time slots display (step 2)
 *  - Multi-step booking form (3 steps)
 *  - New vs returning patient toggle
 *  - Form validation and sanitization
 *  - Email confirmation simulation (console.log + fetch POST stub)
 *  - GDPR consent checkbox for health data
 *  - LocalStorage for non-sensitive partial form data
 *  - Progress indicator for multi-step form
 */

(function () {
  'use strict';

  /* ============================================================
     CONFIGURATION
     ============================================================ */
  const DOCTORS_JSON_URL = '../data/doctors.json';
  const BOOKING_API_URL  = '/api/booking';
  const BOOKINGS_STORAGE_KEY = 'sc_bookings';
  const STORAGE_KEY      = 'sc_booking_partial';

  /* Italian day names */
  const DAYS_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const DAYS_IT_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const MONTHS_IT = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  /* Day name to availability key map */
  const DAY_KEY_MAP = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };

  /* Specialty display names */
  const SPECIALTY_NAMES = {
    'otorinolaringoiatria': 'Otorinolaringoiatria (ORL)',
    'odontoiatria':         'Odontoiatria',
    'medicina-estetica':    'Medicina Estetica'
  };

  /* Specialty icons (SVG paths as text) */
  const SPECIALTY_ICONS = {
    'otorinolaringoiatria': '👂',
    'odontoiatria':         '🦷',
    'medicina-estetica':    '✨'
  };

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    currentStep:    1,
    totalSteps:     3,
    doctors:        [],
    selectedSpecialty: null,
    selectedDoctor: null,
    selectedDate:   null,
    selectedTime:   null,
    patientType:    'new',   // 'new' | 'returning'
    calendarYear:   null,
    calendarMonth:  null,
    formData:       {}
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

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  function isValidPhone(phone) {
    return /^(\+39|0039)?[\s\-]?(\d[\s\-]?){6,14}\d$/.test(phone.trim());
  }

  function isValidCodiceFiscale(cf) {
    return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(cf.trim());
  }

  function formatDate(date) {
    if (!(date instanceof Date)) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  function isToday(date) {
    return isSameDay(date, new Date());
  }

  function isPast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  function getDayKey(date) {
    return DAY_KEY_MAP[date.getDay()];
  }

  function showFieldError(input, message) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');

    const existing = input.parentElement.querySelector('.form-error');
    if (existing) existing.remove();

    const error = document.createElement('span');
    error.className = 'form-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    input.insertAdjacentElement('afterend', error);
  }

  function showFieldSuccess(input) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    const existing = input.parentElement.querySelector('.form-error');
    if (existing) existing.remove();
  }

  function clearFieldState(input) {
    input.classList.remove('is-valid', 'is-invalid');
    const existing = input.parentElement.querySelector('.form-error');
    if (existing) existing.remove();
  }

  function el(selector, context) {
    return (context || document).querySelector(selector);
  }

  function els(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  /* ============================================================
     LOCAL STORAGE — NON-SENSITIVE DATA ONLY
     No health data, no fiscal codes, no DOB stored.
     ============================================================ */
  function savePartialData() {
    const safe = {
      selectedSpecialty: state.selectedSpecialty,
      selectedDoctorId:  state.selectedDoctor ? state.selectedDoctor.id : null,
      patientType:       state.patientType,
      // Only store non-sensitive contact fields
      firstName:  state.formData.firstName  || '',
      lastName:   state.formData.lastName   || '',
      email:      state.formData.email      || '',
      phone:      state.formData.phone      || '',
      savedAt:    new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch (e) {
      console.warn('[Booking] Could not save partial data to localStorage:', e);
    }
  }

  function loadPartialData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expire after 24 hours
      const savedAt = new Date(data.savedAt);
      const hoursDiff = (Date.now() - savedAt.getTime()) / 3600000;
      if (hoursDiff > 24) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearPartialData() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ============================================================
     DATA LOADING
     ============================================================ */
  async function loadDoctors() {
    // Admin panel may have saved an override in localStorage
    try {
      const adminOverride = localStorage.getItem('sc_admin_avail');
      if (adminOverride) {
        state.doctors = JSON.parse(adminOverride);
        return;
      }
    } catch (e) { /* ignore */ }

    try {
      const response = await fetch(DOCTORS_JSON_URL);
      if (!response.ok) throw new Error('Failed to load doctors data');
      const data = await response.json();
      state.doctors = data.doctors || [];
    } catch (err) {
      console.warn('[Booking] Using inline fallback doctor data:', err.message);
      // Inline fallback data (mirrors doctors.json)
      state.doctors = [
        {
          id: 'dr-rossi',
          name: 'Dr. Marco Rossi',
          specialty: 'otorinolaringoiatria',
          title: 'Specialista in Otorinolaringoiatria',
          bio: 'Oltre 15 anni di esperienza in otorinolaringoiatria clinica e chirurgica.',
          availability: {
            monday:    ['09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30','16:00'],
            wednesday: ['09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00'],
            friday:    ['09:00','09:30','10:00','10:30','11:00']
          }
        },
        {
          id: 'dr-ferrari',
          name: 'Dr.ssa Elena Ferrari',
          specialty: 'odontoiatria',
          title: 'Specialista in Odontoiatria e Chirurgia Orale',
          bio: 'Esperta in implantologia, ortodonzia e odontoiatria conservativa.',
          availability: {
            tuesday:  ['08:30','09:00','09:30','10:00','10:30','11:00','15:00','15:30','16:00','16:30'],
            thursday: ['08:30','09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00'],
            saturday: ['09:00','09:30','10:00','10:30','11:00']
          }
        },
        {
          id: 'dr-bianchi',
          name: 'Dr.ssa Sofia Bianchi',
          specialty: 'medicina-estetica',
          title: 'Specialista in Medicina Estetica',
          bio: 'Specializzata in trattamenti estetici non invasivi e ringiovanimento.',
          availability: {
            monday:   ['14:00','14:30','15:00','15:30','16:00','16:30','17:00'],
            thursday: ['14:00','14:30','15:00','15:30','16:00','16:30','17:00'],
            friday:   ['10:00','10:30','11:00','11:30','14:00','14:30','15:00']
          }
        }
      ];
    }
  }

  /* ============================================================
     PROGRESS INDICATOR
     ============================================================ */
  function updateProgress() {
    const steps = els('.booking-progress__step');
    steps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      if (stepNum < state.currentStep)  step.classList.add('completed');
      if (stepNum === state.currentStep) step.classList.add('active');
    });
  }

  /* expose bookings list for admin page */
  window.SC = window.SC || {};
  window.SC.getBookings = function () {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) || '[]'); } catch(e) { return []; }
  };
  window.SC.clearBookings = function () { localStorage.removeItem(BOOKINGS_STORAGE_KEY); };

  /* ============================================================
     STEP VISIBILITY
     ============================================================ */
  function showStep(stepNumber) {
    state.currentStep = stepNumber;

    // Update step panels
    els('.booking-step').forEach(panel => {
      panel.classList.remove('active');
      panel.hidden = true;
    });

    const activePanel = el(`#booking-step-${stepNumber}`);
    if (activePanel) {
      activePanel.classList.add('active');
      activePanel.hidden = false;
    }

    // Update progress
    updateProgress();

    // Update back button
    const backBtn = el('#booking-back');
    if (backBtn) {
      backBtn.style.visibility = stepNumber > 1 ? 'visible' : 'hidden';
    }

    // Update next/submit button label
    const nextBtn = el('#booking-next');
    if (nextBtn) {
      if (stepNumber === state.totalSteps) {
        nextBtn.textContent = 'Conferma Prenotazione';
      } else {
        nextBtn.textContent = 'Continua →';
      }
    }

    // Scroll to top of booking widget
    const wrapper = el('.booking-wrapper');
    if (wrapper) {
      const top = wrapper.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    // Save non-sensitive partial data
    savePartialData();
  }

  /* ============================================================
     STEP 1: SPECIALTY + DOCTOR SELECTION
     ============================================================ */
  function renderStep1() {
    const container = el('#booking-step-1');
    if (!container) return;

    // Get unique specialties
    const specialties = [...new Set(state.doctors.map(d => d.specialty))];

    const specialtiesHtml = specialties.map(spec => `
      <div class="selection-card ${state.selectedSpecialty === spec ? 'selected' : ''}"
           data-specialty="${sanitize(spec)}"
           role="button"
           tabindex="0"
           aria-pressed="${state.selectedSpecialty === spec ? 'true' : 'false'}">
        <div class="selection-card__icon">${SPECIALTY_ICONS[spec] || '🏥'}</div>
        <div class="selection-card__name">${sanitize(SPECIALTY_NAMES[spec] || spec)}</div>
      </div>
    `).join('');

    const specialtySection = el('#specialty-selection', container);
    if (specialtySection) {
      specialtySection.innerHTML = `
        <div class="selection-cards specialties-select fade-in-group is-visible">
          ${specialtiesHtml}
        </div>
      `;
      bindSpecialtyCards(specialtySection);
    }

    // Render doctors (filtered by selected specialty)
    renderDoctorSelection(container);
  }

  function bindSpecialtyCards(container) {
    els('.selection-card[data-specialty]', container).forEach(card => {
      function selectSpecialty() {
        const spec = card.getAttribute('data-specialty');
        state.selectedSpecialty = spec;
        state.selectedDoctor    = null; // reset doctor when specialty changes

        // Update card states
        els('.selection-card[data-specialty]', container).forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');

        // Re-render doctor list
        renderDoctorSelection(el('#booking-step-1'));
      }

      card.addEventListener('click', selectSpecialty);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectSpecialty();
        }
      });
    });
  }

  function renderDoctorSelection(container) {
    const doctorSection = el('#doctor-selection', container);
    if (!doctorSection) return;

    const doctors = state.selectedSpecialty
      ? state.doctors.filter(d => d.specialty === state.selectedSpecialty)
      : state.doctors;

    if (doctors.length === 0) {
      doctorSection.innerHTML = `
        <p class="time-slots__empty">Seleziona una specialità per vedere i medici disponibili.</p>
      `;
      return;
    }

    const doctorsHtml = doctors.map(doctor => `
      <div class="selection-card ${state.selectedDoctor && state.selectedDoctor.id === doctor.id ? 'selected' : ''}"
           data-doctor-id="${sanitize(doctor.id)}"
           role="button"
           tabindex="0"
           aria-pressed="${state.selectedDoctor && state.selectedDoctor.id === doctor.id ? 'true' : 'false'}">
        <div class="selection-card__icon" style="font-size:1.5rem;">
          ${doctor.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <div>
          <div class="selection-card__name">${sanitize(doctor.name)}</div>
          <div class="selection-card__meta">${sanitize(doctor.title)}</div>
          <div class="selection-card__meta" style="margin-top:4px;font-style:italic;">${sanitize(doctor.bio)}</div>
        </div>
      </div>
    `).join('');

    doctorSection.innerHTML = `
      <h4 class="booking-step__subtitle" style="margin-bottom:var(--space-4);">Scegli il medico</h4>
      <div class="selection-cards fade-in-group is-visible">
        ${doctorsHtml}
      </div>
    `;

    // Bind doctor cards
    els('.selection-card[data-doctor-id]', doctorSection).forEach(card => {
      function selectDoctor() {
        const id = card.getAttribute('data-doctor-id');
        state.selectedDoctor = state.doctors.find(d => d.id === id) || null;

        els('.selection-card[data-doctor-id]', doctorSection).forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
      }

      card.addEventListener('click', selectDoctor);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDoctor();
        }
      });
    });
  }

  function validateStep1() {
    if (!state.selectedSpecialty) {
      showStepError('Seleziona una specialità per continuare.');
      return false;
    }
    if (!state.selectedDoctor) {
      showStepError('Seleziona un medico per continuare.');
      return false;
    }
    clearStepError();
    return true;
  }

  /* ============================================================
     STEP 2: DATE + TIME SELECTION (CALENDAR)
     ============================================================ */
  function initCalendarState() {
    const today = new Date();
    state.calendarYear  = today.getFullYear();
    state.calendarMonth = today.getMonth();
  }

  function renderStep2() {
    const container = el('#booking-step-2');
    if (!container) return;

    // Show selected doctor info
    const infoEl = el('#step2-doctor-info', container);
    if (infoEl && state.selectedDoctor) {
      infoEl.innerHTML = `
        <div class="alert alert-info" style="margin-bottom:var(--space-6);">
          <strong>${sanitize(state.selectedDoctor.name)}</strong>
          — ${sanitize(SPECIALTY_NAMES[state.selectedSpecialty] || state.selectedSpecialty)}
        </div>
      `;
    }

    renderCalendar();
    renderTimeSlots();
  }

  function getAvailableTimesForDate(date) {
    if (!state.selectedDoctor || !date) return [];
    const dayKey = getDayKey(date);
    const availability = state.selectedDoctor.availability || {};
    return availability[dayKey] || [];
  }

  function hasAvailability(date) {
    return getAvailableTimesForDate(date).length > 0;
  }

  function renderCalendar() {
    const calendarEl = el('#booking-calendar');
    if (!calendarEl) return;

    const year  = state.calendarYear;
    const month = state.calendarMonth;

    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    const today     = new Date();
    today.setHours(0, 0, 0, 0);

    // Day of week for first day (Mon = 0 ... Sun = 6, Italian convention)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6; // Sunday adjustment

    const monthName = MONTHS_IT[month];

    // Build day cells
    let dayCells = '';

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
      dayCells += '<div class="calendar__day empty" aria-hidden="true"></div>';
    }

    // Day cells
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const cellDate = new Date(year, month, d);
      const classes  = ['calendar__day'];
      const attrs    = [];

      if (isPast(cellDate)) {
        classes.push('past', 'disabled');
        attrs.push('aria-disabled="true"');
      } else if (hasAvailability(cellDate)) {
        classes.push('has-slots');
        attrs.push(`tabindex="0"`);
        attrs.push(`role="button"`);
        attrs.push(`aria-label="${d} ${monthName} ${year}"`);
      } else {
        classes.push('disabled');
        attrs.push('aria-disabled="true"');
        attrs.push(`title="Nessuna disponibilità"`);
      }

      if (isToday(cellDate))                        classes.push('today');
      if (state.selectedDate && isSameDay(cellDate, state.selectedDate)) classes.push('selected');

      dayCells += `
        <div class="${classes.join(' ')}"
             data-date="${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}"
             ${attrs.join(' ')}>
          ${d}
        </div>
      `;
    }

    calendarEl.innerHTML = `
      <div class="calendar">
        <div class="calendar__header">
          <button class="calendar__nav-btn" id="cal-prev" aria-label="Mese precedente">&#8249;</button>
          <span class="calendar__month-year">${monthName} ${year}</span>
          <button class="calendar__nav-btn" id="cal-next" aria-label="Mese successivo">&#8250;</button>
        </div>
        <div class="calendar__weekdays" aria-hidden="true">
          ${DAYS_IT_SHORT.slice(1).concat(DAYS_IT_SHORT[0]).map(d =>
            `<div class="calendar__weekday">${d}</div>`
          ).join('')}
        </div>
        <div class="calendar__grid" role="grid" aria-label="Scegli una data">
          ${dayCells}
        </div>
      </div>
    `;

    // Bind navigation buttons
    const prevBtn = el('#cal-prev');
    const nextBtn = el('#cal-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        state.calendarMonth--;
        if (state.calendarMonth < 0) {
          state.calendarMonth = 11;
          state.calendarYear--;
        }
        renderCalendar();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        state.calendarMonth++;
        if (state.calendarMonth > 11) {
          state.calendarMonth = 0;
          state.calendarYear++;
        }
        renderCalendar();
      });
    }

    // Bind day clicks
    els('.calendar__day.has-slots', calendarEl).forEach(dayEl => {
      function selectDay() {
        const dateStr = dayEl.getAttribute('data-date');
        if (!dateStr) return;
        const [y, m, d] = dateStr.split('-').map(Number);
        state.selectedDate = new Date(y, m - 1, d);
        state.selectedTime = null; // reset time
        renderCalendar();   // re-render to show selection
        renderTimeSlots();  // show time slots for selected day
      }

      dayEl.addEventListener('click', selectDay);
      dayEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDay();
        }
      });
    });
  }

  function renderTimeSlots() {
    const slotsContainer = el('#time-slots-container');
    if (!slotsContainer) return;

    if (!state.selectedDate) {
      slotsContainer.innerHTML = `
        <p class="time-slots__empty">Seleziona una data nel calendario per vedere gli orari disponibili.</p>
      `;
      return;
    }

    const slots = getAvailableTimesForDate(state.selectedDate);

    if (slots.length === 0) {
      slotsContainer.innerHTML = `
        <p class="time-slots__empty">Nessun orario disponibile per ${formatDate(state.selectedDate)}.</p>
      `;
      return;
    }

    const slotsHtml = slots.map(time => `
      <div class="time-slot ${state.selectedTime === time ? 'selected' : ''}"
           data-time="${sanitize(time)}"
           role="button"
           tabindex="0"
           aria-pressed="${state.selectedTime === time ? 'true' : 'false'}"
           aria-label="${time}">
        ${sanitize(time)}
      </div>
    `).join('');

    slotsContainer.innerHTML = `
      <div class="time-slots">
        <h4 class="time-slots__title">
          Orari disponibili per ${DAYS_IT[state.selectedDate.getDay()]}, ${formatDate(state.selectedDate)}
        </h4>
        <div class="time-slots__grid fade-in-group is-visible">
          ${slotsHtml}
        </div>
      </div>
    `;

    // Bind slot clicks
    els('.time-slot', slotsContainer).forEach(slot => {
      function selectSlot() {
        const time = slot.getAttribute('data-time');
        state.selectedTime = time;

        els('.time-slot', slotsContainer).forEach(s => {
          s.classList.remove('selected');
          s.setAttribute('aria-pressed', 'false');
        });
        slot.classList.add('selected');
        slot.setAttribute('aria-pressed', 'true');
      }

      slot.addEventListener('click', selectSlot);
      slot.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectSlot();
        }
      });
    });
  }

  function validateStep2() {
    if (!state.selectedDate) {
      showStepError('Seleziona una data dal calendario per continuare.');
      return false;
    }
    if (!state.selectedTime) {
      showStepError('Seleziona un orario per continuare.');
      return false;
    }
    clearStepError();
    return true;
  }

  /* ============================================================
     STEP 3: PATIENT INFORMATION FORM
     ============================================================ */
  function renderStep3() {
    const container = el('#booking-step-3');
    if (!container) return;

    // Show booking summary
    const summaryEl = el('#booking-summary', container);
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:var(--space-6);">
          <div>
            <strong>Riepilogo prenotazione:</strong><br>
            🏥 ${sanitize(SPECIALTY_NAMES[state.selectedSpecialty] || state.selectedSpecialty)}<br>
            👨‍⚕️ ${sanitize(state.selectedDoctor ? state.selectedDoctor.name : '')}<br>
            📅 ${state.selectedDate ? formatDate(state.selectedDate) : '—'}
               alle ${sanitize(state.selectedTime || '—')}
          </div>
        </div>
      `;
    }

    // Patient type toggle
    const patientToggle = el('#patient-type-toggle', container);
    if (patientToggle) {
      const newBtn = el('[data-patient-type="new"]', patientToggle);
      const retBtn = el('[data-patient-type="returning"]', patientToggle);

      function updateToggle(type) {
        state.patientType = type;

        if (newBtn) newBtn.classList.toggle('active', type === 'new');
        if (retBtn) retBtn.classList.toggle('active', type === 'returning');

        const newFields = el('#new-patient-fields', container);
        if (newFields) {
          newFields.hidden = (type !== 'new');
          els('input, select', newFields).forEach(inp => {
            inp.disabled = (type !== 'new');
          });
        }
      }

      if (newBtn) newBtn.addEventListener('click', () => updateToggle('new'));
      if (retBtn) retBtn.addEventListener('click', () => updateToggle('returning'));

      updateToggle(state.patientType);
    }

    // Pre-fill from saved partial data
    const saved = loadPartialData();
    if (saved) {
      const fields = {
        firstName: el('#field-firstname', container),
        lastName:  el('#field-lastname',  container),
        email:     el('#field-email',     container),
        phone:     el('#field-phone',     container)
      };
      Object.entries(fields).forEach(([key, inp]) => {
        if (inp && saved[key]) inp.value = saved[key];
      });
    }

    // Real-time validation
    els('input, select, textarea', container).forEach(field => {
      field.addEventListener('blur', function () {
        if (this.disabled) return;
        const required = this.hasAttribute('required');
        const value    = this.value.trim();

        if (required && value === '') {
          showFieldError(this, 'Questo campo è obbligatorio.');
          return;
        }
        if (value === '') { clearFieldState(this); return; }

        if (this.type === 'email' && !isValidEmail(value)) {
          showFieldError(this, 'Inserire un indirizzo email valido.');
          return;
        }
        if (this.type === 'tel' && !isValidPhone(value)) {
          showFieldError(this, 'Inserire un numero di telefono valido (es. 0372 12345).');
          return;
        }
        if (this.name === 'codiceFiscale' && !isValidCodiceFiscale(value)) {
          showFieldError(this, 'Inserire un codice fiscale valido.');
          return;
        }
        if (this.type === 'checkbox' && this.hasAttribute('required') && !this.checked) {
          showFieldError(this, 'È necessario accettare per continuare.');
          return;
        }
        showFieldSuccess(this);

        // Save non-sensitive partial data on each valid blur
        collectFormData(container);
        savePartialData();
      });

      field.addEventListener('change', function () {
        if (this.classList.contains('is-invalid')) clearFieldState(this);
      });
    });
  }

  function collectFormData(container) {
    const fields = els('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)', container);
    fields.forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') {
        state.formData[field.name || field.id] = field.checked;
      } else {
        state.formData[field.name || field.id] = field.value.trim();
      }
    });
  }

  function validateStep3() {
    const container = el('#booking-step-3');
    if (!container) return false;

    let isValid = true;
    const fields = els('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)', container);

    fields.forEach(field => {
      if (['hidden', 'submit', 'reset', 'button'].includes(field.type)) return;

      const value    = field.value.trim();
      const required = field.hasAttribute('required');

      // Required check
      if (required && !value && field.type !== 'checkbox') {
        showFieldError(field, 'Questo campo è obbligatorio.');
        isValid = false;
        return;
      }

      if (required && field.type === 'checkbox' && !field.checked) {
        showFieldError(field, 'È necessario accettare per continuare.');
        isValid = false;
        return;
      }

      if (!value) return;

      if (field.type === 'email' && !isValidEmail(value)) {
        showFieldError(field, 'Inserire un indirizzo email valido.');
        isValid = false;
        return;
      }

      if (field.type === 'tel' && !isValidPhone(value)) {
        showFieldError(field, 'Inserire un numero di telefono valido.');
        isValid = false;
        return;
      }

      if (field.name === 'codiceFiscale' && state.patientType === 'new' && !isValidCodiceFiscale(value)) {
        showFieldError(field, 'Inserire un codice fiscale valido (es. RSSMRC80A01H501Z).');
        isValid = false;
        return;
      }

      showFieldSuccess(field);
    });

    if (!isValid) {
      const firstInvalid = container.querySelector('.is-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }
    }

    return isValid;
  }

  /* ============================================================
     STEP ERROR DISPLAY
     ============================================================ */
  function showStepError(message) {
    clearStepError();
    const errorEl = el('#booking-step-error');
    if (!errorEl) {
      const err = document.createElement('div');
      err.id = 'booking-step-error';
      err.className = 'alert alert-error';
      err.setAttribute('role', 'alert');
      err.textContent = message;

      const nav = el('.booking-nav');
      if (nav) nav.insertAdjacentElement('beforebegin', err);
      return;
    }
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearStepError() {
    const errorEl = el('#booking-step-error');
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  /* ============================================================
     FORM SUBMISSION
     ============================================================ */
  async function submitBooking() {
    const container = el('#booking-step-3');
    collectFormData(container);

    // Sanitize all form data
    const rawPayload = {
      specialty:    state.selectedSpecialty,
      doctorId:     state.selectedDoctor ? state.selectedDoctor.id : null,
      doctorName:   state.selectedDoctor ? state.selectedDoctor.name : null,
      date:         state.selectedDate ? state.selectedDate.toISOString().split('T')[0] : null,
      time:         state.selectedTime,
      patientType:  state.patientType,
      ...state.formData
    };

    const payload = {};
    Object.entries(rawPayload).forEach(([k, v]) => {
      payload[k] = typeof v === 'string' ? sanitize(v) : v;
    });

    // Email confirmation simulation
    console.log('[Booking] Submitting booking:', {
      ...payload,
      // Redact sensitive fields in log
      codiceFiscale: payload.codiceFiscale ? '[REDACTED]' : undefined,
      dataNascita:   payload.dataNascita   ? '[REDACTED]' : undefined
    });

    console.log('[Booking] Confirmation email would be sent to:', payload.email);

    const nextBtn = el('#booking-next');
    if (nextBtn) {
      nextBtn.classList.add('loading');
      nextBtn.disabled = true;
    }

    try {
      const response = await fetch(BOOKING_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // If API unavailable, still show success in dev
        console.warn('[Booking] API returned:', response.status, '— showing success anyway');
      } else {
        const result = await response.json();
        console.log('[Booking] API response:', result);
      }
    } catch (err) {
      // Network error or dev environment — graceful degradation
      console.warn('[Booking] Fetch error (expected in dev):', err.message);
    } finally {
      if (nextBtn) {
        nextBtn.classList.remove('loading');
        nextBtn.disabled = false;
      }
    }

    // Persist booking for admin panel
    try {
      const existing = JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) || '[]');
      existing.unshift({ id: Date.now(), receivedAt: new Date().toISOString(), ...payload });
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(existing.slice(0, 200)));
    } catch (e) { /* ignore storage errors */ }

    // Clear partial data from localStorage
    clearPartialData();

    // Show confirmation screen
    showConfirmation(payload);
  }

  function showConfirmation(payload) {
    const bookingWrapper = el('.booking-wrapper');
    if (!bookingWrapper) return;

    const dateFormatted = state.selectedDate ? formatDate(state.selectedDate) : '—';
    const dayName       = state.selectedDate ? DAYS_IT[state.selectedDate.getDay()] : '';

    bookingWrapper.innerHTML = `
      <div class="booking-confirmation" style="padding: var(--space-12) var(--space-8); text-align:center;">
        <div style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: var(--green-pale);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-6);
          font-size: 2.5rem;">
          ✅
        </div>
        <h2 style="color: var(--green-dark); margin-bottom: var(--space-3);">
          Prenotazione Confermata!
        </h2>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-8); font-size: var(--font-size-md);">
          La sua prenotazione è stata ricevuta con successo.<br>
          Riceverà una conferma via email all'indirizzo <strong>${sanitize(payload.email || '')}</strong>.
        </p>

        <div class="card" style="text-align:left; max-width: 480px; margin: 0 auto var(--space-8);">
          <div class="card__body">
            <h3 style="margin-bottom: var(--space-4); color: var(--text-primary); font-size: var(--font-size-lg);">
              Dettagli appuntamento
            </h3>
            <table class="table">
              <tbody>
                <tr>
                  <td class="day" style="color: var(--text-secondary);">Specialità</td>
                  <td class="hours"><strong>${sanitize(SPECIALTY_NAMES[payload.specialty] || payload.specialty || '—')}</strong></td>
                </tr>
                <tr>
                  <td class="day">Medico</td>
                  <td class="hours">${sanitize(payload.doctorName || '—')}</td>
                </tr>
                <tr>
                  <td class="day">Data</td>
                  <td class="hours">${dayName}, ${dateFormatted}</td>
                </tr>
                <tr>
                  <td class="day">Orario</td>
                  <td class="hours">${sanitize(payload.time || '—')}</td>
                </tr>
                <tr>
                  <td class="day">Paziente</td>
                  <td class="hours">${sanitize((payload.firstName || '') + ' ' + (payload.lastName || ''))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="alert alert-info" style="max-width: 480px; margin: 0 auto var(--space-8); text-align:left;">
          <div>
            <strong>Promemoria:</strong><br>
            Poliambulatorio Stomatologico Cremonese<br>
            Piazza Libertà 24, Cremona (CR)<br>
            Si prega di arrivare 10 minuti prima dell'appuntamento<br>
            con un documento d'identità valido.
          </div>
        </div>

        <div style="display:flex; gap:var(--space-4); justify-content:center; flex-wrap:wrap;">
          <a href="/" class="btn btn-secondary">Torna alla Home</a>
          <button class="btn btn-primary" onclick="window.print()">Stampa conferma</button>
        </div>
      </div>
    `;
  }

  /* ============================================================
     NAVIGATION BETWEEN STEPS
     ============================================================ */
  function handleNext() {
    clearStepError();

    switch (state.currentStep) {
      case 1:
        if (!validateStep1()) return;
        if (state.calendarYear === null) initCalendarState();
        showStep(2);
        renderStep2();
        break;

      case 2:
        if (!validateStep2()) return;
        showStep(3);
        renderStep3();
        break;

      case 3:
        if (!validateStep3()) return;
        submitBooking();
        break;

      default:
        break;
    }
  }

  function handleBack() {
    clearStepError();

    if (state.currentStep > 1) {
      showStep(state.currentStep - 1);
      if (state.currentStep === 1) renderStep1();
      if (state.currentStep === 2) renderStep2();
    }
  }

  /* ============================================================
     INITIALISATION
     ============================================================ */
  async function init() {
    const bookingWrapper = el('.booking-wrapper');
    if (!bookingWrapper) return;

    // Load doctor data
    await loadDoctors();

    // Set initial state
    initCalendarState();

    // Wire up navigation buttons
    const nextBtn = el('#booking-next');
    const backBtn = el('#booking-back');

    if (nextBtn) nextBtn.addEventListener('click', handleNext);
    if (backBtn) backBtn.addEventListener('click', handleBack);

    // Show step 1 (unhide it explicitly)
    const step1 = el('#booking-step-1');
    if (step1) { step1.hidden = false; step1.classList.add('active'); }

    // Render step 1 initially
    updateProgress();
    renderStep1();

    // Try to restore partial data
    const saved = loadPartialData();
    if (saved) {
      console.log('[Booking] Restored partial data from localStorage');
      // Restore specialty selection if available
      if (saved.selectedSpecialty) {
        state.selectedSpecialty = saved.selectedSpecialty;
      }
      if (saved.selectedDoctorId) {
        state.selectedDoctor = state.doctors.find(d => d.id === saved.selectedDoctorId) || null;
      }
      if (saved.patientType) {
        state.patientType = saved.patientType;
      }
      // Re-render step 1 with restored selections
      renderStep1();
    }
  }

  /* ============================================================
     KICK OFF
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Expose for debugging */
  window.SC       = window.SC || {};
  window.SC.Booking = {
    state,
    showStep,
    renderCalendar,
    renderTimeSlots,
    getAvailableTimesForDate,
    clearPartialData
  };

})();
