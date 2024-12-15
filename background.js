// Listens for messages from content script to initiate screenshot capture
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureFullPage") {
    captureFullPage(sender.tab.id, message);
  }
});

// Captures multiple screenshots by scrolling through the page and stores them in an array
async function captureFullPage(tabId, message) {
  const { totalHeight, viewportHeight, originalScrollTop } = message;
  const images = [];

  try {
    for (let currentScroll = 0; currentScroll < totalHeight; currentScroll += viewportHeight) {
      await chrome.scripting.executeScript({
        target: { tabId },
        function: (yPos) => window.scrollTo(0, yPos),
        args: [currentScroll]
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: 'png',
          quality: 100
        });
        images.push(dataUrl);
      } catch (error) {
        console.error('Capture error:', error);
        if (error.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryDataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
          });
          images.push(retryDataUrl);
        }
      }
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      function: (yPos) => window.scrollTo(0, yPos),
      args: [originalScrollTop]
    });

    await mergeAndDownload(images);
  } catch (error) {
    console.error('Error in capture process:', error);
  }
}

// Merges multiple screenshots into one image and downloads it with a timestamp filename
async function mergeAndDownload(images) {
  if (!images.length) {
    console.error('No images to merge');
    return;
  }

  try {
    // Convert base64 to blob
    const fetchImage = async (dataUrl) => {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return createImageBitmap(blob);
    };

    // Load all images as ImageBitmap
    const imageBitmaps = await Promise.all(images.map(fetchImage));

    // Calculate dimensions
    const totalHeight = imageBitmaps.reduce((sum, img) => sum + img.height, 0);
    const width = imageBitmaps[0].width;

    // Create canvas
    const canvas = new OffscreenCanvas(width, totalHeight);
    const ctx = canvas.getContext('2d');

    // Draw images
    let yOffset = 0;
    imageBitmaps.forEach(bitmap => {
      ctx.drawImage(bitmap, 0, yOffset);
      yOffset += bitmap.height;
      bitmap.close(); // Clean up
    });

    // Get formatted date
    const date = new Date();
    const formattedDate = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[/:,\s]/g, '-');

    // Convert to blob and download
    const finalBlob = await canvas.convertToBlob({
      type: 'image/png',
      quality: 1
    });

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(finalBlob);
    reader.onloadend = function () {
      const base64data = reader.result;
      chrome.downloads.download({
        url: base64data,
        filename: `screenshot_${formattedDate}.png`
      });
    };

  } catch (error) {
    console.error('Error in merging images:', error);
  }
}