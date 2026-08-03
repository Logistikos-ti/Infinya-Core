from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.units import mm
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "manual-integracoes-infinoos-wms.pdf"
BRANDING = ROOT / "public" / "branding"
INTEGRATIONS = ROOT / "public" / "integrations"

W, H = A4
M = 18 * mm
NAVY = HexColor("#0B1430")
INK = HexColor("#17213A")
MUTED = HexColor("#64748B")
LIGHT = HexColor("#F4F7FC")
BORDER = HexColor("#DEE6F2")
BLUE = HexColor("#3B82F6")
VIOLET = HexColor("#8257F6")
GREEN = HexColor("#10B981")

pdfmetrics.registerFont(TTFont("Inter", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("InterBold", r"C:\Windows\Fonts\arialbd.ttf"))


def text(c, value, x, y, size=10, color=INK, bold=False):
    c.setFillColor(color)
    c.setFont("InterBold" if bold else "Inter", size)
    c.drawString(x, y, value)


def wrapped(c, value, x, y, width, size=10, color=MUTED, leading=15, bold=False):
    words = value.split()
    line = ""
    cursor = y
    for word in words:
        proposal = word if not line else f"{line} {word}"
        c.setFont("InterBold" if bold else "Inter", size)
        if c.stringWidth(proposal, "InterBold" if bold else "Inter", size) <= width:
            line = proposal
        else:
            text(c, line, x, cursor, size, color, bold)
            cursor -= leading
            line = word
    if line:
        text(c, line, x, cursor, size, color, bold)
        cursor -= leading
    return cursor


def rounded(c, x, y, w, h, fill, stroke=None, radius=10):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)


def rounded_image(c, image, x, y, w, h, radius=4 * mm):
    """Render provider artwork clipped to a rounded-square tile."""
    c.saveState()
    path = c.beginPath()
    path.roundRect(x, y, w, h, radius)
    c.clipPath(path, stroke=0, fill=0)
    c.drawImage(ImageReader(str(image)), x, y, width=w, height=h, mask="auto")
    c.restoreState()


def header(c, page):
    c.setFillColor(NAVY)
    c.rect(0, H - 42 * mm, W, 42 * mm, stroke=0, fill=1)
    logo = BRANDING / "infinoos-lockup-wms-house.png"
    c.drawImage(ImageReader(str(logo)), M, H - 29 * mm, width=51 * mm, height=19 * mm, mask="auto", preserveAspectRatio=True, anchor="sw")
    text(c, "MANUAL DO DEPOSITANTE", W - M - 63 * mm, H - 18 * mm, 8, HexColor("#AFBCE0"), True)
    text(c, "Integrações", W - M - 63 * mm, H - 28 * mm, 17, white, True)
    text(c, f"Infinoos WMS  |  {page}/2", W - M - 63 * mm, H - 36 * mm, 8, HexColor("#AFBCE0"))


def provider_card(c, x, y, title, logo, description, benefit):
    rounded(c, x, y, 81 * mm, 68 * mm, white, BORDER)
    rounded_image(c, logo, x + 6 * mm, y + 51 * mm, 14 * mm, 14 * mm)
    text(c, title, x + 23 * mm, y + 57 * mm, 13, INK, True)
    text(c, "R$ 49,90/mês", x + 6 * mm, y + 42 * mm, 12, VIOLET, True)
    text(c, "Cobrança na próxima fatura após conectar.", x + 6 * mm, y + 35 * mm, 7.5, MUTED)
    wrapped(c, description, x + 6 * mm, y + 27 * mm, 69 * mm, 8.4, MUTED, 11)
    text(c, "Ganho operacional", x + 6 * mm, y + 17 * mm, 8, GREEN, True)
    wrapped(c, benefit, x + 6 * mm, y + 10 * mm, 69 * mm, 7.5, MUTED, 9)


def footer(c, page):
    c.setStrokeColor(BORDER)
    c.line(M, 13 * mm, W - M, 13 * mm)
    text(c, "Infinoos WMS - integrações por depositante", M, 8 * mm, 7.5, MUTED)
    text(c, f"Página {page} de 2", W - M - 25 * mm, 8 * mm, 7.5, MUTED)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = Canvas(str(OUTPUT), pagesize=A4)
    c.setTitle("Manual de Integrações - Infinoos WMS")
    c.setAuthor("Infinoos WMS")

    header(c, 1)
    text(c, "Como funciona", M, H - 57 * mm, 22, INK, True)
    wrapped(c, "A aba Integrações permite conectar as contas comerciais da sua operação ao Infinoos WMS com autorização segura. Nesta fase, o recurso está disponível para depositantes habilitados pela operação.", M, H - 66 * mm, 160 * mm, 10, MUTED, 15)
    provider_card(c, M, H - 149 * mm, "Bling", INTEGRATIONS / "bling.png", "Importa pedidos e acompanha a operação comercial conectada ao ERP.", "Menos digitação e pedidos chegam mais rápido à separação.")
    provider_card(c, M + 87 * mm, H - 149 * mm, "Mercado Livre", INTEGRATIONS / "mercado-livre.png", "Conecta pedidos, etiquetas e rastreamento da sua conta de vendedor.", "Menos conferências manuais no preparo e despacho.")
    note_x, note_y, note_w, note_h = M, H - 180 * mm, 174 * mm, 22 * mm
    rounded(c, note_x, note_y, note_w, note_h, HexColor("#EEF6FF"), HexColor("#CAE2FF"))
    c.setStrokeColor(HexColor("#CAE2FF"))
    c.line(note_x + 34 * mm, note_y + 5 * mm, note_x + 34 * mm, note_y + note_h - 5 * mm)
    c.setFillColor(BLUE)
    c.setFont("InterBold", 10)
    c.drawCentredString(note_x + 17 * mm, note_y + 10 * mm, "Importante")
    wrapped(c, "Cada conexão pertence somente ao seu depositante. Credenciais e tokens não são exibidos no Portal e não ficam acessíveis a outras operações.", note_x + 40 * mm, note_y + 14 * mm, 126 * mm, 8.5, MUTED, 11)
    footer(c, 1)
    c.showPage()

    header(c, 2)
    text(c, "Conectar uma integração", M, H - 57 * mm, 22, INK, True)
    steps = [
        ("1", "Acesse o Portal", "No menu lateral, abra Integrações."),
        ("2", "Escolha o canal", "Clique em Conectar Bling ou Conectar Mercado Livre."),
        ("3", "Autorize a conta", "Faça login na conta correta da sua operação e confirme as permissões solicitadas."),
        ("4", "Retorne ao WMS", "Após a autorização, o Portal mostra a integração como Conectada e identifica a conta vinculada."),
    ]
    y = H - 76 * mm
    for n, title, body in steps:
        rounded(c, M, y - 14 * mm, 174 * mm, 18 * mm, white, BORDER)
        rounded(c, M + 5 * mm, y - 10 * mm, 9 * mm, 9 * mm, HexColor("#EEF2FF"))
        c.setFillColor(VIOLET)
        c.setFont("InterBold", 8)
        # The Arial numeral glyphs have asymmetric side bearings; this positions
        # each numeral by its visible shape, centered within the 9 mm marker.
        c.drawCentredString(M + 10.35 * mm, y - 7.55 * mm, n)
        text(c, title, M + 20 * mm, y - 4.5 * mm, 10, INK, True)
        text(c, body, M + 20 * mm, y - 10 * mm, 8.5, MUTED)
        y -= 23 * mm

    rounded(c, M, 57 * mm, 174 * mm, 38 * mm, HexColor("#FFF9E9"), HexColor("#FDE7A7"))
    text(c, "Antes de conectar", M + 6 * mm, 84 * mm, 11, HexColor("#A16207"), True)
    wrapped(c, "Use sempre a conta do cliente que representa a operação vinculada ao Portal. A assinatura mensal de R$ 49,90 por integração começa na próxima fatura após a conexão. Para trocar de conta ou encerrar a integração, solicite suporte à equipe Infinoos.", M + 6 * mm, 76 * mm, 162 * mm, 8.5, HexColor("#7C5E10"), 11)
    footer(c, 2)
    c.save()


if __name__ == "__main__":
    main()
