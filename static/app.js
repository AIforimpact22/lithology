const statusElement = document.getElementById('status');
const tableWrapper = document.querySelector('.table-wrapper');
const tableBody = document.querySelector('#lithology-table tbody');

function createLinkCell(entry) {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = `/pdfs/${encodeURIComponent(entry.pdf_filename)}`;
  link.textContent = 'View PDF';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  cell.appendChild(link);
  return cell;
}

function createTextCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

async function loadLithology() {
  try {
    const response = await fetch('/api/lithology');
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const entries = await response.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      statusElement.textContent = 'No lithology sections are available yet.';
      statusElement.classList.add('empty');
      return;
    }

    tableBody.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.appendChild(createTextCell(entry.tab_name));
      row.appendChild(createTextCell(entry.title));
      row.appendChild(createTextCell(entry.description));
      row.appendChild(createLinkCell(entry));
      tableBody.appendChild(row);
    });

    statusElement.textContent = `${entries.length} lithology section${entries.length === 1 ? '' : 's'} loaded.`;
    statusElement.classList.add('success');
    tableWrapper.hidden = false;
  } catch (error) {
    statusElement.textContent = `Error loading lithology sections: ${error.message}`;
    statusElement.classList.add('error');
  }
}

window.addEventListener('DOMContentLoaded', loadLithology);
