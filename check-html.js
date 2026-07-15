const fs = require('fs');
const html = fs.readFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Infinoos/Infinoos WMS/Produtos/infinoos-wms-novo-produto.html', 'utf-8');
const lines = html.split('\n');
const appIdx = lines.findIndex(l => l.includes('PR-VISUALIZ') || l.includes('PRÉ') || l.includes('PREVIEW') || l.includes('VISUALIZ'));
if (appIdx > -1) {
  for(let i = Math.max(0, appIdx - 15); i < Math.min(lines.length, appIdx + 15); i++) {
    console.log(lines[i].trim());
  }
}
