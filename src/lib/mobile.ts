import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardCheck,
  House,
  LogOut,
  PackageCheck,
  ScanLine,
  Settings2,
} from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import {
  canAccessConfigSection,
  canAccessModule,
  isCatalogAndStockOperatorUser,
  isProductCatalogOnlyUser,
} from "@/lib/permissions";

export type MobileNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[];
};

export function getDefaultMobileRoute(user: AppUserContext) {
  if (isProductCatalogOnlyUser(user)) {
    return "/m/inicio";
  }

  if (isCatalogAndStockOperatorUser(user)) {
    return "/m/inicio";
  }

  if (canAccessModule(user, "expedicao")) {
    return "/m/inicio";
  }

  if (canAccessModule(user, "recebimento")) {
    return "/m/recebimento";
  }

  if (canAccessModule(user, "estoque")) {
    return "/m/inicio";
  }

  return "/dashboard";
}

export function getMobileWelcomeLabel(user: AppUserContext) {
  if (user.papel === "OPERADOR") {
    return "Operacao em campo";
  }

  if (user.papel === "DEPOSITANTE") {
    return "Consulta operacional";
  }

  return "Controle movel";
}

export function getMobileNavigationItems(user: AppUserContext): MobileNavigationItem[] {
  if (isProductCatalogOnlyUser(user)) {
    return [
      { href: "/m/inicio", label: "Inicio", icon: House, match: ["/m/inicio"] },
      {
        href: "/configuracoes/produtos",
        label: "Produtos",
        icon: Settings2,
        match: ["/configuracoes", "/configuracoes/produtos"],
      },
      { href: "/m/sair", label: "Sair", icon: LogOut, match: ["/m/sair"] },
    ];
  }

  if (isCatalogAndStockOperatorUser(user)) {
    return [
      { href: "/m/inicio", label: "Inicio", icon: House, match: ["/m/inicio"] },
      { href: "/estoque", label: "Estoque", icon: Boxes, match: ["/estoque"] },
      {
        href: "/configuracoes/produtos",
        label: "Produtos",
        icon: Settings2,
        match: ["/configuracoes", "/configuracoes/produtos"],
      },
      { href: "/m/sair", label: "Sair", icon: LogOut, match: ["/m/sair"] },
    ];
  }

  const items: MobileNavigationItem[] = [];

  if (
    canAccessModule(user, "dashboard") ||
    canAccessModule(user, "recebimento") ||
    canAccessModule(user, "expedicao") ||
    canAccessModule(user, "estoque")
  ) {
    items.push({ href: "/m/inicio", label: "Inicio", icon: House, match: ["/m/inicio"] });
  }

  if (canAccessModule(user, "recebimento")) {
    items.push({
      href: "/m/recebimento",
      label: "Receb.",
      icon: PackageCheck,
      match: ["/m/recebimento"],
    });
  }

  if (canAccessModule(user, "expedicao")) {
    items.push({
      href: "/m/separacao",
      label: "Separ.",
      icon: ScanLine,
      match: ["/m/separacao"],
    });
    items.push({
      href: "/m/conferencia",
      label: "Conf.",
      icon: ClipboardCheck,
      match: ["/m/conferencia"],
    });
  }

  if (canAccessModule(user, "estoque")) {
    items.push({ href: "/estoque", label: "Estoque", icon: Boxes, match: ["/estoque"] });
  }

  if (canAccessModule(user, "configuracoes") && canAccessConfigSection(user, "produtos")) {
    items.push({
      href: "/configuracoes/produtos",
      label: "Produtos",
      icon: Settings2,
      match: ["/configuracoes", "/configuracoes/produtos"],
    });
  }

  return items;
}
