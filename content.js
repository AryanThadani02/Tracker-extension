let isCapturing = false;

function isAllowedDomain() {
  return new Promise((resolve) => {
    const currentDomain = window.location.hostname.replace('www.', '');
    chrome.storage.sync.get(['allowedDomains'], function (result) {
      const allowedDomains = result.allowedDomains || [];
      resolve(allowedDomains.some(domain => currentDomain.includes(domain)));
    });
  });
}

document.addEventListener('click', async function (e) {
  if (!isCapturing && chrome.runtime?.id) {
    const allowed = await isAllowedDomain();
    if (allowed) {
      captureFullPage();
    }
  }
});

function captureFullPage() {
  try {
    isCapturing = true;

    // Send message to background script to initiate capture
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