const fs = require('fs');
const path = require('path');
const p = path.join('src', 'components', 'expedicao', 'expedicao-client.tsx');
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('uploadModalOpen')) {
  console.log('Wait, uploadModalOpen is NOT defined. Injecting...');
}

const lines = c.split('\n');
const insertIndex = lines.findIndex(l => l.includes('const [activeTab, setActiveTab] = useState("orders");'));

if (insertIndex !== -1 && !c.includes('setUploadModalOpen] = useState')) {
  lines.splice(insertIndex + 1, 0, `  const [uploadModalOpen, setUploadModalOpen] = useState<{ open: boolean; type: "NF" | "ETIQUETA" }>({ open: false, type: "NF" });`);
  fs.writeFileSync(p, lines.join('\n'));
  console.log('Injected state!');
} else {
  console.log('Could not find activeTab state or already injected.');
}
