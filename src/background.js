import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getAWSConfig } from '../aws-config.js';

// Listens for messages from content script to initiate screenshot capture
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.action === "captureFullPage") {
    console.log('Starting capture process...');
    captureFullPage(sender.tab.id, message);
  }
});

// Captures multiple screenshots by scrolling through the page and stores them in an array
async function captureFullPage(tabId, message) {
  console.log('captureFullPage started with:', { tabId, message });
  const { totalHeight, viewportHeight, originalScrollTop } = message;
  const images = [];

  try {
    for (let currentScroll = 0; currentScroll < totalHeight; currentScroll += viewportHeight) {
      console.log(`Capturing at scroll position: ${currentScroll}`);

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
        console.log('Successfully captured screenshot');
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

    const filename = `screenshot_${formattedDate}.png`;

    // Upload to S3
    await uploadToS3(finalBlob, filename);

  } catch (error) {
    console.error('Error in merging images:', error);
  }
}

// Modified uploadToS3 function with better feedback
async function uploadToS3(blob, filename) {
  try {
    const config = await getAWSConfig();

    // Debug log to check what values we're getting from storage
    console.log('Retrieved AWS Config:', {
      hasAccessKey: !!config.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!config.AWS_SECRET_ACCESS_KEY,
      region: config.AWS_REGION,
      bucket: config.AWS_BUCKET_NAME
    });

    // Check if any required values are missing
    const missingValues = [];
    if (!config.AWS_ACCESS_KEY_ID) missingValues.push('AWS Access Key ID');
    if (!config.AWS_SECRET_ACCESS_KEY) missingValues.push('AWS Secret Access Key');
    if (!config.AWS_BUCKET_NAME) missingValues.push('AWS Bucket Name');
    if (!config.AWS_REGION) missingValues.push('AWS Region');

    if (missingValues.length > 0) {
      throw new Error(`Missing required AWS configuration: ${missingValues.join(', ')}`);
    }

    const s3Client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      }
    });

    const command = new PutObjectCommand({
      Bucket: config.AWS_BUCKET_NAME,
      Key: filename,
      Body: blob,
      ContentType: 'image/png'
    });

    await s3Client.send(command);

    // Create S3 URL for the uploaded file
    const fileUrl = `https://${config.AWS_BUCKET_NAME}.s3.amazonaws.com/${filename}`;
    console.log('Successfully uploaded to S3');
    console.log('File URL:', fileUrl);

    // Open the S3 file in a new tab
    chrome.tabs.create({ url: fileUrl });

  } catch (error) {
    console.error('Error uploading to S3:', error.message);
  }
}