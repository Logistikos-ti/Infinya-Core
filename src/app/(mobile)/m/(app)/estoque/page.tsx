import Link from "next/link";
import { Boxes, ClipboardList, MoveRight, PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";

const actionCards = [
  {
    href: "/m/estoque/saldo-inicial",
    title: "Lancar estoque inicial",
    description: "Bipe endereco e produto para registrar a primeira carga de saldo.",
    icon: PlusCircle,
    tone: "from-cyan-500/20 to-sky-500/10 text-cyan-200",
  },
  {
    href: "/m/estoque/movimentacao-interna",
    title: "Movimentacao interna",
    description: "Transfira saldo entre enderecos com rastreabilidade completa.",
    icon: MoveRight,
    tone: "from-violet-500/20 to-fuchsia-500/10 text-violet-200",
  },
  {
    href: "/m/estoque/inventarios",
    title: "Inventario ciclico",
    description: "Abra contagens cegas, registre divergencias e segunda conferencia.",
    icon: ClipboardList,
    tone: "from-amber-500/20 to-orange-500/10 text-amber-200",
  },
];

export default async function MobileEstoquePage() {
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-sky-500 via-sky-600 to-slate-950 p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
          Estoque operacional
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Fluxos do estoque</h1>
        <p className="mt-2 text-sm leading-6 text-slate-100/90">
          Escolha a acao que deseja executar no armazem para manter o fluxo mais limpo e rapido no
          celular.
        </p>
      </section>

      <section className="space-y-3">
        {actionCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur transition hover:bg-white/7"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{card.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{card.description}</p>
                </div>
                <div className={`rounded-2xl bg-gradient-to-br p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <Link
        href="/estoque"
        className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300 transition hover:bg-white/7"
      >
        <span className="inline-flex items-center gap-2 font-medium text-white">
          <Boxes className="h-4 w-4" />
          Abrir consulta completa do estoque
        </span>
        <span>Web</span>
      </Link>
    </div>
  );
}
