import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY não configurada.");
    resendInstance = new Resend(key);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "financeiro@infinoos.com.br";
const FROM_NAME = process.env.RESEND_FROM_NAME ?? "Infinoos WMS";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMesAno(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[Number(month) - 1]} ${year}`;
}

type FaturaEmailData = {
  depositanteNome: string;
  mesAno: string;
  totalServicos: number;
  totalDescontos: number;
  totalAPagar: number;
  boletoUrl: string | null;
  nfUrl: string | null;
  portalUrl?: string;
};

export async function enviarEmailFatura(
  to: string[],
  fatura: FaturaEmailData,
): Promise<{ success: boolean; error?: string }> {
  if (to.length === 0) {
    return { success: false, error: "Nenhum destinatário informado." };
  }

  const resend = getResend();
  const mesFormatado = formatMesAno(fatura.mesAno);
  const subject = `Fatura ${mesFormatado} — ${fatura.depositanteNome}`;

  const links: string[] = [];
  if (fatura.boletoUrl) links.push(`<a href="${fatura.boletoUrl}" style="color:#0891b2;">Baixar Boleto</a>`);
  if (fatura.nfUrl) links.push(`<a href="${fatura.nfUrl}" style="color:#0891b2;">Baixar Nota Fiscal</a>`);
  if (fatura.portalUrl) links.push(`<a href="${fatura.portalUrl}" style="color:#0891b2;">Ver no Portal</a>`);

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;color:#0f172a;font-size:20px;">Infinoos WMS</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Fatura de Serviços</p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Depositante</p>
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;font-weight:600;">${fatura.depositanteNome}</p>

        <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Competência</p>
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;font-weight:600;">${mesFormatado}</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;">Total Serviços</td>
            <td style="padding:6px 0;text-align:right;color:#0f172a;font-weight:500;">${formatCurrency(fatura.totalServicos)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Descontos</td>
            <td style="padding:6px 0;text-align:right;color:#dc2626;font-weight:500;">- ${formatCurrency(fatura.totalDescontos)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:10px 0;color:#059669;font-weight:700;font-size:15px;">Total a Pagar</td>
            <td style="padding:10px 0;text-align:right;color:#059669;font-weight:700;font-size:15px;">${formatCurrency(fatura.totalAPagar)}</td>
          </tr>
        </table>
      </div>

      ${links.length > 0 ? `
        <div style="text-align:center;margin-bottom:20px;">
          <p style="color:#64748b;font-size:12px;margin:0 0 8px;">Documentos</p>
          ${links.join(" &nbsp;·&nbsp; ")}
        </div>
      ` : ""}

      <p style="text-align:center;color:#94a3b8;font-size:11px;margin:24px 0 0;">
        E-mail enviado automaticamente pelo Infinoos WMS.
      </p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
