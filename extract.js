const fs = require('fs');
const content = fs.readFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Infinoos/Infinoos WMS/Expedição/infinoos-wms-conferencia.html', 'utf-8');
const searchStr = '<script type="__bundler/template">\n';
const startIdx = content.indexOf(searchStr);
if (startIdx > -1) {
  const jsonStart = startIdx + searchStr.length;
  const jsonEnd = content.indexOf('\n  </script>', jsonStart);
  const jsonStr = content.slice(jsonStart, jsonEnd).trim();
  fs.writeFileSync('template.html', JSON.parse(jsonStr), 'utf-8');
  console.log('Extracted template!');
}
