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
      captureScreen();
    }
  }
});

function captureScreen() {
  try {
    isCapturing = true;
    const isYoutube = window.location.hostname.includes('youtube.com');

    html2canvas(document.body, {
      allowTaint: true,
      useCORS: true,
      logging: false,
      scale: 1,
      foreignObjectRendering: isYoutube, // true for YouTube, false for others
      backgroundColor: null,
      removeContainer: true,
      imageTimeout: 0,
      onclone: (doc) => {
        // Only remove video elements, keep iframes for YouTube
        const elementsToRemove = doc.querySelectorAll('video, canvas');
        elementsToRemove.forEach(el => el.remove());
      }
    }).then(function (canvas) {
      if (chrome.runtime?.id) {
        const dataUrl = canvas.toDataURL('image/png', 0.8);
        chrome.runtime.sendMessage({
          action: "download",
          dataUrl: dataUrl
        });
      }
    }).catch(function (error) {
      console.error('Capture failed:', error);
    }).finally(() => {
      isCapturing = false;
    });
  } catch (error) {
    console.error('Error in capture:', error);
    isCapturing = false;
  }
}