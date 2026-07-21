const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\admin\\OneDrive\\Desktop\\Claude\\Infinoos\\Infinoos WMS\\Expedição\\infinoos-wms-pedidos.html', 'utf8');

// Find the template script
const templateRegex = /<script type="__bundler\/template">(.*?)<\/script>/s;
const match = content.match(templateRegex);

if (match) {
  let template = match[1];
  // Parse JSON
  template = JSON.parse(template);
  // Write to a temporary file
  fs.writeFileSync('extracted_template.html', template, 'utf8');
  console.log("Template extracted and saved to extracted_template.html");
} else {
  console.log("No template found.");
}
