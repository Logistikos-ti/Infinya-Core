"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, Check, Loader2, X } from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { criarTarefaAction, alternarTarefaAction, excluirTarefaAction } from "./tarefas-actions";

export type TarefaRow = {
  id: string;
  texto: string;
  concluida: boolean;
};

// Valores exatos extraidos do tema do mockup (t.border / t.inputBg / t.softBg /
// t.text / t.textSub, claro e escuro) -- ver rpc-grant-verification-style
// comment: nao aproximar pela paleta padrao do Tailwind, usar o valor real.
const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenSoftBg = "bg-[rgba(100,116,139,0.05)] dark:bg-[rgba(148,163,184,0.06)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const activeFilterBg = "linear-gradient(92deg,#3B82F6,#8B5CF6)";

type Filter = "pending" | "done" | "all";

function AddTaskForm({
  onAdded,
  surface = "input",
}: {
  onAdded: (task: TarefaRow) => void;
  surface?: "input" | "card";
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const texto = value.trim();
    if (!texto || isPending) return;

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("texto", texto);
      const result = await criarTarefaAction(formData);
      if (result.error || !result.task) {
        setError(result.error ?? "Não foi possível adicionar a tarefa.");
        return;
      }
      onAdded({ id: result.task.id, texto: result.task.texto, concluida: false });
      setValue("");
    });
  }

  const big = surface === "card";

  return (
    <form onSubmit={handleSubmit}>
      <div
        className={`flex items-center rounded-xl border ${tokenBorder} ${big ? tokenCardBg : tokenInputBg} ${
          big ? "h-[52px] gap-3 px-4" : "h-11 gap-2.5 px-3.5"
        }`}
      >
        <span className={`font-bold text-violet-600 dark:text-violet-400 ${big ? "text-xl" : "text-lg"}`}>+</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          placeholder="Adicionar tarefa..."
          className={`flex-1 bg-transparent outline-none placeholder:text-[#64748B] dark:placeholder:text-[#8695AD] disabled:cursor-not-allowed ${tokenText} ${
            big ? "text-[15px]" : "text-[13.5px]"
          }`}
        />
        {isPending ? (
          <Loader2 className={`shrink-0 animate-spin ${tokenTextSub} ${big ? "h-5 w-5" : "h-4 w-4"}`} />
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-sm text-red-500">{error}</p> : null}
    </form>
  );
}

function CompactTaskRow({ task, onToggle }: { task: TarefaRow; onToggle: (id: string, concluida: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function handleComplete() {
    setHidden(true);
    startTransition(async () => {
      await alternarTarefaAction(task.id, true);
      onToggle(task.id, true);
    });
  }

  if (hidden) return null;

  return (
    <div className={`flex items-center gap-[11px] rounded-xl border px-3.5 py-[13px] text-[13px] leading-[1.45] ${tokenBorder} ${tokenSoftBg} text-slate-700 dark:text-slate-200`}>
      <button
        type="button"
        title="Concluir"
        onClick={handleComplete}
        disabled={isPending}
        className="group/check flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[#8695AD] text-transparent transition-colors hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="h-3 w-3 opacity-0 transition-opacity group-hover/check:opacity-100" strokeWidth={3} />
      </button>
      <span className="flex-1">{task.texto}</span>
    </div>
  );
}

function FullTaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: TarefaRow;
  onToggle: (id: string, concluida: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const [isToggling, startToggle] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  function handleToggle() {
    const next = !task.concluida;
    startToggle(async () => {
      await alternarTarefaAction(task.id, next);
      onToggle(task.id, next);
    });
  }

  function handleRemove() {
    startRemove(async () => {
      await excluirTarefaAction(task.id);
      onRemove(task.id);
    });
  }

  return (
    <div className={`flex items-center gap-3.5 rounded-xl border px-4 py-4 text-[15px] leading-[1.5] ${tokenBorder} ${tokenCardBg}`}>
      <button
        type="button"
        title={task.concluida ? "Reabrir" : "Concluir"}
        onClick={handleToggle}
        disabled={isToggling}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          task.concluida
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-[#8695AD] text-transparent hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
        }`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <span className={`flex-1 ${task.concluida ? `${tokenTextSub} line-through` : "text-slate-700 dark:text-slate-200"}`}>
        {task.texto}
      </span>
      <button
        type="button"
        title="Remover"
        onClick={handleRemove}
        disabled={isRemoving}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 ${tokenTextSub}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TarefasFullScreen({
  tasks,
  onToggle,
  onRemove,
  onAdded,
  onClose,
}: {
  tasks: TarefaRow[];
  onToggle: (id: string, concluida: boolean) => void;
  onRemove: (id: string) => void;
  onAdded: (task: TarefaRow) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("pending");

  const pending = useMemo(() => tasks.filter((task) => !task.concluida), [tasks]);
  const done = useMemo(() => tasks.filter((task) => task.concluida), [tasks]);
  const filtered = filter === "pending" ? pending : filter === "done" ? done : tasks;

  const filterDefs: Array<{ key: Filter; label: string; count: number }> = [
    { key: "pending", label: "Pendentes", count: pending.length },
    { key: "done", label: "Concluídas", count: done.length },
    { key: "all", label: "Todas", count: tasks.length },
  ];

  const emptyMessage =
    filter === "done"
      ? "Nenhuma tarefa concluída ainda."
      : filter === "pending"
        ? "Tudo em dia — nada pendente."
        : "Nenhuma tarefa.";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#F5F7FB] dark:bg-[#0A1120]">
      <div className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b bg-white px-[28px] dark:bg-[#0C1424] ${tokenBorder}`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col gap-[1px]">
          <h2 className={`${FIN_HEADING} text-[18px] font-bold ${tokenText}`}>Tarefas</h2>
          <p className={`text-[12.5px] ${tokenTextSub}`}>
            {pending.length} pendente{pending.length === 1 ? "" : "s"} · {done.length} concluída{done.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[960px] flex-1 px-8 py-8">
        <AddTaskForm onAdded={onAdded} surface="card" />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {filterDefs.map((def) => {
            const active = def.key === filter;
            return (
              <button
                key={def.key}
                type="button"
                onClick={() => setFilter(def.key)}
                className={
                  active
                    ? "inline-flex h-9 items-center gap-[7px] rounded-[10px] border border-transparent px-4 text-[13px] font-bold text-white transition"
                    : `inline-flex h-9 items-center gap-[7px] rounded-[10px] border px-4 text-[13px] font-bold transition hover:bg-slate-100 dark:hover:bg-white/5 ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`
                }
                style={active ? { background: activeFilterBg } : undefined}
              >
                <span>{def.label}</span>
                <span className="opacity-70">{def.count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          {filtered.length ? (
            filtered.map((task) => <FullTaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} />)
          ) : (
            <p className={`py-12 text-center text-base ${tokenTextSub}`}>{emptyMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TarefasPanel({ initialTasks }: { initialTasks: TarefaRow[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showModal, setShowModal] = useState(false);

  function handleToggle(id: string, concluida: boolean) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, concluida } : task)),
    );
  }

  function handleRemove(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function handleAdded(task: TarefaRow) {
    setTasks((current) => [task, ...current]);
  }

  const pending = tasks.filter((task) => !task.concluida);
  const visiblePending = pending.slice(0, 4);
  const pendingLabel =
    pending.length === 0 ? "Nenhuma pendente" : pending.length === 1 ? "1 tarefa pendente" : `${pending.length} tarefas pendentes`;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Tarefas</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pendingLabel}</p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
          {pending.length}
        </span>
      </div>

      <div className="mt-4">
        <AddTaskForm onAdded={handleAdded} />
      </div>

      <div className="mt-3.5 grid gap-2.5">
        {visiblePending.length ? (
          visiblePending.map((task) => <CompactTaskRow key={task.id} task={task} onToggle={handleToggle} />)
        ) : (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Tudo em dia — nada pendente.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`mt-3.5 w-full rounded-[11px] border py-2 text-[13px] font-bold transition hover:bg-slate-100 dark:hover:bg-white/5 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
      >
        Ver mais
      </button>

      {showModal ? (
        <TarefasFullScreen
          tasks={tasks}
          onToggle={handleToggle}
          onRemove={handleRemove}
          onAdded={handleAdded}
          onClose={() => setShowModal(false)}
        />
      ) : null}
    </>
  );
}
