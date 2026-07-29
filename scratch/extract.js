const fs = require('fs');
const txt = fs.readFileSync('scratch/html-scripts.txt', 'utf8');

// Find the start of the <div...
const start = txt.indexOf('<div');
const end = txt.lastIndexOf('<\\u002Fx-dc>');

if (start !== -1 && end !== -1) {
  let slice = txt.substring(start, end);
  slice = slice.replace(/\\n/g, '\n').replace(/\\\"/g, '"').replace(/<\\u002F/g, '</');
  fs.writeFileSync('scratch/romaneio-xdc.html', slice);
  console.log('Saved to scratch/romaneio-xdc.html');
} else {
  console.log('Not found', start, end);
}
