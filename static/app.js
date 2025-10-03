const statusElement = document.getElementById('status');
const entriesContainer = document.getElementById('entries');

const LITHOLOGY_SYMBOLS = [
  {
    keywords: ['glina', 'glinast', 'glinena'],
    label: 'Clay',
    color: '#b07a4a',
  },
  {
    keywords: ['pesek', 'pešč', 'peščena'],
    label: 'Sand',
    color: '#d5a651',
  },
  {
    keywords: ['melj', 'meljast'],
    label: 'Silt',
    color: '#c0bb7c',
  },
  {
    keywords: ['prod', 'prodn'],
    label: 'Gravel',
    color: '#8e7458',
  },
  {
    keywords: ['organska', 'humus', 'šota', 'šotni'],
    label: 'Organic material',
    color: '#4f6a3f',
  },
  {
    keywords: ['lapor', 'laporov'],
    label: 'Marl',
    color: '#6f7f99',
  },
];

const DEFAULT_LITHOLOGY_SYMBOL = {
  label: 'Unknown lithology',
  color: '#6b7280',
};

function inferLithologySymbol(description) {
  const text = (description || '').toString().toLowerCase();
  if (!text) {
    return DEFAULT_LITHOLOGY_SYMBOL;
  }

  for (const symbol of LITHOLOGY_SYMBOLS) {
    if (symbol.keywords.some((keyword) => text.includes(keyword))) {
      return symbol;
    }
  }

  return DEFAULT_LITHOLOGY_SYMBOL;
}

function formatDepth(value) {
  if (value === null || value === undefined) {
    return '—';
  }

  const text = String(value).trim();
  if (!text) {
    return '—';
  }

  const numericValue = Number(text);
  if (Number.isFinite(numericValue)) {
    const rounded = Number.isInteger(numericValue)
      ? numericValue.toString()
      : Number(numericValue.toFixed(2)).toString();
    return `${rounded} m`;
  }

  return text;
}

function createLithologyLog(sections) {
  const wrapper = document.createElement('div');
  wrapper.className = 'lithology-table';

  if (!sections.length) {
    const empty = document.createElement('p');
    empty.className = 'lithology-table__empty';
    empty.textContent = 'No lithological section data is available in the workbook.';
    wrapper.appendChild(empty);
    return wrapper;
  }

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'lithology-table__wrapper';

  const table = document.createElement('table');
  table.className = 'lithology-table__table';

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['From (m)', 'To (m)', 'Lithology', 'Description'].forEach((label) => {
    const cell = document.createElement('th');
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  head.appendChild(headerRow);

  const body = document.createElement('tbody');
  sections.forEach((section) => {
    const symbol = inferLithologySymbol(section.description);
    const row = document.createElement('tr');

    const fromCell = document.createElement('td');
    fromCell.textContent = formatDepth(section.from_depth);
    row.appendChild(fromCell);

    const toCell = document.createElement('td');
    toCell.textContent = formatDepth(section.to_depth);
    row.appendChild(toCell);

    const symbolCell = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'lithology-table__chip';
    chip.textContent = symbol.label;
    chip.style.setProperty('--chip-color', symbol.color);
    symbolCell.appendChild(chip);
    row.appendChild(symbolCell);

    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = section.description;
    row.appendChild(descriptionCell);

    body.appendChild(row);
  });

  table.appendChild(head);
  table.appendChild(body);
  tableWrapper.appendChild(table);
  wrapper.appendChild(tableWrapper);

  return wrapper;
}

function createEntryCard(entry) {
  const card = document.createElement('article');
  card.className = 'entry-card';

  const header = document.createElement('div');
  header.className = 'entry-card__header';

  const title = document.createElement('h2');
  title.className = 'entry-card__title';
  title.textContent = entry.title;
  header.appendChild(title);

  const badge = document.createElement('span');
  badge.className = 'entry-card__badge';
  badge.textContent = entry.tab_name;
  header.appendChild(badge);

  const description = document.createElement('p');
  description.className = 'entry-card__description';
  description.textContent = entry.description;

  const link = document.createElement('a');
  link.className = 'entry-card__link';
  link.href = `/pdfs/${encodeURIComponent(entry.pdf_filename)}`;
  link.textContent = 'Open PDF';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const logTitle = document.createElement('h3');
  logTitle.className = 'lithology-table__title';
  logTitle.textContent = 'Lithology intervals';

  const sections = Array.isArray(entry.sections) ? entry.sections : [];
  const log = createLithologyLog(sections);

  card.appendChild(header);
  card.appendChild(description);
  card.appendChild(link);
  card.appendChild(logTitle);
  card.appendChild(log);

  return card;
}

async function loadLithology() {
  try {
    const response = await fetch('/api/lithology');
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      statusElement.classList.remove('success', 'error');
      statusElement.textContent = 'No lithology entries are available yet.';
      statusElement.classList.add('empty');
      entriesContainer.hidden = true;
      return;
    }

    statusElement.classList.remove('empty', 'error', 'success');

    const entries = payload
      .map((entry) => ({
        ...entry,
        sections: Array.isArray(entry.sections)
          ? entry.sections.filter((section) =>
              Boolean(
                (section.description || '').toString().trim() ||
                  section.from_depth ||
                  section.to_depth,
              ),
            )
          : [],
      }))
      .filter((entry) => entry.sections.length > 0);

    if (entries.length === 0) {
      statusElement.classList.remove('success', 'error');
      statusElement.textContent = 'No lithology tables with interval data are available yet.';
      statusElement.classList.add('empty');
      entriesContainer.hidden = true;
      return;
    }

    entriesContainer.innerHTML = '';
    entries.forEach((entry) => {
      const card = createEntryCard(entry);
      entriesContainer.appendChild(card);
    });

    const entryLabel = entries.length === 1 ? 'entry' : 'entries';
    statusElement.textContent = `${entries.length} ${entryLabel} with lithological tables loaded.`;
    statusElement.classList.add('success');
    entriesContainer.hidden = false;
  } catch (error) {
    statusElement.classList.remove('success', 'empty');
    statusElement.textContent = `Error loading lithology tables: ${error.message}`;
    statusElement.classList.add('error');
  }
}

window.addEventListener('DOMContentLoaded', loadLithology);
