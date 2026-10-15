import fs from 'node:fs';
import https from 'node:https';

// Test single Wikimedia API query
const fileName = "File:Charlotte,_North_Carolina_Night_Drone_Footage_2019.webm";
const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|size|mime|sha1&format=json`;

https.get(apiUrl, {
  headers: {
    'User-Agent': 'FormaMediaChecker/1.0 (https://github.com/forma; contact@example.com) UserAgentCompliance'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    const pages = parsed.query?.pages;
    console.log('Pages:', JSON.stringify(pages, null, 2));
  });
}).on('error', err => {
  console.error('Error:', err.message);
});
