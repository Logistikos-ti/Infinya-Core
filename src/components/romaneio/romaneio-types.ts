import type { RomaneioStatus } from "@/lib/romaneio-records";

export type RomaneioStop = {
  seq: number;
  customer: string;
  code: string;
  city: string;
  invoiceNumber: string;
  vol: string;
  weight: string;
};

export type RomaneioUI = {
  id: string | null;
  orderIds: string[];
  transportadoraId: string | null;
  transportadoraNome: string | null;
  code: string;
  carrier: string;
  route: string;
  orders: number;
  itemCount: number; // soma de quantidade_itens dos pedidos do romaneio
  volumes: number; // soma de volumeCount (embalagens da NF) dos pedidos -- não confundir com unidades de produto
  weight: string; // valor total formatado, ex. 'R$ 412,00'
  weightKg: number; // peso real (produtos.peso_kg * quantidade), somado dos pedidos
  driver: string;
  plate: string;
  vehicle: string;
  dock: string | null;
  departure: string;
  releasedAtLabel: string | null;
  status: RomaneioStatus;
  statusLabel: string;

  // Calculated styles
  carrierColor: string;
  carrierBg: string;
  carrierInit: string;
  statusBg: string;
  statusColor: string;
  statusDot: string;
  depColor: string;

  stops: RomaneioStop[];

  /** JSON (string) do payload de dupla checagem (fotos + conferido_por/em)
   * -- mesmo campo que a API /api/romaneio/[id]/foto lê pra servir a foto/
   * assinatura do operador/motorista. Vem de RomaneioRecordListItem.conferenceInfoJson. */
  conferenceInfoJson: string | null;
};
