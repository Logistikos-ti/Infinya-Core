const fs = require('fs');
const path = require('path');

const extractHTML = (filename) => {
  const filePath = path.join('C:\\Users\\admin\\OneDrive\\Desktop\\Claude\\Infinoos\\Infinoos WMS\\Expedição', filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const templateRegex = /<script type="__bundler\/template">(.*?)<\/script>/s;
  const match = content.match(templateRegex);

  if (match) {
    let template = match[1];
    template = JSON.parse(template);
    fs.writeFileSync(`extracted_${filename}`, template, 'utf8');
    console.log(`Extracted template to extracted_${filename}`);
  } else {
    console.log(`No template found in ${filename}`);
  }
};

extractHTML('infinoos-wms-expedicao.html');
extractHTML('infinoos-wms-pedidos.html');
