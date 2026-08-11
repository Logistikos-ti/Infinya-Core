const fs = require('fs');
const html = fs.readFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Infinoos/Infinoos WMS/Configurações/infinoos-wms-usuarios.html', 'utf8');

const match = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
if (!match) {
  console.log("No template found");
  process.exit(1);
}

const templateStr = JSON.parse(match[1].trim());
fs.writeFileSync('scratch_template.html', templateStr);
console.log('Wrote template');
