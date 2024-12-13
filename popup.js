document.addEventListener('DOMContentLoaded', function () {
  loadDomains();

  document.getElementById('addDomain').addEventListener('click', addDomain);
  document.getElementById('domainInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addDomain();
  });
});

function loadDomains() {
  chrome.storage.sync.get(['allowedDomains'], function (result) {
    const domains = result.allowedDomains || [];
    updateDomainList(domains);
  });
}

function addDomain() {
  const input = document.getElementById('domainInput');
  let domain = input.value.trim().toLowerCase();

  // Basic domain validation
  if (!domain) return;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    domain = new URL(domain).hostname;
  }
  domain = domain.replace('www.', '');

  chrome.storage.sync.get(['allowedDomains'], function (result) {
    const domains = result.allowedDomains || [];
    if (!domains.includes(domain)) {
      domains.push(domain);
      chrome.storage.sync.set({ allowedDomains: domains }, function () {
        updateDomainList(domains);
        input.value = '';
      });
    }
  });
}

function removeDomain(domain) {
  chrome.storage.sync.get(['allowedDomains'], function (result) {
    const domains = result.allowedDomains || [];
    const updatedDomains = domains.filter(d => d !== domain);
    chrome.storage.sync.set({ allowedDomains: updatedDomains }, function () {
      updateDomainList(updatedDomains);
    });
  });
}

function updateDomainList(domains) {
  const list = document.getElementById('domainList');
  list.innerHTML = '';

  domains.forEach(domain => {
    const div = document.createElement('div');
    div.className = 'domain-item';
    div.innerHTML = `
          <span>${domain}</span>
          <span class="material-icons delete-icon">delete</span>
      `;

    div.querySelector('.delete-icon').addEventListener('click', () => removeDomain(domain));
    list.appendChild(div);
  });
}
