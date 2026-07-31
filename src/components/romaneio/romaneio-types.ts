export type RomaneioStop = {
  seq: number;
  customer: string;
  code: string;
  city: string;
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
  volumes: number;
  weight: string; // e.g., '412 kg'
  cap: number; // percentage, e.g., 72
  driver: string;
  plate: string;
  vehicle: string;
  departure: string;
  status: string;

  // Calculated styles
  carrierColor: string;
  carrierBg: string;
  carrierInit: string;
  capColor: string;
  capFill: string;
  statusBg: string;
  statusColor: string;
  statusDot: string;
  depColor: string;

  specs: { k: string; v: string }[];
  stops: RomaneioStop[];
};
