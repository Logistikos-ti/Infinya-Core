import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardCheck,
  FileText,
  House,
  LogOut,
  PackageCheck,
  ScanLine,
  Settings2,
  Warehouse,
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

export type MobileNavigationGroups = {
  primary: MobileNavigationItem[];
  secondary: MobileNavigationItem[];
};

export function getDefaultMobileRoute(user: AppUserContext) {
  if (isProductCatalogOnlyUser(user)) {
    return "/m/inicio";
  }

  if (isCatalogAndStockOperatorUser(user)) {
    if (canAccessModule(user, "expedicao")) {
      return "/m/inicio";
    }

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
    return "Operação em campo";
  }

  if (user.papel === "DEPOSITANTE") {
    return "Consulta operacional";
  }

  return "Controle móvel";
}

export function getMobileNavigationItems(user: AppUserContext): MobileNavigationItem[] {
  if (isProductCatalogOnlyUser(user)) {
    return [
      { href: "/m/inicio", label: "Início", icon: House, match: ["/m/inicio"] },
      {
        href: "/m/produtos",
        label: "Produtos",
        icon: Settings2,
        match: ["/m/produtos"],
      },
      { href: "/m/sair", label: "Sair", icon: LogOut, match: ["/m/sair"] },
    ];
  }

  if (isCatalogAndStockOperatorUser(user)) {
    return [
      { href: "/m/inicio", label: "Início", icon: House, match: ["/m/inicio"] },
      ...(canAccessModule(user, "recebimento")
        ? [{ href: "/m/recebimento", label: "Recebimento", icon: PackageCheck, match: ["/m/recebimento"] } satisfies MobileNavigationItem]
        : []),
      ...(canAccessModule(user, "expedicao")
        ? [{ href: "/m/separacao", label: "Separação", icon: ScanLine, match: ["/m/separacao", "/m/conferencia"] } satisfies MobileNavigationItem]
        : []),
      ...(canAccessModule(user, "estoque")
        ? [{ href: "/m/estoque", label: "Inventário", icon: Boxes, match: ["/m/estoque", "/m/inventario"] } satisfies MobileNavigationItem]
        : []),
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
    items.push({ href: "/m/inicio", label: "Início", icon: House, match: ["/m/inicio"] });
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
    items.push({ href: "/m/estoque", label: "Estoque", icon: Boxes, match: ["/m/estoque"] });
  }

  if (canAccessModule(user, "romaneio")) {
    items.push({
      href: "/m/romaneio",
      label: "Romaneio",
      icon: FileText,
      match: ["/m/romaneio"],
    });
  }

  if (canAccessModule(user, "configuracoes") && canAccessConfigSection(user, "produtos")) {
    items.push({
      href: "/m/produtos",
      label: "Produtos",
      icon: Settings2,
      match: ["/m/produtos"],
    });
  }

  if (canAccessModule(user, "configuracoes") && canAccessConfigSection(user, "enderecos")) {
    items.push({
      href: "/m/enderecos",
      label: "Endereços",
      icon: Warehouse,
      match: ["/m/enderecos"],
    });
  }

  return items;
}

export function getMobileNavigationGroups(user: AppUserContext): MobileNavigationGroups {
  const allItems = getMobileNavigationItems(user);
  const primaryHrefs = new Set(["/m/inicio", "/m/separacao", "/m/produtos", "/m/sair"]);

  const primary = allItems.filter((item) => primaryHrefs.has(item.href));
  const secondary = allItems.filter((item) => !primaryHrefs.has(item.href));

  return { primary, secondary };
}
