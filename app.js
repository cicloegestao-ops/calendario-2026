/* ============================================================
   CALENDÁRIO CORPORATIVO 2026
   Lista mensal vertical · Edição via painel · Persistência local
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'calendario_corporativo_2026_v2';
  const YEAR = 2026;

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const CATEGORY_LABELS = {
    avaliacao: 'Avaliação',
    reuniao: 'Reunião',
    meta: 'Meta / Prazo',
    clima: 'Clima',
    desenvolvimento: 'Desenvolvimento',
    evento_externo: 'Evento externo',
    operacional: 'Operacional',
    feriado: 'Feriado',
    pessoal: 'Pessoal',
    outro: 'Outro',
  };

  let state = {
    events: [],
    inconsistencies: [],
    originalData: null,
    activeMonth: 'all', // 'all' ou 0..11
    today: new Date(),
  };

  // ================= UTILS =================
  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtDDMM(d) { return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function eventStartsInMonth(ev, monthIdx) {
    return parseISO(ev.start).getMonth() === monthIdx;
  }

  // ================= STORAGE =================
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        events: state.events,
        savedAt: new Date().toISOString(),
      }));
    } catch (e) { console.warn(e); }
  }

  // ================= INIT =================
  async function init() {
    let original = null;
    try {
      const res = await fetch('events.json');
      if (res.ok) original = await res.json();
    } catch (e) { /* ignore */ }

    if (original) {
      state.originalData = original;
      state.inconsistencies = original.inconsistencies || [];
    } else if (window.EMBEDDED_EVENTS) {
      state.originalData = window.EMBEDDED_EVENTS;
      state.inconsistencies = window.EMBEDDED_EVENTS.inconsistencies || [];
    }

    const stored = loadFromStorage();
    if (stored && Array.isArray(stored.events) && stored.events.length > 0) {
      state.events = stored.events;
    } else if (state.originalData) {
      state.events = state.originalData.events.map(e => ({ ...e }));
    }

    setupListeners();
    renderAll();
  }

  // ================= LISTENERS =================
  function setupListeners() {
    document.getElementById('btn-admin').addEventListener('click', openAdmin);
    document.querySelectorAll('[data-admin-close]').forEach(el => {
      el.addEventListener('click', closeAdmin);
    });
    document.querySelectorAll('#event-modal [data-close]').forEach(el => {
      el.addEventListener('click', closeModal);
    });
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelector(`[data-admin-section="${t.dataset.adminTab}"]`).classList.add('active');
      });
    });
    document.getElementById('admin-form').addEventListener('submit', onAdminFormSubmit);
    document.getElementById('form-cancel').addEventListener('click', resetForm);
    document.getElementById('admin-search').addEventListener('input', renderAdminList);
    document.getElementById('btn-export-json').addEventListener('click', exportJSON);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-copy-json').addEventListener('click', copyJSON);
    document.getElementById('file-import').addEventListener('change', importFile);
    document.getElementById('btn-reset').addEventListener('click', resetToOriginal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeAdmin(); }
    });
  }

  // ================= RENDER =================
  function renderAll() {
    renderStats();
    renderUpcoming();
    renderMonthFilter();
    renderMonths();
    renderAdminList();
    renderInconsistencies();
  }

  // ----- stats no hero -----
  function renderStats() {
    const monthsActive = new Set();
    state.events.forEach(ev => {
      const s = parseISO(ev.start);
      const e = parseISO(ev.end);
      let cur = new Date(s);
      while (cur <= e) {
        if (cur.getFullYear() === YEAR) monthsActive.add(cur.getMonth());
        cur.setDate(cur.getDate() + 1);
      }
    });
    document.getElementById('stat-months').textContent = monthsActive.size;
    document.getElementById('stat-events').textContent = state.events.length;
    document.getElementById('stat-important').textContent =
      state.events.filter(e => e.important).length;
  }

  // ----- próximos eventos -----
  function renderUpcoming() {
    const today = state.today;
    const refDate = today.getFullYear() < YEAR ? new Date(YEAR, 0, 1) : today;

    const upcoming = state.events
      .filter(ev => parseISO(ev.end) >= refDate)
      .sort((a, b) => parseISO(a.start) - parseISO(b.start))
      .slice(0, 4);

    const grid = document.getElementById('upcoming-grid');
    if (upcoming.length === 0) {
      grid.innerHTML = '<p style="color: var(--text-soft); font-size: 13px;">Nenhum evento futuro programado.</p>';
      return;
    }

    grid.innerHTML = upcoming.map(ev => {
      const s = parseISO(ev.start);
      const e = parseISO(ev.end);
      const month = MONTH_NAMES[s.getMonth()];
      const dateStr = isSameDay(s, e) ? fmtDDMM(s) : `${fmtDDMM(s)} - ${fmtDDMM(e)}`;
      return `
        <button class="upcoming-item" data-event-id="${ev.id}">
          <div class="upcoming-month">${month}</div>
          <div class="upcoming-title">${escapeHtml(ev.title)}</div>
          <div class="upcoming-date">📅 ${dateStr}</div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('[data-event-id]').forEach(el => {
      el.addEventListener('click', () => openModal(el.dataset.eventId));
    });
  }

  // ----- filtro -----
  function renderMonthFilter() {
    const filter = document.getElementById('month-filter');
    const buttons = [
      `<button class="filter-pill ${state.activeMonth === 'all' ? 'active' : ''}" data-month="all">Todos</button>`
    ];
    MONTH_NAMES.forEach((m, i) => {
      const count = state.events.filter(ev => eventStartsInMonth(ev, i)).length;
      if (count === 0) return;
      buttons.push(`<button class="filter-pill ${state.activeMonth === i ? 'active' : ''}" data-month="${i}">${m}</button>`);
    });
    filter.innerHTML = buttons.join('');
    filter.querySelectorAll('.filter-pill').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.dataset.month;
        state.activeMonth = v === 'all' ? 'all' : parseInt(v, 10);
        renderMonthFilter();
        renderMonths();
      });
    });
  }

  // ----- lista de meses -----
  function renderMonths() {
    const list = document.getElementById('months-list');

    let monthsToRender;
    if (state.activeMonth === 'all') {
      monthsToRender = MONTH_NAMES.map((_, i) => i);
    } else {
      monthsToRender = [state.activeMonth];
    }

    list.innerHTML = monthsToRender.map(monthIdx => renderMonthCard(monthIdx)).join('');

    list.querySelectorAll('[data-event-id]').forEach(el => {
      el.addEventListener('click', () => openModal(el.dataset.eventId));
    });
  }

  function renderMonthCard(monthIdx) {
    const monthName = MONTH_NAMES[monthIdx];
    const number = pad2(monthIdx + 1);
    const isCurrent = state.today.getFullYear() === YEAR && state.today.getMonth() === monthIdx;

    const monthEvents = state.events
      .filter(ev => eventStartsInMonth(ev, monthIdx))
      .sort((a, b) => parseISO(a.start) - parseISO(b.start));

    const isEmpty = monthEvents.length === 0;
    const tag = isCurrent ? '<span class="month-tag">Mês atual</span>' : '';
    const countText = monthEvents.length === 1 ? '1 evento' : `${monthEvents.length} eventos`;

    const eventsHtml = isEmpty
      ? '<p class="month-empty">Sem eventos programados.</p>'
      : monthEvents.map(ev => renderEventCard(ev, monthIdx)).join('');

    return `
      <div class="month-card ${isCurrent ? 'is-current' : ''} ${isEmpty ? 'is-empty' : ''}">
        <div class="month-number">${number}</div>
        <div class="month-header">
          <h3 class="month-name">${monthName}</h3>
          ${tag}
        </div>
        <div class="month-count">${countText}</div>
        <div class="month-events">${eventsHtml}</div>
      </div>
    `;
  }

  function renderEventCard(ev, currentMonth) {
    const s = parseISO(ev.start);
    const e = parseISO(ev.end);
    const cat = ev.category || 'outro';
    const sameDay = isSameDay(s, e);

    let dayBlock;
    if (sameDay) {
      dayBlock = `
        <div class="event-day">
          <div class="event-day-num">${pad2(s.getDate())}</div>
          <div class="event-day-lbl">dia</div>
        </div>
      `;
    } else {
      // mostra DD/MM - DD/MM (ou só dias se mesmo mês)
      const sameMonth = s.getMonth() === e.getMonth();
      const startStr = sameMonth ? pad2(s.getDate()) : fmtDDMM(s);
      const endStr = sameMonth ? pad2(e.getDate()) : fmtDDMM(e);
      dayBlock = `
        <div class="event-day is-range">
          <div class="event-day-num">${startStr}–${endStr}</div>
          <div class="event-day-lbl">${ev.days} dias</div>
        </div>
      `;
    }

    const star = ev.important ? '<span class="event-star" title="Marco importante">★</span>' : '';
    const catLabel = CATEGORY_LABELS[cat] || 'Outro';

    return `
      <div class="event-card ${ev.important ? 'is-important' : ''}" data-event-id="${ev.id}">
        ${dayBlock}
        <div class="event-info">
          <div class="event-title">
            ${escapeHtml(ev.title)}
            ${star}
          </div>
          <div class="event-meta">
            <span class="event-cat cat-${cat}">${catLabel}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ================= MODAL =================
  function openModal(eventId) {
    const ev = state.events.find(e => e.id === eventId);
    if (!ev) return;
    const modal = document.getElementById('event-modal');
    const cat = ev.category || 'outro';
    const tag = document.getElementById('modal-tag');
    tag.textContent = CATEGORY_LABELS[cat] || 'Outro';
    tag.className = `modal-tag cat-${cat}`;
    document.getElementById('modal-title').textContent = ev.title;

    const s = parseISO(ev.start);
    const e = parseISO(ev.end);
    const datesEl = document.getElementById('modal-dates');
    if (isSameDay(s, e)) {
      const dow = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][s.getDay()];
      datesEl.textContent = `${pad2(s.getDate())} de ${MONTH_NAMES[s.getMonth()].toLowerCase()} (${dow})`;
    } else {
      datesEl.textContent = `${pad2(s.getDate())} de ${MONTH_NAMES[s.getMonth()].toLowerCase()} até ${pad2(e.getDate())} de ${MONTH_NAMES[e.getMonth()].toLowerCase()} · ${ev.days} dias`;
    }

    const notesEl = document.getElementById('modal-notes');
    if (ev.notes && ev.notes.trim()) {
      notesEl.textContent = ev.notes;
      notesEl.classList.add('has-notes');
    } else {
      notesEl.classList.remove('has-notes');
    }

    const meta = [];
    if (ev.important) meta.push('★ Marco importante');
    if (ev.all_labels && ev.all_labels.length > 1) {
      meta.push(`Variações na planilha: ${ev.all_labels.join(' / ')}`);
    }
    document.getElementById('modal-meta').textContent = meta.join(' · ');

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    const m = document.getElementById('event-modal');
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  }

  // ================= ADMIN =================
  function openAdmin() {
    document.getElementById('admin-panel').classList.add('open');
    document.getElementById('admin-panel').setAttribute('aria-hidden', 'false');
  }
  function closeAdmin() {
    document.getElementById('admin-panel').classList.remove('open');
    document.getElementById('admin-panel').setAttribute('aria-hidden', 'true');
  }

  function renderAdminList() {
    const search = (document.getElementById('admin-search').value || '').toLowerCase();
    const list = document.getElementById('admin-list');
    const filtered = state.events
      .filter(e => !search || e.title.toLowerCase().includes(search))
      .sort((a, b) => parseISO(a.start) - parseISO(b.start));

    if (filtered.length === 0) {
      list.innerHTML = '<p style="color: var(--text-soft); text-align: center; padding: 24px;">Nenhum evento</p>';
      return;
    }

    list.innerHTML = filtered.map(ev => {
      const s = parseISO(ev.start);
      const e = parseISO(ev.end);
      const dateStr = isSameDay(s, e) ? fmtDDMM(s) : `${fmtDDMM(s)} - ${fmtDDMM(e)}`;
      return `
        <div class="admin-item">
          <div class="admin-item-info">
            <div class="admin-item-title">${escapeHtml(ev.title)}</div>
            <div class="admin-item-date">${dateStr} · ${CATEGORY_LABELS[ev.category || 'outro']}</div>
          </div>
          <div class="admin-item-actions">
            <button class="admin-item-btn" data-edit="${ev.id}">Editar</button>
            <button class="admin-item-btn delete" data-delete="${ev.id}">Excluir</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => editEvent(b.dataset.edit));
    });
    list.querySelectorAll('[data-delete]').forEach(b => {
      b.addEventListener('click', () => deleteEvent(b.dataset.delete));
    });
  }

  function editEvent(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;
    const form = document.getElementById('admin-form');
    form.id.value = ev.id;
    form.title.value = ev.title;
    form.start.value = ev.start;
    form.end.value = ev.end;
    form.category.value = ev.category || 'outro';
    form.notes.value = ev.notes || '';
    form.important.checked = !!ev.important;
    document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(x => x.classList.remove('active'));
    document.querySelector('[data-admin-tab="add"]').classList.add('active');
    document.querySelector('[data-admin-section="add"]').classList.add('active');
  }

  function deleteEvent(id) {
    if (!confirm('Excluir este evento?')) return;
    state.events = state.events.filter(e => e.id !== id);
    saveToStorage();
    renderAll();
  }

  function onAdminFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      id: form.id.value || `ev_${Date.now().toString(36)}`,
      title: form.title.value.trim(),
      start: form.start.value,
      end: form.end.value,
      category: form.category.value,
      notes: form.notes.value.trim(),
      important: form.important.checked,
    };
    if (!data.title || !data.start || !data.end) {
      alert('Preencha título e datas'); return;
    }
    if (parseISO(data.start) > parseISO(data.end)) {
      alert('Data de início deve ser anterior ou igual à data de fim'); return;
    }
    data.days = daysBetween(parseISO(data.start), parseISO(data.end)) + 1;

    const idx = state.events.findIndex(ev => ev.id === data.id);
    if (idx >= 0) state.events[idx] = { ...state.events[idx], ...data };
    else state.events.push(data);

    saveToStorage();
    resetForm();
    renderAll();
    document.querySelectorAll('.admin-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(x => x.classList.remove('active'));
    document.querySelector('[data-admin-tab="list"]').classList.add('active');
    document.querySelector('[data-admin-section="list"]').classList.add('active');
  }

  function resetForm() {
    const form = document.getElementById('admin-form');
    form.reset();
    form.id.value = '';
  }

  // ================= I/O =================
  function exportJSON() {
    const data = { events: state.events, exportedAt: new Date().toISOString() };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'calendario-2026.json');
  }
  function exportCSV() {
    const headers = ['id', 'title', 'start', 'end', 'days', 'category', 'important', 'notes'];
    const lines = [headers.join(',')];
    state.events.forEach(ev => {
      lines.push([
        ev.id, csvEsc(ev.title), ev.start, ev.end, ev.days || '',
        ev.category || 'outro', ev.important ? 'true' : 'false', csvEsc(ev.notes || '')
      ].join(','));
    });
    downloadBlob(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'calendario-2026.csv');
  }
  function csvEsc(s) {
    if (s == null) return '';
    s = String(s);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  function copyJSON() {
    const data = JSON.stringify({ events: state.events }, null, 2);
    navigator.clipboard.writeText(data).then(
      () => alert('JSON copiado!'),
      () => alert('Não foi possível copiar.')
    );
  }
  function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        let imported;
        if (file.name.endsWith('.json')) {
          imported = JSON.parse(text);
          if (!Array.isArray(imported.events)) throw new Error('JSON inválido');
        } else if (file.name.endsWith('.csv')) {
          imported = { events: parseCSV(text) };
        } else throw new Error('Formato não suportado');
        if (!confirm(`Importar ${imported.events.length} eventos? Isso substitui os atuais.`)) return;
        state.events = imported.events.map(ev => ({
          ...ev,
          days: ev.days || (daysBetween(parseISO(ev.start), parseISO(ev.end)) + 1),
        }));
        saveToStorage();
        renderAll();
        alert('Importação concluída!');
      } catch (err) { alert('Erro ao importar: ' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }
  function parseCSV(text) {
    const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      if (obj.important !== undefined) obj.important = obj.important === 'true';
      if (obj.days !== undefined) obj.days = obj.days ? parseInt(obj.days, 10) : undefined;
      return obj;
    });
  }
  function parseCSVLine(line) {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { result.push(cur); cur = ''; }
        else cur += c;
      }
    }
    result.push(cur);
    return result;
  }
  function resetToOriginal() {
    if (!state.originalData) { alert('Dados originais indisponíveis.'); return; }
    if (!confirm('Resetar para os dados originais? Edições serão perdidas.')) return;
    state.events = state.originalData.events.map(e => ({ ...e }));
    saveToStorage();
    renderAll();
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ----- inconsistências -----
  function renderInconsistencies() {
    const list = document.getElementById('inconsistencies-list');
    if (!state.inconsistencies || state.inconsistencies.length === 0) {
      list.innerHTML = '<li style="background: #eff7f3; border-color: #c4e3d3; color: #2f5a44;">Nenhuma inconsistência detectada.</li>';
      return;
    }
    list.innerHTML = state.inconsistencies.map(i => `
      <li>
        <strong>${i.tipo}:</strong> ${i.detalhe || ''}
        ${i.celula ? `<br><span style="font-size: 11px; opacity: 0.7;">Célula: ${i.celula}</span>` : ''}
      </li>
    `).join('');
  }

  // BOOT
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
