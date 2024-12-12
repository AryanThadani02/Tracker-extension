// background.js
let pendingDownloads = new Set();

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}_${d.getMilliseconds()}`;
}

// Ensure valid characters for filenames
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download") {
    const timestamp = getTimestamp();
    let filename = `Screenshot_${timestamp}.png`;

    // Ensure the filename is sanitized to avoid issues with special characters
    filename = sanitizeFilename(filename);

    console.log(`Attempting to download with filename: ${filename}`);

    chrome.downloads.download({
      url: request.dataUrl,
      conflictAction: 'overwrite',
      filename: 'screenshot.png',  // Temporary filename
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError.message);
      } else {
        console.log(`Download successful with ID: ${downloadId}`);
        pendingDownloads.add(downloadId);
      }
    });
  }
  return true;
});

// Suggest the correct filename
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  if (pendingDownloads.has(downloadItem.id)) {
    const timestamp = getTimestamp();
    let filename = `Screenshot_${timestamp}.png`;
    filename = sanitizeFilename(filename);

    suggest({
      filename: `screenshots/${filename}`,
      conflictAction: 'uniquify'
    });

    pendingDownloads.delete(downloadItem.id);
    return true; // Indicate that we are using the suggest function
  }
});