async function getAWSConfig() {
  const config = await chrome.storage.local.get([
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_BUCKET_NAME'
  ]);
  return config;
}

export { getAWSConfig };