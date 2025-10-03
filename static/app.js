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

function parseDepthValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = value.toString().trim();
  if (!text) {
    return null;
  }

  const normalized = text.replace(',', '.');
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function computeIntervalSize(fromValue, toValue) {
  if (Number.isFinite(fromValue) && Number.isFinite(toValue)) {
    const thickness = toValue - fromValue;
    if (thickness > 0) {
      return thickness;
    }

    if (thickness === 0) {
      return 0.5;
    }
  }

  return 1;
}

function createLithologyLog(sections) {
  const wrapper = document.createElement('div');
  wrapper.className = 'lithology-log';

  if (!sections.length) {
    const empty = document.createElement('p');
    empty.className = 'lithology-log__empty';
    empty.textContent = 'No lithological section data is available in the workbook.';
    wrapper.appendChild(empty);
    return wrapper;
  }

  const header = document.createElement('div');
  header.className = 'lithology-log__header';
  ['Depth', 'Lithology', 'Description'].forEach((label) => {
    const span = document.createElement('span');
    span.textContent = label;
    header.appendChild(span);
  });

  const content = document.createElement('div');
  content.className = 'lithology-log__content';

  const rows = document.createElement('div');
  rows.className = 'lithology-log__rows';

  const intervals = sections.map((section) => {
    const fromValue = parseDepthValue(section.from_depth);
    const toValue = parseDepthValue(section.to_depth);

    return {
      ...section,
      fromValue,
      toValue,
      size: computeIntervalSize(fromValue, toValue),
    };
  });

  const totalSize = intervals.reduce((sum, interval) => sum + interval.size, 0) || sections.length;

  intervals.forEach((interval) => {
    const symbol = inferLithologySymbol(interval.description);

    const row = document.createElement('div');
    row.className = 'lithology-log__row';
    row.style.setProperty('--interval-size', interval.size / totalSize);

    const depthCell = document.createElement('div');
    depthCell.className = 'lithology-log__cell lithology-log__cell--depth';

    const fromLabel = document.createElement('span');
    fromLabel.className = 'lithology-log__depth-value lithology-log__depth-value--from';
    fromLabel.textContent = formatDepth(interval.from_depth);
    depthCell.appendChild(fromLabel);

    const toLabel = document.createElement('span');
    toLabel.className = 'lithology-log__depth-value lithology-log__depth-value--to';
    toLabel.textContent = formatDepth(interval.to_depth);
    depthCell.appendChild(toLabel);

    row.appendChild(depthCell);

    const symbolCell = document.createElement('div');
    symbolCell.className = 'lithology-log__cell lithology-log__cell--symbol';

    const symbolLabel = document.createElement('span');
    symbolLabel.className = 'lithology-log__symbol-label';
    symbolLabel.textContent = symbol.label;
    symbolLabel.style.setProperty('--symbol-color', symbol.color);
    symbolCell.appendChild(symbolLabel);

    row.appendChild(symbolCell);

    const descriptionCell = document.createElement('div');
    descriptionCell.className = 'lithology-log__cell lithology-log__cell--description';

    const descriptionText = document.createElement('p');
    descriptionText.className = 'lithology-log__text';
    descriptionText.textContent = interval.description;
    descriptionCell.appendChild(descriptionText);

    row.appendChild(descriptionCell);

    rows.appendChild(row);
  });

  content.appendChild(rows);

  wrapper.appendChild(header);
  wrapper.appendChild(content);

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
  logTitle.className = 'lithology-log__title';
  logTitle.textContent = 'Lithology log';

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
      statusElement.textContent = 'No lithology logs are available yet.';
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
      statusElement.textContent = 'No lithology logs with interval data are available yet.';
      statusElement.classList.add('empty');
      entriesContainer.hidden = true;
      return;
    }

    entriesContainer.innerHTML = '';
    entries.forEach((entry) => {
      const card = createEntryCard(entry);
      entriesContainer.appendChild(card);
    });

    const logLabel = entries.length === 1 ? 'log' : 'logs';
    statusElement.textContent = `${entries.length} ${logLabel} with lithological data loaded.`;
    statusElement.classList.add('success');
    entriesContainer.hidden = false;
  } catch (error) {
    statusElement.classList.remove('success', 'empty');
    statusElement.textContent = `Error loading lithology sections: ${error.message}`;
    statusElement.classList.add('error');
  }
}

window.addEventListener('DOMContentLoaded', loadLithology);
