const fs = require('fs');
let t = fs.readFileSync('src/components/expedicao/expedicao-client.tsx', 'utf8');

const regex = /<div style=\{\{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid \$\{t\.border \}`, flexWrap: "wrap", gap: "12px"\}\}>\s*<span style=\{\{fontSize: "13px", color: `\$\{t\.textSub \}`\}\}>Mostrando.*?<\/div>\s*<\/div>/s;

const newBottomUI = `<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: \`1px solid \${t.border }\`, flexWrap: "wrap", gap: "12px"}}>
          <span style={{fontSize: "13px", color: \`\${t.textSub }\`}}>Mostrando {filteredDataOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredDataOrders.length)} de {filteredDataOrders.length} pedidos</span>
          <div style={{display: "flex", gap: "6px"}}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{width: "34px", height: "34px", borderRadius: "8px", border: \`1px solid \${t.border }\`, background: \`\${t.inputBg }\`, color: currentPage === 1 ? 'rgba(100,116,139,0.3)' : \`\${t.textSub }\`, cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: "13px"}}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((pageNum, index, arr) => {
                const isCurr = pageNum === currentPage;
                const prev = arr[index - 1];
                return (
                  <React.Fragment key={pageNum}>
                    {prev && pageNum - prev > 1 && <span style={{display: "inline-flex", alignItems: "flex-end", padding: "0 4px", color: t.textSub}}>...</span>}
                    <button onClick={() => setCurrentPage(pageNum)} style={{width: "34px", height: "34px", borderRadius: "8px", border: isCurr ? "none" : \`1px solid \${t.border }\`, background: isCurr ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : \`\${t.inputBg }\`, color: isCurr ? "#fff" : \`\${t.text }\`, cursor: "pointer", fontSize: "13px", fontWeight: isCurr ? "700" : "500"}}>{pageNum}</button>
                  </React.Fragment>
                );
              })
            }
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{width: "34px", height: "34px", borderRadius: "8px", border: \`1px solid \${t.border }\`, background: \`\${t.inputBg }\`, color: currentPage === totalPages ? 'rgba(100,116,139,0.3)' : \`\${t.textSub }\`, cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: "13px"}}>›</button>
          </div>
        </div>`;

t = t.replace(regex, newBottomUI);

fs.writeFileSync('src/components/expedicao/expedicao-client.tsx', t, 'utf8');
console.log("Pagination UI replaced!");
