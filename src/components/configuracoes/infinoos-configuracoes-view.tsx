"use client";

import React, { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  saveDepositanteAction,
  deleteDepositanteAction,
  toggleDepositanteStatusAction,
} from "@/app/(dashboard)/configuracoes/depositantes/actions";

type TabKey =
  | "resumo"
  | "depositantes"
  | "usuarios"
  | "produtos"
  | "enderecos"
  | "transportadoras"
  | "integracoes";

type Task = {
  id: number;
  text: string;
  done: boolean;
};

type RowItem = {
  id: string;
  name: string;
  meta: string;
  col1: string;
  tag: string;
  ci: number;
};

type IntegrationItem = {
  id: string;
  name: string;
  kind: string;
  ci: number;
  sync: string;
};

interface InfinoosConfiguracoesViewProps {
  initialDepositantes?: Array<{
    id: string;
    nome: string;
    ativo?: boolean;
    skus?: number;
    usuarios?: number;
    metodo?: string;
    cnpj?: string;
    codigo?: string;
    logoUrl?: string;
    configuracoesRaw?: string;
  }>;
  initialUsuarios?: Array<{
    id: string;
    nome?: string;
    email?: string;
    perfil?: string;
    ativo?: boolean;
  }>;
  initialCounts?: {
    depositantes?: number;
    produtos?: number;
    usuarios?: number;
    enderecos?: number;
    transportadoras?: number;
  };
}

function TaskCheckCircle({
  done,
  onClick,
  borderColor,
  size = 22,
}: {
  done: boolean;
  onClick: () => void;
  borderColor: string;
  size?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={done ? "Reabrir tarefa" : "Concluir tarefa"}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        borderRadius: "50%",
        border: `2px solid ${done ? "#10B981" : hovered ? "#10B981" : borderColor}`,
        background: done
          ? "#10B981"
          : hovered
          ? "rgba(16, 185, 129, 0.16)"
          : "transparent",
        color: done ? "#ffffff" : hovered ? "#10B981" : "transparent",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <svg
        width={size === 24 ? 14 : 12}
        height={size === 24 ? 14 : 12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: done || hovered ? 1 : 0,
          transform: done || hovered ? "scale(1)" : "scale(0.5)",
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }}
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </button>
  );
}

export function InfinoosConfiguracoesView({
  initialDepositantes,
  initialUsuarios,
  initialCounts,
}: InfinoosConfiguracoesViewProps) {
  const { theme: nextTheme, setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  const [tab, setTab] = useState<TabKey>("resumo");
  const [searchQuery, setSearchQuery] = useState("");

  // Toggles state
  const [depOn, setDepOn] = useState<Record<string, boolean>>(() => {
    if (initialDepositantes && initialDepositantes.length > 0) {
      return Object.fromEntries(initialDepositantes.map((d) => [d.id, d.ativo ?? true]));
    }
    return { d0: true, d1: true, d2: true, d3: false, d4: true, d5: true };
  });
  const [userOn, setUserOn] = useState<Record<string, boolean>>(() => {
    if (initialUsuarios && initialUsuarios.length > 0) {
      return Object.fromEntries(initialUsuarios.map((u) => [u.id, u.ativo ?? true]));
    }
    return { u0: true, u1: true, u2: true, u3: false, u4: true };
  });
  const [carrierOn, setCarrierOn] = useState<Record<string, boolean>>({
    c0: true,
    c1: true,
    c2: true,
    c3: false,
  });
  const [integrOn, setIntegrOn] = useState<Record<string, boolean>>({
    i0: true,
    i1: true,
    i2: false,
    i3: true,
    i4: false,
    i5: false,
  });

  // Product defaults
  const [cats, setCats] = useState<string[]>([
    "Eletrônicos",
    "Beleza & Saúde",
    "Casa & Cozinha",
    "Moda & Calçados",
    "Pet",
    "Papelaria",
  ]);
  const [method, setMethod] = useState<"fefo" | "fifo" | "lifo">("fefo");
  const [unit, setUnit] = useState<"un" | "cx" | "pk">("un");
  const [prodCtl, setProdCtl] = useState({
    validade: true,
    lote: true,
    serie: false,
  });

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Revisar 292 produtos já importados no ambiente.", done: false },
    { id: 2, text: "Padronizar categorias e unidades comerciais por depositante.", done: false },
    { id: 3, text: "Conectar importação em massa com planilhas operacionais reais.", done: false },
    { id: 4, text: "Completar cadastros de usuários, endereços e transportadoras.", done: false },
    { id: 5, text: "Configurar integração Bling V3 (OAuth2) do depositante John Skull.", done: true },
    { id: 6, text: "Mapear endereços de picking do bloco SBC1.", done: true },
  ]);
  const [nextTaskId, setNextTaskId] = useState(7);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState("");
  const [taskFilter, setTaskFilter] = useState<"pending" | "done" | "all">("pending");

  // Dynamic entities
  const [added, setAdded] = useState<Record<"depositantes" | "usuarios" | "transportadoras", RowItem[]>>({
    depositantes: [],
    usuarios: [],
    transportadoras: [],
  });
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"depositantes" | "usuarios" | "transportadoras" | null>(null);
  const [form, setForm] = useState<{ f1: string; f2: string; opt: string }>({ f1: "", f2: "", opt: "" });
  const [nextRow, setNextRow] = useState(1);
  const [addrTypesExtra, setAddrTypesExtra] = useState<Array<{ name: string; color: string; count: number }>>([]);

  // Depositantes Modal / Server Actions
  const [isPending, startTransition] = useTransition();
  const [depPageOpen, setDepPageOpen] = useState(false);
  const [depEditId, setDepEditId] = useState<string | null>(null);
  const [depLogo, setDepLogo] = useState<string | null>(null);
  const [depForm, setDepForm] = useState({
    codigo: "",
    fantasia: "",
    razao: "",
    cnpj: "",
    cep: "",
    rua: "",
    num: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [depPhones, setDepPhones] = useState<string[]>([""]);
  const [depEmails, setDepEmails] = useState([""]);
  const [depMethod, setDepMethod] = useState("FEFO");
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2800);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("infinoos-theme");
    if (saved === "light" || saved === "dark") {
      setThemeMode(saved);
    } else if (resolvedTheme === "light" || resolvedTheme === "dark") {
      setThemeMode(resolvedTheme);
    }
  }, [resolvedTheme]);

  const toggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    localStorage.setItem("infinoos-theme", next);
    setNextTheme(next);
  };

  const dark = themeMode === "dark";

  // Color tokens
  const t = dark
    ? {
        appBg: "transparent",
        sideBg: "#0C1424",
        railBg: "#0B1220",
        barBg: "rgba(8, 17, 34, 0.8)",
        cardBg: "rgba(8, 17, 34, 0.78)",
        headBg: "rgba(13, 24, 48, 0.65)",
        inputBg: "rgba(13, 24, 48, 0.65)",
        border: "rgba(255, 255, 255, 0.08)",
        navHover: "rgba(255, 255, 255, 0.06)",
        rowHover: "rgba(255, 255, 255, 0.03)",
        softBg: "rgba(255, 255, 255, 0.05)",
        text: "#F4F8FF",
        textSub: "#93A6C7",
      }
    : {
        appBg: "transparent",
        sideBg: "#FFFFFF",
        railBg: "#FBFCFE",
        barBg: "rgba(255, 255, 255, 0.85)",
        cardBg: "rgba(255, 255, 255, 0.88)",
        headBg: "rgba(238, 244, 255, 0.75)",
        inputBg: "rgba(255, 255, 255, 0.9)",
        border: "rgba(216, 226, 242, 0.85)",
        navHover: "rgba(0, 207, 255, 0.08)",
        rowHover: "rgba(0, 0, 0, 0.02)",
        softBg: "rgba(238, 242, 255, 0.7)",
        text: "#08111F",
        textSub: "#5A6A85",
      };

  const tog = dark
    ? {
        track: "#0E1729",
        border: "rgba(96,165,250,0.30)",
        inset: "rgba(0,0,0,0.5)",
        knob: "#0B1220",
        knobX: "0px",
        knobIcon: "☾",
        knobIconColor: "#3B82F6",
        trackMoon: "transparent",
        trackSun: "#3B4763",
      }
    : {
        track: "#F4F5F8",
        border: "rgba(100,116,139,0.18)",
        inset: "rgba(0,0,0,0.06)",
        knob: "#FFFFFF",
        knobX: "36px",
        knobIcon: "☀",
        knobIconColor: "#F6A623",
        trackMoon: "#B4BCC9",
        trackSun: "transparent",
      };

  const hex = (h: string, a: number) => {
    const n = parseInt(h.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  };
  const onColor = "#10B981";
  const offColor = dark ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.3)";
  const sw = (isOn: boolean) => ({
    swBg: isOn ? onColor : offColor,
    swX: isOn ? "20px" : "0px",
  });
  const initialsOf = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  const pal = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#06B6D4", "#A855F7"];

  // Sub-tabs definition
  const tabDef: Array<{
    key: TabKey;
    label: string;
    icon: string;
    color: string;
    desc: string;
    count: string;
  }> = [
    { key: "resumo", label: "Resumo", icon: "dashboard", color: "#8B5CF6", desc: "Visão geral", count: "" },
    { key: "depositantes", label: "Depositantes", icon: "users", color: "#3B82F6", desc: "Clientes do CD", count: String(initialCounts?.depositantes ?? 0) },
    { key: "usuarios", label: "Usuários", icon: "user", color: "#8B5CF6", desc: "Equipe e permissões", count: String(initialCounts?.usuarios ?? 0) },
    { key: "produtos", label: "Produtos", icon: "box", color: "#EC4899", desc: "Padrões do catálogo", count: String(initialCounts?.produtos ?? 0) },
    { key: "enderecos", label: "Endereços", icon: "pin", color: "#10B981", desc: "Nomenclatura e tipos", count: String(initialCounts?.enderecos ?? 0) },
    { key: "transportadoras", label: "Transportadoras", icon: "truck", color: "#F59E0B", desc: "Parceiros de frete", count: String(initialCounts?.transportadoras ?? 0) },
    { key: "integracoes", label: "Integrações", icon: "plug", color: "#06B6D4", desc: "Marketplaces e ERP", count: "6" },
  ];

  const panelMap: Record<TabKey, { title: string; heading: string; sub: string; cta: string }> = {
    resumo: { title: "Resumo", heading: "Visão geral", sub: "Resumo de cadastros e integrações do CD.", cta: "Novo cadastro" },
    depositantes: { title: "Depositantes", heading: "Depositantes", sub: "Clientes que armazenam produtos no CD.", cta: "Novo depositante" },
    usuarios: { title: "Usuários", heading: "Usuários & permissões", sub: "Equipe com acesso ao WMS e seus perfis.", cta: "Novo usuário" },
    produtos: { title: "Produtos", heading: "Padrões de produto", sub: "Regras aplicadas ao cadastro de SKUs.", cta: "Nova categoria" },
    enderecos: { title: "Endereços", heading: "Configuração de endereços", sub: "Nomenclatura e tipos de posição do armazém.", cta: "Novo tipo" },
    transportadoras: { title: "Transportadoras", heading: "Transportadoras", sub: "Parceiros de frete e coleta.", cta: "Nova transportadora" },
    integracoes: { title: "Integrações", heading: "Integrações", sub: "Conexões com marketplaces e ERP.", cta: "Nova integração" },
  };

  const isRows = tab === "depositantes" || tab === "usuarios" || tab === "transportadoras";
  const roleColor: Record<string, string> = {
    Administrador: "#EF4444",
    Supervisor: "#8B5CF6",
    Conferente: "#3B82F6",
    Operador: "#10B981",
    Gestor: "#F59E0B",
  };

  const baseData: Record<"depositantes" | "usuarios" | "transportadoras", RowItem[]> = {
    depositantes:
      initialDepositantes && initialDepositantes.length > 0
        ? initialDepositantes.map((d, i) => ({
            id: d.id,
            name: d.nome,
            meta: `${d.skus} SKUs · ${d.usuarios} usuários`,
            col1: d.cnpj || "—",
            tag: d.metodo || "FEFO",
            ci: i % 7,
          }))
        : [
            { id: "d0", name: "Dêvi Bebidas Naturais", meta: "17 SKUs · DEP-101", col1: "12.345.678/0001-90", tag: "Full", ci: 0 },
            { id: "d1", name: "Evolveg", meta: "81 SKUs · DEP-102", col1: "98.765.432/0001-10", tag: "Full", ci: 3 },
            { id: "d2", name: "GoodEssence Cosméticos", meta: "18 SKUs · DEP-103", col1: "45.111.222/0001-73", tag: "Fracionado", ci: 2 },
            { id: "d3", name: "John Skull Store", meta: "101 SKUs · DEP-104", col1: "33.444.555/0001-06", tag: "Fracionado", ci: 4 },
            { id: "d4", name: "Vegpet Artigos para Pet", meta: "72 SKUs · DEP-105", col1: "11.222.333/0001-44", tag: "Full", ci: 5 },
            { id: "d5", name: "Volcà", meta: "4 SKUs · DEP-106", col1: "55.666.777/0001-88", tag: "Fracionado", ci: 6 },
          ],
    usuarios:
      initialUsuarios && initialUsuarios.length > 0
        ? initialUsuarios.map((u, i) => ({
            id: u.id,
            name: u.nome || u.email?.split("@")[0] || "Usuário",
            meta: u.perfil || "Operador",
            col1: u.email || "—",
            tag: u.perfil || "Operador",
            ci: i % 7,
          }))
        : [
            { id: "u0", name: "Rafael Alves", meta: "CD Cajamar", col1: "rafael.alves@infinoos.com", tag: "Supervisor", ci: 1 },
            { id: "u1", name: "Juliana Prado", meta: "CD Cajamar", col1: "juliana.prado@infinoos.com", tag: "Gestor", ci: 4 },
            { id: "u2", name: "Carlos Mendes", meta: "Matrícula 4471", col1: "carlos.mendes@infinoos.com", tag: "Operador", ci: 3 },
            { id: "u3", name: "Marina Duarte", meta: "Matrícula 4488", col1: "marina.duarte@infinoos.com", tag: "Conferente", ci: 0 },
            { id: "u4", name: "Diego Santos", meta: "Acesso total", col1: "diego.santos@infinoos.com", tag: "Administrador", ci: 2 },
          ],
    transportadoras: [
      { id: "c0", name: "Mercado Envios", meta: "Marketplace · coleta diária", col1: "Coleta", tag: "2–4 dias", ci: 5 },
      { id: "c1", name: "Shopee Xpress", meta: "Marketplace · coleta diária", col1: "Coleta", tag: "3–5 dias", ci: 6 },
      { id: "c2", name: "Correios PAC", meta: "Postagem · agência", col1: "Postagem", tag: "5–9 dias", ci: 0 },
      { id: "c3", name: "Jamef Encomendas", meta: "Transportadora · fracionado", col1: "Fracionado", tag: "4–7 dias", ci: 4 },
    ],
  };

  const colsByTab: Record<
    "depositantes" | "usuarios" | "transportadoras",
    Array<{ label: string; flex: number; align: "left" | "right" }>
  > = {
    depositantes: [
      { label: "Depositante", flex: 2.4, align: "left" },
      { label: "CNPJ", flex: 1.4, align: "left" },
      { label: "Contrato", flex: 1, align: "left" },
      { label: "Status", flex: 0.7, align: "right" },
    ],
    usuarios: [
      { label: "Usuário", flex: 2.4, align: "left" },
      { label: "E-mail", flex: 1.8, align: "left" },
      { label: "Perfil", flex: 1, align: "left" },
      { label: "Ativo", flex: 0.7, align: "right" },
    ],
    transportadoras: [
      { label: "Transportadora", flex: 2.4, align: "left" },
      { label: "Tipo", flex: 1.4, align: "left" },
      { label: "Prazo médio", flex: 1, align: "left" },
      { label: "Ativo", flex: 0.7, align: "right" },
    ],
  };

  // Integration items
  const igData: IntegrationItem[] = [
    { id: "i0", name: "Mercado Livre", kind: "Marketplace", ci: 5, sync: "Sincronizado há 4 min" },
    { id: "i1", name: "Shopee", kind: "Marketplace", ci: 2, sync: "Sincronizado há 8 min" },
    { id: "i2", name: "Amazon", kind: "Marketplace", ci: 4, sync: "Nunca conectado" },
    { id: "i3", name: "Bling ERP", kind: "ERP / Fiscal", ci: 0, sync: "Sincronizado há 1 h" },
    { id: "i4", name: "Tiny ERP", kind: "ERP / Fiscal", ci: 3, sync: "Nunca conectado" },
    { id: "i5", name: "Magalu", kind: "Marketplace", ci: 6, sync: "Nunca conectado" },
  ];

  // Overview data - Cards KPI com dados reais do sistema
  const kpiList = [
    { label: "Depositantes ativos", value: String(initialCounts?.depositantes ?? 0), icon: "users", color: "#3B82F6" },
    { label: "Produtos ativos", value: String(initialCounts?.produtos ?? 0), icon: "box", color: "#EC4899" },
    { label: "Usuários ativos", value: String(initialCounts?.usuarios ?? 0), icon: "user", color: "#8B5CF6" },
    { label: "Endereços ativos", value: String(initialCounts?.enderecos ?? 0), icon: "pin", color: "#10B981" },
    { label: "Transportadoras ativas", value: String(initialCounts?.transportadoras ?? 0), icon: "truck", color: "#F59E0B" },
  ];

  const depBaseList =
    initialDepositantes && initialDepositantes.length > 0
      ? initialDepositantes.map((dep, idx) => ({
          name: dep.nome,
          method: dep.metodo || "FEFO",
          skus: dep.skus || 0,
          users: dep.usuarios || 0,
          ci: idx % 7,
        }))
      : [
          { name: "Dêvi Bebidas Naturais", method: "FEFO", skus: 17, users: 3, ci: 0 },
          { name: "Evolveg", method: "FEFO", skus: 81, users: 1, ci: 3 },
          { name: "GoodEssence Cosméticos", method: "FEFO", skus: 18, users: 1, ci: 2 },
          { name: "John Skull", method: "FIFO", skus: 101, users: 2, ci: 4 },
          { name: "Vegpet Artigos para Pet", method: "FEFO", skus: 72, users: 2, ci: 5 },
          { name: "Volcà", method: "FEFO", skus: 4, users: 1, ci: 6 },
        ];

  const summaryCards = [
    { key: "depositantes" as TabKey, label: "Depositantes", desc: "Carteira ativa, contatos, regras operacionais e segregação por cliente.", icon: "users", color: "#3B82F6" },
    { key: "usuarios" as TabKey, label: "Usuários", desc: "Papéis, acessos, vínculo por depositante e gestão de sessão operacional.", icon: "user", color: "#8B5CF6" },
    { key: "produtos" as TabKey, label: "Produtos", desc: "SKU, EAN/GTIN, categoria, FEFO/FIFO, unidade, lote e validade.", icon: "box", color: "#EC4899" },
    { key: "enderecos" as TabKey, label: "Endereços", desc: "Mapa físico de recebimento, pulmão, picking, bloqueado e expedição.", icon: "pin", color: "#10B981" },
    { key: "transportadoras" as TabKey, label: "Transportadoras", desc: "CNPJ, modalidades, contato principal e base logística para expedição.", icon: "truck", color: "#F59E0B" },
    { key: "integracoes" as TabKey, label: "Integrações", desc: "Bling V3, OAuth2, webhooks operacionais e conexões externas por depositante.", icon: "plug", color: "#06B6D4" },
  ];

  // Calcula método predominante real a partir dos depositantes cadastrados
  const methodFreq: Record<string, number> = {};
  (initialDepositantes ?? []).forEach((d) => {
    if (d.metodo) {
      methodFreq[d.metodo] = (methodFreq[d.metodo] || 0) + 1;
    }
  });
  let predominantMethod = "FEFO";
  let maxMethodCount = 0;
  for (const [m, count] of Object.entries(methodFreq)) {
    if (count > maxMethodCount) {
      maxMethodCount = count;
      predominantMethod = m;
    }
  }

  const coverage = [
    {
      label: "Depositantes com SKU cadastrado",
      value: String((initialDepositantes ?? []).filter((d) => (d.skus ?? 0) > 0).length),
      color: "#10B981",
    },
    {
      label: "Depositantes sem SKU cadastrado",
      value: String((initialDepositantes ?? []).filter((d) => (d.skus ?? 0) === 0).length),
      color: t.textSub,
    },
    {
      label: "Usuários vinculados a depositantes",
      value: String((initialDepositantes ?? []).reduce((acc, d) => acc + (d.usuarios || 0), 0)),
      color: t.text,
    },
    {
      label: "Método predominante no ambiente",
      value: predominantMethod,
      color: "#8B5CF6",
    },
  ];

  // Address types
  const addrTypes = [
    { name: "Picking", color: "#3B82F6", count: 640 },
    { name: "Pulmão", color: "#8B5CF6", count: 1280 },
    { name: "Avaria / bloqueio", color: "#EF4444", count: 48 },
    { name: "Expedição", color: "#10B981", count: 96 },
    ...addrTypesExtra,
  ];

  // Drawer options
  const roleOpts = ["Operador", "Conferente", "Supervisor", "Gestor", "Administrador"];
  const typeOpts = ["Coleta", "Postagem", "Fracionado"];
  const drawerCfg = {
    depositantes: { title: "Novo depositante", f1: "Razão social", f2: "CNPJ", f2ph: "00.000.000/0001-00", opts: null },
    usuarios: { title: "Novo usuário", f1: "Nome completo", f2: "E-mail", f2ph: "nome@infinoos.com", opts: roleOpts, optLabel: "Perfil" },
    transportadoras: { title: "Nova transportadora", f1: "Nome", f2: "Prazo médio", f2ph: "Ex.: 3–5 dias", opts: typeOpts, optLabel: "Tipo" },
  };

  const openDrawer = (k: "depositantes" | "usuarios" | "transportadoras") => {
    setDrawer(k);
    setRowMenu(null);
    setForm({ f1: "", f2: "", opt: drawerCfg[k].opts ? drawerCfg[k].opts[0] : "" });
  };

  const submitDrawer = () => {
    if (!drawer || !form.f1.trim()) return;
    const k = drawer;
    const id = k[0] + "_new" + nextRow;
    const ci = 5 + nextRow;
    let row: RowItem;
    if (k === "depositantes") {
      row = { id, name: form.f1, meta: "0 SKUs · novo", col1: form.f2 || "—", tag: "Fracionado", ci };
    } else if (k === "usuarios") {
      row = { id, name: form.f1, meta: "Novo acesso", col1: form.f2 || "—", tag: form.opt || "Operador", ci };
    } else {
      row = { id, name: form.f1, meta: (form.opt || "Coleta") + " · nova", col1: form.opt || "Coleta", tag: form.f2 || "—", ci };
    }
    setAdded((prev) => ({ ...prev, [k]: [...prev[k], row] }));
    setNextRow((prev) => prev + 1);
    setDrawer(null);
    notify(drawerCfg[k].title.replace("Novo", "Adicionado").replace("Nova", "Adicionada"));
  };

  const openDepPage = (d?: RowItem) => {
    if (d) {
      const raw = initialDepositantes?.find((x) => x.id === d.id);
      let parsedConfig: any = {};
      try {
        if (raw?.configuracoesRaw) {
          parsedConfig = JSON.parse(raw.configuracoesRaw);
        }
      } catch (e) {}

      setDepPageOpen(true);
      setDepLogo(raw?.logoUrl || null);
      setDepEditId(d.id);
      setDepForm({
        codigo: raw?.codigo || "",
        fantasia: raw?.nome || "",
        razao: parsedConfig?.razaoSocial || "",
        cnpj: raw?.cnpj || "",
        cep: parsedConfig?.enderecoFiscal?.cep || "",
        rua: parsedConfig?.enderecoFiscal?.logradouro || "",
        num: parsedConfig?.enderecoFiscal?.numero || "",
        bairro: parsedConfig?.enderecoFiscal?.bairro || "",
        cidade: parsedConfig?.enderecoFiscal?.cidade || "",
        uf: parsedConfig?.enderecoFiscal?.uf || "",
      });

      const tels = parsedConfig?.telefonesContato || [];
      setDepPhones(tels.length > 0 ? tels : [{ nome: "", telefone: "" }]);

      const emails = parsedConfig?.emailsContato || [];
      setDepEmails(emails.length > 0 ? emails.map((x: any) => x.email) : [""]);

      setDepMethod(parsedConfig?.metodoRetiradaPadrao || "FEFO");
    } else {
      setDepPageOpen(true);
      setDepLogo(null);
      setDepEditId(null);
      setDepForm({
        codigo: "",
        fantasia: "",
        razao: "",
        cnpj: "",
        cep: "",
        rua: "",
        num: "",
        bairro: "",
        cidade: "",
        uf: "",
      });
      setDepPhones([""]);
      setDepEmails([""]);
      setDepMethod("FEFO");
    }
  };

  const submitDepPage = () => {
    if (!depForm.fantasia.trim() || !depForm.cnpj.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      if (depEditId) formData.append("id", depEditId);
      formData.append("codigo", depForm.codigo || "DEP-" + Date.now().toString().slice(-4));
      formData.append("nome", depForm.fantasia);
      formData.append("razaoSocial", depForm.razao);
      formData.append("cnpj", depForm.cnpj);
      formData.append("enderecoFiscalCep", depForm.cep);
      formData.append("enderecoFiscalLogradouro", depForm.rua);
      formData.append("enderecoFiscalNumero", depForm.num);
      formData.append("enderecoFiscalBairro", depForm.bairro);
      formData.append("enderecoFiscalCidade", depForm.cidade);
      formData.append("enderecoFiscalUf", depForm.uf);
      formData.append("metodoRetiradaPadrao", depMethod);
      formData.append("ativo", "on");

      depPhones.forEach((p) => {
        if (p.nome.trim() && p.telefone.trim()) {
          formData.append("contatoTelefoneNome", p.nome);
          formData.append("contatoTelefone", p.telefone);
        }
      });
      depEmails.forEach((e) => {
        if (e.trim()) formData.append("contatoEmail", e);
      });

      try {
        const result = await saveDepositanteAction({ success: false, message: null }, formData);
        if (!result.success) {
          notify(result.message || "Erro ao salvar depositante");
        } else {
          setDepPageOpen(false);
          notify("Depositante salvo com sucesso");
        }
      } catch (e) {
        notify("Erro ao comunicar com o servidor");
      }
    });
  };

  const confirmDeleteDep = () => {
    if (!confirmDel) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", confirmDel.id);
      try {
        await deleteDepositanteAction(formData);
        setConfirmDel(null);
        notify("Depositante excluído com sucesso");
      } catch (e) {
        notify("Erro ao excluir depositante");
      }
    });
  };

  const handlePanelCta = () => {
    if (tab === "depositantes") {
      openDepPage();
    } else if (isRows && (tab === "usuarios" || tab === "transportadoras")) {
      openDrawer(tab);
    } else if (tab === "produtos") {
      const n = cats.length + 1;
      setCats((prev) => [...prev, "Nova categoria " + n]);
      notify("Categoria adicionada");
    } else if (tab === "enderecos") {
      setAddrTypesExtra((prev) => [
        ...prev,
        { name: "Novo tipo " + (prev.length + 1), color: pal[(prev.length + 2) % pal.length], count: 0 },
      ]);
      notify("Tipo de endereço adicionado");
    } else {
      notify(panelMap[tab].cta);
    }
  };

  const [fillingIds, setFillingIds] = useState<Record<number, boolean>>({});
  const [exitingIds, setExitingIds] = useState<Record<number, boolean>>({});

  const pendingTasks = tasks.filter((x) => !x.done);
  const doneTasks = tasks.filter((x) => x.done);
  const filteredTasks = taskFilter === "pending" ? pendingTasks : taskFilter === "done" ? doneTasks : tasks;

  const handleCompleteTask = (id: number) => {
    if (fillingIds[id] || exitingIds[id]) return;
    // 1. Inicia o preenchimento verde da barra (0% -> 100%)
    setFillingIds((prev) => ({ ...prev, [id]: true }));

    // 2. Quando a barra completa de encher (480ms), inicia o recolhimento suave
    setTimeout(() => {
      setExitingIds((prev) => ({ ...prev, [id]: true }));

      // 3. Após recolher (320ms), atualiza o estado final da tarefa
      setTimeout(() => {
        setTasks((prev) => prev.map((y) => (y.id === id ? { ...y, done: true } : y)));
        setFillingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setExitingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        notify("Tarefa concluída!");
      }, 320);
    }, 480);
  };

  const handleToggleTaskInModal = (id: number, currentDone: boolean) => {
    if (taskFilter === "pending" && !currentDone) {
      if (fillingIds[id] || exitingIds[id]) return;
      setFillingIds((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setExitingIds((prev) => ({ ...prev, [id]: true }));
        setTimeout(() => {
          setTasks((prev) => prev.map((y) => (y.id === id ? { ...y, done: true } : y)));
          setFillingIds((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setExitingIds((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          notify("Tarefa concluída!");
        }, 320);
      }, 480);
    } else {
      setTasks((prev) => prev.map((y) => (y.id === id ? { ...y, done: !y.done } : y)));
      notify(currentDone ? "Tarefa reaberta" : "Tarefa concluída!");
    }
  };

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const v = taskDraft.trim();
    if (!v) return;
    setTasks((prev) => [{ id: nextTaskId, text: v, done: false }, ...prev]);
    setNextTaskId((prev) => prev + 1);
    setTaskDraft("");
    notify("Tarefa adicionada");
  };

  // SVGs
  const renderIcon = (type: string, size = 18) => {
    switch (type) {
      case "dashboard":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
        );
      case "users":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 5.5a3 3 0 0 1 0 5.8" />
            <path d="M18 20a6.5 6.5 0 0 0-3-5.5" />
          </svg>
        );
      case "user":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        );
      case "box":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 3 7v10l9 5 9-5V7z" />
            <path d="M3 7l9 5 9-5" />
            <path d="M12 12v10" />
          </svg>
        );
      case "pin":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        );
      case "truck":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h11v9H3z" />
            <path d="M14 10h3.5l3.5 3.5V16h-7z" />
            <circle cx="7" cy="18.5" r="1.6" />
            <circle cx="17.5" cy="18.5" r="1.6" />
          </svg>
        );
      case "plug":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2v6M15 2v6" />
            <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
            <path d="M12 16v6" />
          </svg>
        );
      case "bell":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        );
      case "dots":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1.4" />
            <circle cx="12" cy="12" r="1.4" />
            <circle cx="12" cy="19" r="1.4" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="relative space-y-6 font-sans text-slate-900 dark:text-zinc-100"
      style={{
        color: t.text,
        fontFamily: "'Manrope', var(--font-manrope), sans-serif",
      }}
    >
      <style>{`
        .infinoos-task-input::placeholder {
          color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
          opacity: 1 !important;
          -webkit-text-fill-color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
        }
        .infinoos-task-input::-webkit-input-placeholder {
          color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
          opacity: 1 !important;
          -webkit-text-fill-color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
        }
        .infinoos-task-input::-moz-placeholder {
          color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
          opacity: 1 !important;
        }
        .infinoos-task-input:-ms-input-placeholder {
          color: ${dark ? "rgba(148, 163, 184, 0.65)" : "#64748B"} !important;
          opacity: 1 !important;
        }
      `}</style>
      {/* Main Content Area */}
      <main className="space-y-6">
        {/* Panel Header */}
        {tab !== "depositantes" && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "22px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: t.textSub }}>
              <span onClick={() => setTab("resumo")} style={{ cursor: "pointer" }}>
                Configurações
              </span>
              <span>›</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{panelMap[tab].title}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {tab !== "resumo" && (
                <button
                  onClick={() => setTab("resumo")}
                  title="Voltar para Resumo"
                  style={{
                    width: "40px",
                    height: "40px",
                    flexShrink: 0,
                    borderRadius: "11px",
                    border: `1px solid ${t.border}`,
                    background: t.inputBg,
                    color: t.text,
                    cursor: "pointer",
                    fontSize: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ‹
                </button>
              )}
              <h2
                style={{
                  margin: 0,
                  fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                  fontSize: "25px",
                  fontWeight: 700,
                }}
              >
                {panelMap[tab].heading}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: t.textSub }}>{panelMap[tab].sub}</p>
          </div>

          {tab !== "resumo" && (
            <button
              onClick={handlePanelCta}
              style={{
                height: "44px",
                padding: "0 20px",
                border: "none",
                borderRadius: "11px",
                background: "linear-gradient(92deg, #3B82F6, #8B5CF6)",
                color: "#fff",
                fontFamily: "'Manrope', sans-serif",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 22px rgba(99,102,241,0.32)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              + {panelMap[tab].cta}
            </button>
          )}
        </div>
        )}

        {/* ============ TAB: RESUMO ============ */}
        {tab === "resumo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
              {kpiList.map((k, i) => (
                <div
                  key={i}
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    gap: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hex(k.color, 0.14),
                        color: k.color,
                      }}
                    >
                      {renderIcon(k.icon, 16)}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: t.textSub }}>{k.label}</span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                      fontSize: "28px",
                      fontWeight: 700,
                      color: k.value === "0" ? t.textSub : t.text,
                    }}
                  >
                    {k.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Depositantes Base + Tarefas Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "18px" }}>
              {/* Depositantes base */}
              <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "18px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                      Depositantes base
                    </span>
                    <span style={{ fontSize: "13px", color: t.textSub }}>
                      Isolamento multi-tenant e políticas de acesso por cliente.
                    </span>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "5px 12px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: "rgba(16,185,129,0.14)",
                      color: "#10B981",
                    }}
                  >
                    {initialDepositantes ? `${initialDepositantes.filter((d) => d.ativo).length} ativos` : `${depBaseList.length} ativos`}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {depBaseList.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: "13px",
                        border: `1px solid ${t.border}`,
                        background: t.softBg,
                        padding: "15px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
                        <span
                          style={{
                            width: "34px",
                            height: "34px",
                            flexShrink: 0,
                            borderRadius: "9px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "12px",
                            color: "#fff",
                            background: `linear-gradient(135deg, ${pal[d.ci % pal.length]}, ${hex(pal[d.ci % pal.length], 0.6)})`,
                          }}
                        >
                          {initialsOf(d.name)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: "13.5px", fontWeight: 700, lineHeight: 1.3 }}>
                          {d.name}
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            padding: "3px 9px",
                            borderRadius: "7px",
                            fontSize: "10px",
                            fontWeight: 800,
                            background: d.method === "FIFO" ? hex("#F59E0B", 0.16) : hex("#3B82F6", 0.14),
                            color: d.method === "FIFO" ? "#F59E0B" : "#60A5FA",
                          }}
                        >
                          {d.method}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: t.textSub }}>
                            SKUS
                          </span>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                            {d.skus}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: t.textSub }}>
                            USUÁRIOS
                          </span>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                            {d.users}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tarefas Widget (Google Tasks Style) */}
              <div
                style={{
                  borderRadius: "16px",
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                      Tarefas
                    </span>
                    <span style={{ fontSize: "13px", color: t.textSub }}>
                      {pendingTasks.length === 0
                        ? "Nenhuma pendente"
                        : pendingTasks.length === 1
                        ? "1 tarefa pendente"
                        : `${pendingTasks.length} tarefas pendentes`}
                    </span>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "5px 12px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: "rgba(139,92,246,0.14)",
                      color: "#A78BFA",
                    }}
                  >
                    {pendingTasks.length}
                  </span>
                </div>

                <form
                  onSubmit={handleAddTask}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "12px",
                    border: `1px solid ${t.border}`,
                    background: t.softBg,
                    marginBottom: "14px",
                  }}
                >
                  <span style={{ color: "#8B5CF6", fontSize: "18px", fontWeight: 700 }}>+</span>
                  <input
                    className="infinoos-task-input"
                    value={taskDraft}
                    onChange={(e) => setTaskDraft(e.target.value)}
                    placeholder="Adicionar uma tarefa..."
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: t.text,
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: "13.5px",
                    }}
                  />
                </form>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {pendingTasks.slice(0, 4).map((a) => {
                    const isFilling = !!fillingIds[a.id];
                    const isExiting = !!exitingIds[a.id];
                    return (
                      <div
                        key={a.id}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "11px",
                          padding: isExiting ? "0 14px" : "13px 14px",
                          maxHeight: isExiting ? "0px" : "90px",
                          opacity: isExiting ? 0 : 1,
                          transform: isExiting ? "translateX(18px) scale(0.96)" : "translateX(0) scale(1)",
                          overflow: "hidden",
                          borderRadius: "12px",
                          border: isExiting
                            ? "1px solid transparent"
                            : isFilling
                            ? "1px solid rgba(16, 185, 129, 0.45)"
                            : `1px solid ${t.border}`,
                          background: t.softBg,
                          transition: isExiting
                            ? "all 0.32s cubic-bezier(0.4, 0, 0.2, 1)"
                            : "border-color 0.25s ease",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Barra de progresso verde que enche da esquerda para a direita */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: isFilling ? "100%" : "0%",
                            background: "linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.28) 100%)",
                            borderBottom: isFilling ? "3px solid #10B981" : "3px solid transparent",
                            transition: isFilling ? "width 0.46s cubic-bezier(0.2, 0.85, 0.3, 1)" : "none",
                            pointerEvents: "none",
                            zIndex: 0,
                          }}
                        />

                        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", gap: "11px", width: "100%" }}>
                          <TaskCheckCircle
                            done={a.done || isFilling}
                            borderColor={t.textSub}
                            onClick={() => handleCompleteTask(a.id)}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: "13px",
                              lineHeight: 1.45,
                              color: isFilling ? t.textSub : t.text,
                              textDecoration: isFilling ? "line-through" : "none",
                              transition: "color 0.25s ease, text-decoration 0.25s ease",
                            }}
                          >
                            {a.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {pendingTasks.length === 0 && (
                    <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: t.textSub }}>
                      Tudo em dia — nenhuma tarefa pendente.
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }} />
                <button
                  onClick={() => {
                    setTasksOpen(true);
                    setTaskFilter("pending");
                  }}
                  style={{
                    marginTop: "14px",
                    height: "40px",
                    borderRadius: "11px",
                    border: `1px solid ${t.border}`,
                    background: t.softBg,
                    color: t.text,
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = t.navHover;
                    e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = t.softBg;
                    e.currentTarget.style.borderColor = t.border;
                  }}
                >
                  Ver mais
                </button>
              </div>
            </div>

            {/* 6 Category Summary Cards - Fileiras de 3 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
              {summaryCards.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setTab(s.key)}
                  style={{
                    borderRadius: "16px",
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = s.color;
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = `0 8px 24px ${hex(s.color, 0.12)}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = t.border;
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        width: "40px",
                        height: "40px",
                        flexShrink: 0,
                        borderRadius: "11px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hex(s.color, 0.14),
                        color: s.color,
                      }}
                    >
                      {renderIcon(s.icon, 20)}
                    </span>
                    <span style={{ flex: 1, fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                      {s.label}
                    </span>
                    <span style={{ color: t.textSub, fontSize: "18px", fontWeight: 700 }}>›</span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: t.textSub, lineHeight: 1.5 }}>{s.desc}</span>
                </div>
              ))}
            </div>

            {/* Cobertura atual */}
            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px", display: "block" }}>
                Cobertura atual
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                {coverage.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "16px 18px",
                      borderRadius: "12px",
                      border: `1px solid ${t.border}`,
                      background: t.softBg,
                    }}
                  >
                    <span style={{ flex: 1, fontSize: "13px", color: t.text }}>{c.label}</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700, color: c.color }}>
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB: DEPOSITANTES (Custom Table Design) ============ */}
        {tab === "depositantes" && (
          <div style={{ padding: "0" }}>
            {/* Header Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: t.textSub, marginLeft: '2px' }}>
                <span onClick={() => setTab("resumo")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = t.text} onMouseLeave={(e) => e.currentTarget.style.color = t.textSub}>Configurações</span>
                <span style={{ fontSize: '14px' }}>›</span>
                <span style={{ fontWeight: 600, color: t.text }}>Depositantes</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    onClick={() => setTab("resumo")}
                    title="Voltar para Resumo"
                    style={{ width: '40px', height: '40px', flexShrink: 0, borderRadius: '11px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.color = '#8B5CF6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.text; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, color: t.text, margin: 0, fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", letterSpacing: '-0.5px' }}>Depositantes</h1>
                </div>
                <button 
                  onClick={() => openDepPage()}
                  style={{ background: 'linear-gradient(92deg, #3B82F6, #8B5CF6)', color: '#fff', padding: '12px 20px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 22px rgba(99, 102, 241, 0.32)', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                >
                  + Novo depositante
                </button>
              </div>

              <span style={{ fontSize: '14.5px', color: t.textSub, marginLeft: '2px' }}>Clientes que armazenam produtos no CD.</span>
            </div>

            {/* Table Area */}
            <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              {/* Header Row */}
              <div style={{ display: 'flex', padding: '16px 24px', borderBottom: `1px solid ${t.border}`, fontSize: '11px', fontWeight: 700, color: t.textSub, letterSpacing: '0.05em' }}>
                <div style={{ flex: 2 }}>NOME FANTASIA / RAZÃO SOCIAL</div>
                <div style={{ flex: 1 }}>CNPJ</div>
                <div style={{ width: '220px', textAlign: 'right' }}>STATUS / AÇÕES</div>
              </div>
              
              {/* Data Rows */}
              {initialDepositantes?.filter((d) => !searchQuery || (d.nome || "").toLowerCase().includes(searchQuery.toLowerCase()) || (d.cnpj || "").toLowerCase().includes(searchQuery.toLowerCase())).map((dep, i) => {
                const isOn = depOn[dep.id] !== undefined ? depOn[dep.id] : true;
                return (
                  <div key={dep.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: i < (initialDepositantes?.length || 0) - 1 ? `1px solid ${t.border}` : 'none', background: t.cardBg }}>
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `linear-gradient(135deg, ${pal[i % pal.length]}, ${hex(pal[i % pal.length], 0.6)})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', flexShrink: 0 }}>
                        {initialsOf(dep.nome || "??")}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 700, color: t.text, fontSize: '14.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.nome || "Sem Nome"}</span>
                        <span style={{ color: t.textSub, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.cnpj || "CNPJ N/A"}</span>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, color: t.text, fontSize: '14px', fontWeight: 600 }}>
                      {dep.cnpj}
                    </div>
                    
                    <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', flexShrink: 0 }}>
                      {/* Status Pill */}
                      <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: isOn ? hex('#10B981', 0.14) : hex('#EF4444', 0.14), color: isOn ? '#10B981' : '#EF4444', padding: '6px 0', borderRadius: '999px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOn ? '#10B981' : '#EF4444', flexShrink: 0 }} />
                        {isOn ? 'Ativo' : 'Inativo'}
                      </div>
                      
                      {/* Toggle */}
                      <button
                        onClick={() => {
                          const newStatus = !isOn;
                          setDepOn((prev) => ({ ...prev, [dep.id]: newStatus }));
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.append("id", dep.id);
                            fd.append("ativo", newStatus ? "on" : "off");
                            try {
                              await toggleDepositanteStatusAction(fd);
                            } catch (e) {
                              setDepOn((prev) => ({ ...prev, [dep.id]: !newStatus }));
                              notify("Erro ao alterar status");
                            }
                          });
                        }}
                        style={{
                          position: "relative", width: "42px", height: "24px", borderRadius: "999px", border: "none", cursor: "pointer",
                          background: isOn ? "#10B981" : "#CBD5E1", transition: "background 0.25s ease",
                        }}
                      >
                        <span style={{ position: "absolute", top: "2px", left: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transform: isOn ? "translateX(18px)" : "translateX(0)", transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)" }} />
                      </button>

                      {/* Edit Button */}
                      <button onClick={() => openDepPage(dep as any)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#8B5CF6'; e.currentTarget.style.borderColor = '#8B5CF6'; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                      </button>

                      {/* Delete Button */}
                      <button onClick={() => setConfirmDel({ id: dep.id, name: dep.nome || "Desconhecido" })} style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${hex('#EF4444', 0.3)}`, background: hex('#EF4444', 0.1), color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = hex('#EF4444', 0.2)} onMouseLeave={(e) => e.currentTarget.style.background = hex('#EF4444', 0.1)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {(!initialDepositantes || initialDepositantes.length === 0) && (
                <div style={{ padding: '40px', textAlign: 'center', color: t.textSub, fontSize: '14px' }}>Nenhum depositante cadastrado.</div>
              )}
            </div>
          </div>
        )}

        {/* ============ TAB: USUÁRIOS / TRANSPORTADORAS (Table rows) ============ */}
        {isRows && tab !== "depositantes" && (
          <div
            style={{
              borderRadius: "16px",
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              overflowX: "auto",
            }}
          >
            <div style={{ minWidth: "720px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "12px 22px",
                  borderBottom: `1px solid ${t.border}`,
                  background: t.headBg,
                }}
              >
                {colsByTab[tab as "depositantes" | "usuarios" | "transportadoras"].map((c, i) => (
                  <span
                    key={i}
                    style={{
                      flex: c.flex,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: t.textSub,
                      textAlign: c.align,
                    }}
                  >
                    {c.label}
                  </span>
                ))}
              </div>

              {baseData[tab as "depositantes" | "usuarios" | "transportadoras"]
                .concat(added[tab as "depositantes" | "usuarios" | "transportadoras"])
                .filter((d) => !removed[d.id])
                .filter((d) => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.col1.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((r) => {
                  const onMap = tab === "depositantes" ? depOn : tab === "usuarios" ? userOn : carrierOn;
                  const isOn = onMap[r.id] !== undefined ? onMap[r.id] : true;
                  const isMenuOpen = rowMenu === r.id;

                  const tagStyle =
                    tab === "usuarios"
                      ? { bg: hex(roleColor[r.tag] || "#8B5CF6", 0.14), color: roleColor[r.tag] || "#8B5CF6" }
                      : tab === "transportadoras"
                      ? { bg: hex("#F59E0B", 0.16), color: "#F59E0B" }
                      : { bg: hex("#3B82F6", 0.14), color: "#60A5FA" };

                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        padding: "15px 22px",
                        borderBottom: `1px solid ${t.border}`,
                      }}
                    >
                      <div style={{ flex: 2.4, display: "flex", alignItems: "center", gap: "13px", minWidth: "220px" }}>
                        <span
                          style={{
                            width: "40px",
                            height: "40px",
                            flexShrink: 0,
                            borderRadius: "11px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "13.5px",
                            color: "#fff",
                            background: `linear-gradient(135deg, ${pal[r.ci % pal.length]}, ${hex(pal[r.ci % pal.length], 0.6)})`,
                          }}
                        >
                          {initialsOf(r.name)}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.name}
                          </span>
                          <span style={{ fontSize: "12px", color: t.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.meta}
                          </span>
                        </div>
                      </div>

                      <span style={{ flex: tab === "usuarios" ? 1.8 : 1.4, fontSize: "13.5px", fontWeight: 600, color: t.text }}>
                        {r.col1}
                      </span>

                      <div style={{ flex: 1, display: "flex" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            padding: "4px 11px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            background: tagStyle.bg,
                            color: tagStyle.color,
                          }}
                        >
                          {r.tag}
                        </span>
                      </div>

                      <div style={{ flex: 0.7, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", position: "relative" }}>
                        <button
                          onClick={() => {
                            if (tab === "depositantes") {
                              const newStatus = !isOn;
                              setDepOn((prev) => ({ ...prev, [r.id]: newStatus }));
                              startTransition(async () => {
                                const fd = new FormData();
                                fd.append("id", r.id);
                                fd.append("ativo", newStatus ? "on" : "off");
                                try {
                                  await toggleDepositanteStatusAction(fd);
                                } catch (e) {
                                  setDepOn((prev) => ({ ...prev, [r.id]: !newStatus }));
                                  notify("Erro ao alterar status");
                                }
                              });
                            }
                            else if (tab === "usuarios") setUserOn((prev) => ({ ...prev, [r.id]: !isOn }));
                            else setCarrierOn((prev) => ({ ...prev, [r.id]: !isOn }));
                          }}
                          title="Ativar/desativar"
                          style={{
                            position: "relative",
                            width: "46px",
                            height: "26px",
                            flexShrink: 0,
                            borderRadius: "999px",
                            border: "none",
                            cursor: "pointer",
                            background: sw(isOn).swBg,
                            transition: "background 0.25s ease",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: "3px",
                              left: "3px",
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                              transform: `translateX(${sw(isOn).swX})`,
                              transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)",
                            }}
                          />
                        </button>

                        <button
                          onClick={() => setRowMenu((prev) => (prev === r.id ? null : r.id))}
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "9px",
                            border: `1px solid ${t.border}`,
                            background: t.inputBg,
                            color: t.textSub,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {renderIcon("dots", 16)}
                        </button>

                        {isMenuOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "40px",
                              right: 0,
                              zIndex: 20,
                              width: "168px",
                              borderRadius: "12px",
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              boxShadow: "0 14px 34px rgba(0,0,0,0.32)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              onClick={() => {
                                setRowMenu(null);
                                if (tab === "depositantes") {
                                  openDepPage(r);
                                } else {
                                  notify(`Editar "${r.name}"`);
                                }
                              }}
                              style={{
                                padding: "12px 15px",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: "pointer",
                                borderBottom: `1px solid ${t.border}`,
                              }}
                            >
                              Editar
                            </div>
                            <div
                              onClick={() => {
                                setRowMenu(null);
                                if (tab === "depositantes") {
                                  setConfirmDel({ id: r.id, name: r.name });
                                } else {
                                  setRemoved((prev) => ({ ...prev, [r.id]: true }));
                                  notify(`"${r.name}" removido`);
                                }
                              }}
                              style={{
                                padding: "12px 15px",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#EF4444",
                                cursor: "pointer",
                              }}
                            >
                              Remover
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ============ TAB: PRODUTOS ============ */}
        {tab === "produtos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "940px" }}>
            {/* Categorias */}
            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                  Categorias de produto
                </span>
                <span style={{ fontSize: "13px", color: t.textSub }}>
                  Categorias usadas na classificação do catálogo.
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "9px" }}>
                {cats.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "9px",
                      height: "36px",
                      padding: "0 8px 0 14px",
                      borderRadius: "10px",
                      border: `1px solid ${t.border}`,
                      background: t.inputBg,
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {c}
                    <button
                      onClick={() => setCats((prev) => prev.filter((_, j) => j !== i))}
                      style={{
                        width: "22px",
                        height: "22px",
                        border: "none",
                        borderRadius: "7px",
                        background: "transparent",
                        color: t.textSub,
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <span
                  onClick={() => {
                    const n = cats.length + 1;
                    setCats((prev) => [...prev, "Nova categoria " + n]);
                    notify("Categoria adicionada");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "36px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    border: `1.5px dashed ${t.border}`,
                    color: "#8B5CF6",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Nova categoria
                </span>
              </div>
            </div>

            {/* Defaults Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div
                style={{
                  borderRadius: "16px",
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                    Método de saída padrão
                  </span>
                  <span style={{ fontSize: "13px", color: t.textSub }}>
                    Aplicado a novos produtos por padrão.
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                  {[
                    { key: "fefo", name: "FEFO", desc: "Primeiro que vence, primeiro que sai" },
                    { key: "fifo", name: "FIFO", desc: "Primeiro que entra, primeiro que sai" },
                    { key: "lifo", name: "LIFO", desc: "Último que entra, primeiro que sai" },
                  ].map((m) => {
                    const active = method === m.key;
                    return (
                      <div
                        key={m.key}
                        onClick={() => setMethod(m.key as any)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "13px 15px",
                          borderRadius: "12px",
                          border: `1.5px solid ${active ? "#8B5CF6" : t.border}`,
                          background: active ? hex("#8B5CF6", 0.08) : t.inputBg,
                          cursor: "pointer",
                          transition: "all 0.16s ease",
                        }}
                      >
                        <span
                          style={{
                            width: "20px",
                            height: "20px",
                            flexShrink: 0,
                            borderRadius: "50%",
                            border: `2px solid ${active ? "#8B5CF6" : t.textSub}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: active ? "#8B5CF6" : "transparent",
                            }}
                          />
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{m.name}</span>
                          <span style={{ fontSize: "12px", color: t.textSub }}>{m.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div
                  style={{
                    borderRadius: "16px",
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                      Controles obrigatórios
                    </span>
                    <span style={{ fontSize: "13px", color: t.textSub }}>
                      Exigidos no cadastro de novos SKUs.
                    </span>
                  </div>
                  {[
                    { key: "validade", name: "Controle de validade", desc: "Data de vencimento obrigatória" },
                    { key: "lote", name: "Controle de lote", desc: "Rastreio por número de lote" },
                    { key: "serie", name: "Número de série", desc: "Serial único por unidade" },
                  ].map((c) => {
                    const isOn = prodCtl[c.key as keyof typeof prodCtl];
                    return (
                      <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{c.name}</span>
                          <span style={{ fontSize: "12px", color: t.textSub }}>{c.desc}</span>
                        </div>
                        <button
                          onClick={() => setProdCtl((prev) => ({ ...prev, [c.key]: !isOn }))}
                          style={{
                            position: "relative",
                            width: "46px",
                            height: "26px",
                            flexShrink: 0,
                            borderRadius: "999px",
                            border: "none",
                            cursor: "pointer",
                            background: sw(isOn).swBg,
                            transition: "background 0.25s ease",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: "3px",
                              left: "3px",
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                              transform: `translateX(${sw(isOn).swX})`,
                              transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)",
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    borderRadius: "16px",
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                    Unidade padrão de estocagem
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[
                      { key: "un", name: "Unidade" },
                      { key: "cx", name: "Caixa" },
                      { key: "pk", name: "Pack" },
                    ].map((u) => {
                      const active = unit === u.key;
                      return (
                        <span
                          key={u.key}
                          onClick={() => setUnit(u.key as any)}
                          style={{
                            height: "38px",
                            padding: "0 16px",
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: `1.5px solid ${active ? "#8B5CF6" : t.border}`,
                            background: active ? hex("#8B5CF6", 0.1) : t.inputBg,
                            color: active ? t.text : t.textSub,
                            transition: "all 0.16s ease",
                          }}
                        >
                          {u.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB: ENDEREÇOS ============ */}
        {tab === "enderecos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "940px" }}>
            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                  Nomenclatura de endereço
                </span>
                <span style={{ fontSize: "13px", color: t.textSub }}>
                  Formato padrão das posições no armazém.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { label: "Rua", sample: "A", sep: true },
                  { label: "Coluna", sample: "12", sep: true },
                  { label: "Nível", sample: "03", sep: false },
                ].map((p, i) => (
                  <React.Fragment key={i}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: t.textSub }}>
                        {p.label}
                      </span>
                      <div
                        style={{
                          height: "46px",
                          minWidth: "84px",
                          padding: "0 16px",
                          borderRadius: "11px",
                          border: `1px solid ${t.border}`,
                          background: t.inputBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: "16px",
                          fontWeight: 700,
                        }}
                      >
                        {p.sample}
                      </div>
                    </div>
                    {p.sep && (
                      <span
                        style={{
                          alignSelf: "flex-end",
                          height: "46px",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "20px",
                          fontWeight: 700,
                          color: t.textSub,
                        }}
                      >
                        -
                      </span>
                    )}
                  </React.Fragment>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: t.textSub }}>
                    Exemplo
                  </span>
                  <div
                    style={{
                      height: "46px",
                      padding: "0 18px",
                      borderRadius: "11px",
                      background: "rgba(139,92,246,0.14)",
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#A78BFA",
                    }}
                  >
                    A-12-03
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>
                  Tipos de endereço
                </span>
                <span style={{ fontSize: "13px", color: t.textSub }}>
                  Classificações usadas no mapa do armazém.
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {addrTypes.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: `1px solid ${t.border}`,
                      background: t.inputBg,
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "4px",
                        flexShrink: 0,
                        background: a.color,
                      }}
                    />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{a.name}</span>
                      <span style={{ fontSize: "11.5px", color: t.textSub }}>{a.count} posições</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB: INTEGRAÇÕES ============ */}
        {tab === "integracoes" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {igData
              .filter((ig) => !searchQuery || ig.name.toLowerCase().includes(searchQuery.toLowerCase()) || ig.kind.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((ig) => {
                const isOn = integrOn[ig.id];
                return (
                  <div
                    key={ig.id}
                    style={{
                      borderRadius: "16px",
                      border: `1px solid ${isOn ? hex("#10B981", 0.32) : t.border}`,
                      background: t.cardBg,
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                      <span
                        style={{
                          width: "46px",
                          height: "46px",
                          flexShrink: 0,
                          borderRadius: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 800,
                          fontSize: "15px",
                          color: "#fff",
                          background: `linear-gradient(135deg, ${pal[ig.ci % pal.length]}, ${hex(pal[ig.ci % pal.length], 0.6)})`,
                        }}
                      >
                        {initialsOf(ig.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700 }}>{ig.name}</span>
                        <span style={{ fontSize: "12px", color: t.textSub }}>{ig.kind}</span>
                      </div>
                      <button
                        onClick={() => setIntegrOn((prev) => ({ ...prev, [ig.id]: !isOn }))}
                        style={{
                          position: "relative",
                          width: "46px",
                          height: "26px",
                          flexShrink: 0,
                          borderRadius: "999px",
                          border: "none",
                          cursor: "pointer",
                          background: sw(isOn).swBg,
                          transition: "background 0.25s ease",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: "3px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#fff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transform: `translateX(${sw(isOn).swX})`,
                            transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)",
                          }}
                        />
                      </button>
                    </div>
                    <div style={{ height: "1px", background: t.border }} />
                    <div style={{ display: "flex", alignItems: "center", justifyItems: "space-between", justifyContent: "space-between" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: isOn ? "#10B981" : t.textSub,
                        }}
                      >
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isOn ? "#10B981" : t.textSub }} />
                        {isOn ? "Conectado" : "Desconectado"}
                      </span>
                      <span style={{ fontSize: "11.5px", color: t.textSub }}>{isOn ? ig.sync : "Toque para conectar"}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </main>

      {/* CREATE DRAWER */}
      {drawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 75, display: "flex", justifyContent: "flex-end" }}>
          <div
            onClick={() => setDrawer(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,0.55)", backdropFilter: "blur(3px)" }}
          />
          <div
            style={{
              position: "relative",
              width: "460px",
              maxWidth: "94vw",
              height: "100%",
              background: t.cardBg,
              borderLeft: `1px solid ${t.border}`,
              boxShadow: "-24px 0 60px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "24px",
                borderBottom: `1px solid ${t.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700 }}>
                {drawerCfg[drawer].title}
              </span>
              <button
                onClick={() => setDrawer(null)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  border: `1px solid ${t.border}`,
                  background: t.inputBg,
                  color: t.textSub,
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>{drawerCfg[drawer].f1}</span>
                <input
                  value={form.f1}
                  onChange={(e) => setForm((prev) => ({ ...prev, f1: e.target.value }))}
                  placeholder={drawerCfg[drawer].f1}
                  style={{
                    height: "46px",
                    padding: "0 15px",
                    borderRadius: "11px",
                    border: `1px solid ${t.border}`,
                    background: t.inputBg,
                    color: t.text,
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>{drawerCfg[drawer].f2}</span>
                <input
                  value={form.f2}
                  onChange={(e) => setForm((prev) => ({ ...prev, f2: e.target.value }))}
                  placeholder={drawerCfg[drawer].f2ph}
                  style={{
                    height: "46px",
                    padding: "0 15px",
                    borderRadius: "11px",
                    border: `1px solid ${t.border}`,
                    background: t.inputBg,
                    color: t.text,
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
              {drawerCfg[drawer].opts && (
                <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>{drawerCfg[drawer].optLabel}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {drawerCfg[drawer].opts!.map((o) => {
                      const on = form.opt === o;
                      return (
                        <span
                          key={o}
                          onClick={() => setForm((prev) => ({ ...prev, opt: o }))}
                          style={{
                            height: "38px",
                            padding: "0 15px",
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: `1.5px solid ${on ? "#8B5CF6" : t.border}`,
                            background: on ? hex("#8B5CF6", 0.1) : t.inputBg,
                            color: on ? t.text : t.textSub,
                            transition: "all 0.16s ease",
                          }}
                        >
                          {o}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: "12px" }}>
              <button
                onClick={() => setDrawer(null)}
                style={{
                  flex: 1,
                  height: "48px",
                  borderRadius: "11px",
                  border: `1px solid ${t.border}`,
                  background: t.inputBg,
                  color: t.text,
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={submitDrawer}
                disabled={!form.f1.trim()}
                style={{
                  flex: 1.4,
                  height: "48px",
                  border: "none",
                  borderRadius: "11px",
                  background: form.f1.trim() ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : t.softBg,
                  color: form.f1.trim() ? "#fff" : t.textSub,
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: form.f1.trim() ? "pointer" : "not-allowed",
                  boxShadow: form.f1.trim() ? "0 8px 22px rgba(99,102,241,0.32)" : "none",
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL TASKS MODAL (Google Tasks Style) */}
      {tasksOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            flexDirection: "column",
            background: dark ? "#040816" : "#EEF4FF",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              height: "68px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "0 28px",
              borderBottom: `1px solid ${t.border}`,
              background: t.barBg,
            }}
          >
            <button
              onClick={() => setTasksOpen(false)}
              title="Voltar"
              style={{
                width: "40px",
                height: "40px",
                flexShrink: 0,
                borderRadius: "11px",
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                color: t.text,
                cursor: "pointer",
                fontSize: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ‹
            </button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700 }}>
                Tarefas
              </span>
              <span style={{ fontSize: "12.5px", color: t.textSub }}>
                {pendingTasks.length} pendentes · {doneTasks.length} concluídas
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 44px 32px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <form
                onSubmit={handleAddTask}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "11px",
                  height: "52px",
                  padding: "0 18px",
                  borderRadius: "14px",
                  border: `1px solid ${t.border}`,
                  background: t.softBg,
                }}
              >
                <span style={{ color: "#8B5CF6", fontSize: "20px", fontWeight: 700 }}>+</span>
                <input
                  className="infinoos-task-input"
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  placeholder="Adicionar uma tarefa..."
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: t.text,
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "15px",
                  }}
                />
              </form>

              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { key: "pending" as const, label: "Pendentes", count: pendingTasks.length },
                  { key: "done" as const, label: "Concluídas", count: doneTasks.length },
                  { key: "all" as const, label: "Todas", count: tasks.length },
                ].map((f) => {
                  const on = f.key === taskFilter;
                  return (
                    <span
                      key={f.key}
                      onClick={() => setTaskFilter(f.key)}
                      style={{
                        height: "36px",
                        padding: "0 16px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: on ? "1px solid transparent" : `1px solid ${t.border}`,
                        background: on ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : t.softBg,
                        color: on ? "#fff" : t.textSub,
                      }}
                    >
                      {f.label}
                      <span style={{ opacity: 0.7 }}>{f.count}</span>
                    </span>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredTasks.map((x) => {
                  const isFilling = !!fillingIds[x.id];
                  const isExiting = !!exitingIds[x.id];
                  const isDone = x.done || isFilling;
                  return (
                    <div
                      key={x.id}
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "13px",
                        padding: isExiting ? "0 17px" : "15px 17px",
                        maxHeight: isExiting ? "0px" : "90px",
                        opacity: isExiting ? 0 : 1,
                        transform: isExiting ? "translateX(18px) scale(0.96)" : "translateX(0) scale(1)",
                        overflow: "hidden",
                        borderRadius: "13px",
                        border: isExiting
                          ? "1px solid transparent"
                          : isFilling
                          ? "1px solid rgba(16, 185, 129, 0.45)"
                          : `1px solid ${t.border}`,
                        background: t.softBg,
                        transition: isExiting
                          ? "all 0.32s cubic-bezier(0.4, 0, 0.2, 1)"
                          : "border-color 0.25s ease",
                        boxSizing: "border-box",
                      }}
                    >
                      {/* Barra de progresso verde que enche ao clicar */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: isFilling ? "100%" : "0%",
                          background: "linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.28) 100%)",
                          borderBottom: isFilling ? "3px solid #10B981" : "3px solid transparent",
                          transition: isFilling ? "width 0.46s cubic-bezier(0.2, 0.85, 0.3, 1)" : "none",
                          pointerEvents: "none",
                          zIndex: 0,
                        }}
                      />

                      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", gap: "13px", width: "100%" }}>
                        <TaskCheckCircle
                          size={24}
                          done={isDone}
                          borderColor={t.textSub}
                          onClick={() => handleToggleTaskInModal(x.id, x.done)}
                        />
                        <span
                          style={{
                            flex: 1,
                            fontSize: "14.5px",
                            lineHeight: 1.5,
                            color: isDone ? t.textSub : t.text,
                            textDecoration: isDone ? "line-through" : "none",
                            transition: "all 0.25s ease",
                          }}
                        >
                          {x.text}
                        </span>
                        <button
                          onClick={() => setTasks((prev) => prev.filter((y) => y.id !== x.id))}
                          title="Remover"
                          style={{
                            width: "30px",
                            height: "30px",
                            flexShrink: 0,
                            borderRadius: "8px",
                            border: "none",
                            background: "transparent",
                            color: t.textSub,
                            cursor: "pointer",
                            fontSize: "14px",
                            transition: "color 0.2s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = t.textSub)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <div style={{ padding: "40px", textAlign: "center", fontSize: "14px", color: t.textSub }}>
                    {taskFilter === "done"
                      ? "Nenhuma tarefa concluída ainda."
                      : taskFilter === "pending"
                      ? "Tudo em dia — nada pendente."
                      : "Nenhuma tarefa."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Feedback Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "15px 22px",
            borderRadius: "14px",
            background: t.cardBg,
            border: "1px solid rgba(139,92,246,0.4)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.4)",
          }}
        >
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(139,92,246,0.16)",
              color: "#8B5CF6",
            }}
          >
            ✓
          </span>
          <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{toast}</span>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDel && mounted && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={() => setConfirmDel(null)} style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,0.6)", backdropFilter: "blur(4px)", animation: "paneIn 0.2s ease" }}></div>
          <div style={{ position: "relative", width: "420px", maxWidth: "94vw", borderRadius: "18px", border: `1px solid #E2E8F0`, background: '#FFFFFF', boxShadow: "0 26px 64px rgba(0,0,0,0.15)", padding: "26px", display: "flex", flexDirection: "column", gap: "16px", animation: "paneIn 0.26s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ width: "48px", height: "48px", flexShrink: 0, borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.14)", color: "#EF4444" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700, color: '#0F172A' }}>Excluir registro?</span>
                <span style={{ fontSize: "13px", color: '#64748B', lineHeight: 1.4 }}>Esta ação não pode ser desfeita.</span>
              </div>
            </div>
            
            <div style={{ padding: "14px 16px", borderRadius: "12px", background: '#F1F5F9', border: `1px solid #E2E8F0`, fontSize: "13.5px", fontWeight: 700, color: '#334155' }}>
              {confirmDel.name}
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setConfirmDel(null)} 
                style={{ flex: 1, height: "48px", borderRadius: "11px", border: `1px solid #E2E8F0`, background: '#FFFFFF', color: '#334155', fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FFFFFF'; }}
              >
                Cancelar
              </button>
              
              <button 
                onClick={confirmDeleteDep} 
                style={{ flex: 1, height: "48px", border: "none", borderRadius: "11px", background: "#EF4444", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 800, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 14px rgba(239,68,68,0.25)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 0 4px rgba(239, 68, 68, 0.25)"; e.currentTarget.style.background = "#DC2626"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(239,68,68,0.25)"; e.currentTarget.style.background = "#EF4444"; }}
              >
                {isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* NEW DEPOSITANTE FULL PAGE */}
      {depPageOpen && mounted && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: dark ? "#0F172A" : "#F8FAFC", animation: "paneIn 0.28s ease" }}>
          <div style={{ flexShrink: 0, height: "68px", display: "flex", alignItems: "center", gap: "14px", padding: "0 28px", borderBottom: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF" }}>
            <button onClick={() => setDepPageOpen(false)} title="Voltar" style={{ width: "40px", height: "40px", flexShrink: 0, borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.color = '#8B5CF6'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.text; }}>‹</button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: t.textSub }}><span>Configurações</span><span>›</span><span>Depositantes</span><span>›</span><span style={{ color: t.text, fontWeight: 600 }}>{depEditId ? "Editar" : "Novo"}</span></div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700 }}>{depEditId ? "Editar depositante" : "Novo depositante"}</span>
            </div>
            <button onClick={() => setDepPageOpen(false)} style={{ height: "44px", padding: "0 18px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#8B5CF6'} onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}>Cancelar</button>
            <button onClick={submitDepPage} disabled={!depForm.fantasia.trim() || !depForm.cnpj.trim() || isPending} style={{ height: "44px", padding: "0 22px", border: "none", borderRadius: "11px", background: (!depForm.fantasia.trim() || !depForm.cnpj.trim()) ? "rgba(139,92,246,0.3)" : "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: (!depForm.fantasia.trim() || !depForm.cnpj.trim()) ? "rgba(255,255,255,0.5)" : "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 800, cursor: (!depForm.fantasia.trim() || !depForm.cnpj.trim()) ? "not-allowed" : "pointer", boxShadow: (!depForm.fantasia.trim() || !depForm.cnpj.trim()) ? "none" : "0 8px 22px rgba(139,92,246,0.3)" }}>{isPending ? "Salvando..." : "Salvar depositante"}</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 44px 32px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: "860px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF", padding: "24px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>Identificação</span>
                <div style={{ display: "flex", gap: "22px", marginTop: "18px" }}>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
                    {depLogo ? (
                      <>
                        <div style={{ width: "110px", height: "110px", borderRadius: "18px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: t.inputBg, border: `1px solid ${t.border}` }}>
                          <img src={depLogo} alt="Logotipo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <button onClick={() => setDepLogo(null)} style={{ height: "34px", padding: "0 14px", borderRadius: "9px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontFamily: "'Manrope', sans-serif", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>Remover logotipo</button>
                      </>
                    ) : (
                      <>
                        <label style={{ width: "110px", height: "110px", borderRadius: "18px", border: `1.5px dashed ${t.border}`, background: t.inputBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "7px", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#8B5CF6'} onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}>
                          <input type="file" accept="image/png, image/jpeg" style={{ display: "none" }} onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setDepLogo(URL.createObjectURL(e.target.files[0]));
                            }
                          }} />
                          <span style={{ color: "#8B5CF6", display: "flex" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: t.textSub, textAlign: "center", lineHeight: 1.3 }}>Logotipo</span>
                        </label>
                        <span style={{ fontSize: "11px", color: t.textSub, textAlign: "center", maxWidth: "120px", lineHeight: 1.4 }}>PNG ou JPG, quadrado</span>
                      </>
                    )}
                  </div>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Código</span>
                      <input value={depForm.codigo} onChange={(e) => setDepForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="DEP-000" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Nome fantasia</span>
                      <input value={depForm.fantasia} onChange={(e) => setDepForm((p) => ({ ...p, fantasia: e.target.value }))} placeholder="Nome fantasia" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "7px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Razão social</span>
                      <input value={depForm.razao} onChange={(e) => setDepForm((p) => ({ ...p, razao: e.target.value }))} placeholder="Razão social completa" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>CNPJ</span>
                      <input value={depForm.cnpj} onChange={(e) => setDepForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF", padding: "24px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>Endereço fiscal</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "14px", marginTop: "18px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>CEP</span>
                    <input value={depForm.cep} onChange={(e) => setDepForm((p) => ({ ...p, cep: e.target.value }))} placeholder="00000-000" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Logradouro</span>
                    <input value={depForm.rua} onChange={(e) => setDepForm((p) => ({ ...p, rua: e.target.value }))} placeholder="Rua, avenida..." style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Número</span>
                    <input value={depForm.num} onChange={(e) => setDepForm((p) => ({ ...p, num: e.target.value }))} placeholder="000" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Bairro</span>
                    <input value={depForm.bairro} onChange={(e) => setDepForm((p) => ({ ...p, bairro: e.target.value }))} placeholder="Bairro" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Cidade</span>
                    <input value={depForm.cidade} onChange={(e) => setDepForm((p) => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>UF</span>
                    <input value={depForm.uf} onChange={(e) => setDepForm((p) => ({ ...p, uf: e.target.value }))} placeholder="SP" style={{ height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>Telefones</span>
                    <span onClick={() => setDepPhones([...depPhones, ""])} style={{ fontSize: "12.5px", fontWeight: 700, color: "#8B5CF6", cursor: "pointer" }}>+ Adicionar</span>
                  </div>
                  {depPhones.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <input value={p} onChange={(e) => setDepPhones((prev) => prev.map((item, idx) => (idx === i ? e.target.value : item)))} placeholder="(00) 00000-0000" style={{ flex: 1, height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#8B5CF6'} onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border} />
                      <button onClick={() => setDepPhones((prev) => prev.filter((_, idx) => idx !== i))} style={{ width: "40px", height: "46px", flexShrink: 0, borderRadius: "10px", border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#EF4444'; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>E-mails</span>
                    <span onClick={() => setDepEmails([...depEmails, ""])} style={{ fontSize: "12.5px", fontWeight: 700, color: "#8B5CF6", cursor: "pointer" }}>+ Adicionar</span>
                  </div>
                  {depEmails.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <input value={e} onChange={(evt) => setDepEmails((prev) => prev.map((item, idx) => (idx === i ? evt.target.value : item)))} placeholder="contato@empresa.com" style={{ flex: 1, height: "46px", padding: "0 15px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} onMouseEnter={(evt) => evt.currentTarget.style.borderColor = '#8B5CF6'} onMouseLeave={(evt) => evt.currentTarget.style.borderColor = t.border} />
                      <button onClick={() => setDepEmails((prev) => prev.filter((_, idx) => idx !== i))} style={{ width: "40px", height: "46px", flexShrink: 0, borderRadius: "10px", border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }} onMouseEnter={(evt) => { evt.currentTarget.style.color = '#EF4444'; evt.currentTarget.style.borderColor = '#EF4444'; }} onMouseLeave={(evt) => { evt.currentTarget.style.color = t.textSub; evt.currentTarget.style.borderColor = t.border; }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: dark ? "#1E293B" : "#FFFFFF", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700 }}>Método de retirada</span>
                  <span style={{ fontSize: "13px", color: t.textSub }}>Como a mercadoria deste depositante deixa o CD.</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {[
                    { id: "FEFO", name: "FEFO (Validade)", desc: "Primeiro que vence é o primeiro que sai. Essencial para controle de perecíveis." },
                    { id: "FIFO", name: "FIFO (Entrada)", desc: "Primeiro que entra é o primeiro que sai. Foco na ordem cronológica de chegada." },
                    { id: "LIFO", name: "LIFO (Recente)", desc: "Último que entra é o primeiro que sai. Raro, usado para otimização de espaço rápido." }
                  ].map((m) => {
                    const active = depMethod === m.id;
                    const bColor = active ? "#8B5CF6" : t.border;
                    const bgColor = active ? (dark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.04)") : "transparent";
                    const tColor = active ? (dark ? "#A78BFA" : "#6D28D9") : t.text;
                    return (
                      <div key={m.id} onClick={() => setDepMethod(m.id)} style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "16px", borderRadius: "13px", border: `1.5px solid ${bColor}`, background: bgColor, cursor: "pointer", transition: "all 0.16s ease" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: tColor }}>{m.name}</span>
                        <span style={{ fontSize: "12px", color: t.textSub, lineHeight: 1.4 }}>{m.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
