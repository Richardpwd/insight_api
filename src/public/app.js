// =============================================
// Contract Insight API — Interface Web
// =============================================

// --- API Key ---

function getApiKey() {
  return sessionStorage.getItem('ci_api_key') || '';
}

const apiKeyInput = document.getElementById('api-key-input');
apiKeyInput.value = getApiKey();

apiKeyInput.addEventListener('input', () => {
  sessionStorage.setItem('ci_api_key', apiKeyInput.value.trim());
});

// --- Tabs ---

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// --- File drop ---

const fileDrop = document.getElementById('file-drop');
const pdfFileInput = document.getElementById('pdf-file');
const fileNameDisplay = document.getElementById('file-name-display');

fileDrop.addEventListener('click', () => pdfFileInput.click());

fileDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDrop.classList.add('drag-over');
});

fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));

fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    pdfFileInput.files = dt.files;
    setFileName(file.name);
  }
});

pdfFileInput.addEventListener('change', () => {
  if (pdfFileInput.files[0]) setFileName(pdfFileInput.files[0].name);
});

function setFileName(name) {
  fileNameDisplay.textContent = name;
  fileDrop.querySelector('.file-drop-text').textContent = name;
}

// --- Formulario de texto ---

document.getElementById('text-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contractText = document.getElementById('contract-text').value;
  const contractType = document.getElementById('contract-type-text').value || undefined;

  setLoadingText(true);
  try {
    const res = await fetch('/contracts/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
      body: JSON.stringify({ contractText, contractType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao analisar contrato.');
    renderResult(data);
    loadHistory();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoadingText(false);
  }
});

// --- Formulario de PDF ---

document.getElementById('pdf-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = pdfFileInput.files[0];
  if (!file) { showError('Selecione um arquivo PDF antes de enviar.'); return; }

  const contractType = document.getElementById('contract-type-pdf').value || undefined;
  const formData = new FormData();
  formData.append('file', file);
  if (contractType) formData.append('contractType', contractType);

  setLoadingPdf(true);
  try {
    const res = await fetch('/contracts/analyze/pdf', {
      method: 'POST',
      headers: { 'x-api-key': getApiKey() },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao analisar PDF.');
    renderResult(data);
    loadHistory();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoadingPdf(false);
  }
});

function setLoadingText(state) {
  const btn = document.getElementById('analyze-btn-text');
  btn.textContent = state ? 'Analisando...' : 'Analisar contrato';
  btn.disabled = state;
}

function setLoadingPdf(state) {
  const btn = document.getElementById('analyze-btn-pdf');
  btn.textContent = state ? 'Analisando...' : 'Analisar PDF';
  btn.disabled = state;
}

// --- Renderizacao do resultado ---

function riskColor(level) {
  const map = { baixo: '#1f7a5a', medio: '#c97d1a', alto: '#c96f2d', critico: '#9b1c2a' };
  return map[level] || '#665b54';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(msg) {
  const section = document.getElementById('result-section');
  section.innerHTML = `<div class="result-error"><strong>Erro:</strong> ${escapeHtml(msg)}</div>`;
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth' });
}

function renderResult(data) {
  const { summary, missingFields, criticalClauses, risks, recommendations } = data;
  const color = riskColor(summary.riskLevel);

  let html = `
    <div class="result-header">
      <div class="score-dial" style="--pct:${summary.riskScore}%; --dial-color:${color}">
        <span class="score-number">${summary.riskScore}</span>
        <span class="score-unit">/ 100</span>
      </div>
      <div class="result-meta">
        <span class="card-label">Resultado da analise</span>
        <h2 class="result-type">${escapeHtml(summary.contractType)}</h2>
        <span class="risk-badge" style="--badge-color:${color}">${summary.riskLevel.toUpperCase()}</span>
        <p class="exec-summary">${escapeHtml(summary.executiveSummary)}</p>
      </div>
    </div>`;

  if (missingFields.length) {
    html += `
    <div class="result-block">
      <span class="card-label">Campos ausentes</span>
      <ul class="tag-list">
        ${missingFields.map((f) => `<li class="tag">${escapeHtml(f)}</li>`).join('')}
      </ul>
    </div>`;
  }

  if (criticalClauses.length) {
    html += `
    <div class="result-block">
      <span class="card-label">Clausulas criticas identificadas</span>
      <div class="clause-grid">
        ${criticalClauses
          .map(
            (c) => `
          <div class="clause-card">
            <div class="clause-top">
              <strong>${escapeHtml(c.type)}</strong>
              <span class="sev-badge sev-${c.severity}">${c.severity}</span>
            </div>
            <p>${escapeHtml(c.description)}</p>
          </div>`
          )
          .join('')}
      </div>
    </div>`;
  }

  if (risks.length) {
    html += `
    <div class="result-block">
      <span class="card-label">Riscos encontrados</span>
      <ul class="risk-list">
        ${risks
          .map(
            (r) => `
          <li class="risk-item">
            <strong>${escapeHtml(r.risk)}</strong>
            <p>${escapeHtml(r.recommendation)}</p>
          </li>`
          )
          .join('')}
      </ul>
    </div>`;
  }

  if (recommendations.length) {
    html += `
    <div class="result-block">
      <span class="card-label">Recomendacoes</span>
      <ul class="rec-list">
        ${recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>`;
  }

  const section = document.getElementById('result-section');
  section.innerHTML = html;
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth' });
}

// --- Historico ---

async function loadHistory() {
  try {
    const res = await fetch('/contracts/history', {
      headers: { 'x-api-key': getApiKey() },
    });
    if (!res.ok) return;
    const { history } = await res.json();
    renderHistory(history);
  } catch (_) {}
}

function renderHistory(history) {
  const section = document.getElementById('history-section');
  if (!history || !history.length) { section.hidden = true; return; }

  section.hidden = false;
  const rows = history
    .map((h) => {
      const color = riskColor(h.riskLevel);
      return `
        <tr>
          <td>${h.id}</td>
          <td>${new Date(h.timestamp).toLocaleString('pt-BR')}</td>
          <td>${escapeHtml(h.contractType)}</td>
          <td>${h.source === 'pdf' ? escapeHtml(h.fileName || 'PDF') : 'texto'}</td>
          <td><span class="risk-badge-sm" style="--badge-color:${color}">${h.riskLevel} (${h.riskScore})</span></td>
        </tr>`;
    })
    .join('');

  document.getElementById('history-tbody').innerHTML = rows;
}

// Carrega o historico ao abrir a pagina.
loadHistory();
