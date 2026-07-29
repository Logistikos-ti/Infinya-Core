const fs = require('fs');
const path = require('path');
const p = path.join('src', 'components', 'shipping', 'shipping-attachment-preview-dialog.tsx');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `  printLabel?: string;\n  downloadLabel?: string;\n};`,
  `  printLabel?: string;\n  downloadLabel?: string;\n  customTrigger?: (openPreview: () => void) => React.ReactNode;\n};`
);

c = c.replace(
  `}: ShippingAttachmentPreviewDialogProps) {`,
  `  customTrigger,\n}: ShippingAttachmentPreviewDialogProps) {`
);

c = c.replace(
  `    <>\n      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">`,
  `    <>\n      {customTrigger ? customTrigger(openPreview) : (\n      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">`
);

c = c.replace(
  `        </a>\n      </div>\n\n      {open`,
  `        </a>\n      </div>\n      )}\n\n      {open`
);

fs.writeFileSync(p, c);
console.log('Patched shipping-attachment-preview-dialog.tsx');
