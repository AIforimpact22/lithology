const statusElement = document.getElementById('status');
const entriesContainer = document.getElementById('entries');

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

function createSectionTable(sections) {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-table__wrapper';

  const table = document.createElement('table');
  table.className = 'section-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['From (m)', 'To (m)', 'Description'].forEach((label) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  if (!sections.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 3;
    emptyCell.className = 'section-table__empty';
    emptyCell.textContent = 'No lithological section data is available in the workbook.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    sections.forEach((section) => {
      const row = document.createElement('tr');

      const fromCell = document.createElement('td');
      fromCell.textContent = formatDepth(section.from_depth);
      row.appendChild(fromCell);

      const toCell = document.createElement('td');
      toCell.textContent = formatDepth(section.to_depth);
      row.appendChild(toCell);

      const descriptionCell = document.createElement('td');
      descriptionCell.textContent = section.description;
      row.appendChild(descriptionCell);

      tbody.appendChild(row);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  wrapper.appendChild(table);

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

  const tableTitle = document.createElement('h3');
  tableTitle.className = 'section-table__title';
  tableTitle.textContent = 'Lithological Sections';

  const sections = Array.isArray(entry.sections) ? entry.sections : [];
  const table = createSectionTable(sections);

  card.appendChild(header);
  card.appendChild(description);
  card.appendChild(link);
  card.appendChild(tableTitle);
  card.appendChild(table);

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
