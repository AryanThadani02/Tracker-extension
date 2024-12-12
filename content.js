let isCapturing = false;

document.addEventListener('click', function (e) {
  if (!isCapturing && chrome.runtime?.id) {  // Check if extension context is valid
    captureScreen();
  }
});

function captureScreen() {
  try {
    isCapturing = true;

    // Create and add the gray flash overlay
    const flashOverlay = document.createElement('div');
    flashOverlay.style.position = 'fixed';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Gray overlay with some transparency
    flashOverlay.style.zIndex = '9999'; // Ensure it stays on top of other elements
    flashOverlay.style.pointerEvents = 'none'; // Allow clicks through the overlay

    // Apply flash animation
    flashOverlay.style.animation = 'flashAnimation 0.2s ease-in-out';

    document.body.appendChild(flashOverlay);

    html2canvas(document.body, {
      allowTaint: true,
      useCORS: true,
      logging: false,
      scale: window.devicePixelRatio,
      foreignObjectRendering: true
    }).then(function (canvas) {
      if (chrome.runtime?.id) {  // Check again before sending message
        const dataUrl = canvas.toDataURL('image/png');
        chrome.runtime.sendMessage({
          action: "download",
          dataUrl: dataUrl
        });
      }
    }).catch(function (error) {
      console.error('Capture failed:', error);
    }).finally(() => {
      isCapturing = false;
      // Remove the flash overlay after the animation
      setTimeout(() => {
        document.body.removeChild(flashOverlay);
      }, 200); // Wait for the animation to complete (200ms)
    });
  } catch (error) {
    console.error('Error in capture:', error);
    isCapturing = false;
  }
}

// Add CSS animation for the flash effect
const style = document.createElement('style');
style.innerHTML = `
  @keyframes flashAnimation {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
document.head.appendChild(style);
