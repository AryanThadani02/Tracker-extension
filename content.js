// Flag to prevent multiple simultaneous captures
let isCapturing = false;

// Checks if the current domain is in the list of allowed domains
function isAllowedDomain() {
  return new Promise((resolve) => {
    const currentDomain = window.location.hostname.replace('www.', '');
    chrome.storage.sync.get(['allowedDomains'], function (result) {
      const allowedDomains = result.allowedDomains || [];
      resolve(allowedDomains.some(domain => currentDomain.includes(domain)));
    });
  });
}

// Listens for clicks and triggers screenshot capture if domain is allowed
document.addEventListener('click', async function (e) {
  if (!isCapturing && chrome.runtime?.id) {
    const allowed = await isAllowedDomain();
    if (allowed) {
      captureFullPage();
    }
  }
});

// Prepares page dimensions and sends capture request to background script
function captureFullPage() {
  try {
    isCapturing = true;

    chrome.runtime.sendMessage({
      action: "captureFullPage",
      totalHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ),
      viewportHeight: window.innerHeight,
      originalScrollTop: window.scrollY
    });
  } catch (error) {
    console.error('Error in capture:', error);
    isCapturing = false;
  }
}