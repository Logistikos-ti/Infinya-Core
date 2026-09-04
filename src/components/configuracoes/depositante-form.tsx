"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Upload, X } from "lucide-react";
import { saveDepositanteAction } from "@/app/(dashboard)/configuracoes/depositantes/actions";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import type { EmailContato, MetodoRetirada, TelefoneContato } from "@/lib/depositantes";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";
const cardClass = `rounded-2xl border ${tokenBorder} ${tokenCardBg} p-6`;
const inputClass = `h-[46px] w-full rounded-full border px-[15px] text-sm outline-none transition ${tokenBorder} ${tokenInputBg} ${tokenText}`;

type DepositanteFormProps = {
  defaultValues?: {
    id?: string;
    codigo?: string;
    nome?: string;
    razaoSocial?: string;
    cnpj?: string;
    logoUrl?: string | null;
    logoStoragePath?: string | null;
    enderecoFiscalCep?: string;
    enderecoFiscalLogradouro?: string;
    enderecoFiscalNumero?: string;
    enderecoFiscalComplemento?: string;
    enderecoFiscalBairro?: string;
    enderecoFiscalCidade?: string;
    enderecoFiscalUf?: string;
    emailsContato?: EmailContato[];
    telefonesContato?: TelefoneContato[];
    observacoes?: string;
    ativo?: boolean;
    metodoRetiradaPadrao?: MetodoRetirada;
    exigeLotePadrao?: boolean;
    exigeValidadePadrao?: boolean;
    permiteFracionamento?: boolean;
    diasMinimosValidade?: number;
    prefixoRecebimento?: string;
  };
  onClose?: () => void;
};

const metodoOptions: Array<{ key: MetodoRetirada; nome: string; desc: string }> = [
  { key: "FEFO", nome: "FEFO", desc: "Primeiro que vence, primeiro que sai" },
  { key: "FIFO", nome: "FIFO", desc: "Primeiro que entra, primeiro que sai" },
  { key: "LIFO", nome: "LIFO", desc: "Último que entra, primeiro que sai" },
];

export function DepositanteForm({ defaultValues, onClose }: DepositanteFormProps) {
  const initialState = {
    success: false,
    message: null,
  };

  const isEdit = Boolean(defaultValues?.id);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(defaultValues?.logoUrl?.trim() ?? "");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [telefonesContato, setTelefonesContato] = useState<TelefoneContato[]>(
    defaultValues?.telefonesContato?.length
      ? defaultValues.telefonesContato
      : [{ nome: "", telefone: "" }],
  );
  const [emailsContato, setEmailsContato] = useState<EmailContato[]>(
    defaultValues?.emailsContato?.length ? defaultValues.emailsContato : [{ email: "" }],
  );
  const [metodoRetiradaPadrao, setMetodoRetiradaPadrao] = useState<MetodoRetirada>(
    defaultValues?.metodoRetiradaPadrao ?? "FEFO",
  );
  const [state, formAction, isPending] = useActionState(saveDepositanteAction, initialState);

  const hasCurrentLogo = useMemo(() => Boolean(logoPreviewUrl), [logoPreviewUrl]);

  useEffect(() => {
    if (state.success && onClose) {
      onClose();
    }
  }, [state.success, onClose]);

  return (
    <form action={formAction} className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b bg-white px-[28px] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
          </button>
        ) : (
          <Link
            href="/configuracoes/depositantes"
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <span>Configurações</span>
            <span>›</span>
            <span>Depositantes</span>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>{isEdit ? "Editar" : "Novo"}</span>
          </div>
          <span className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>
            {isEdit ? "Editar depositante" : "Novo depositante"}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={`flex h-11 shrink-0 items-center rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            Cancelar
          </button>
        ) : (
          <Link
            href="/configuracoes/depositantes"
            className={`flex h-11 shrink-0 items-center rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <span className={tokenText}>Cancelar</span>
          </Link>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="depositante-save-btn flex h-11 shrink-0 items-center gap-2 rounded-full px-[22px] text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isPending ? <MobileButtonSpinner /> : isEdit ? "Salvar alterações" : "Salvar depositante"}
        </button>
      </header>

      {/* Mesmo efeito de hover do botão "Quero ver funcionando" da
          apresentação: gradiente desliza, o botão sobe com uma pequena
          mola e ganha um brilho embaixo. */}
      <style jsx>{`
        .depositante-save-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 220% 100%;
          background-position: 0% 50%;
          box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
          transition:
            background-position 0.6s ease,
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease;
        }
        .depositante-save-btn:hover:not(:disabled) {
          background-position: 100% 50%;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
        }
      `}</style>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-[18px]">
          <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
          <input type="hidden" name="isOverlay" value={onClose ? "true" : "false"} />
          <input type="hidden" name="currentLogoUrl" value={defaultValues?.logoUrl ?? ""} />
          <input
            type="hidden"
            name="currentLogoStoragePath"
            value={defaultValues?.logoStoragePath ?? ""}
          />

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Identificação</span>
            <div className="mt-[18px] flex flex-col gap-5 sm:flex-row sm:gap-[22px]">
              <div className="flex shrink-0 flex-col items-center gap-2.5">
                <label
                  className={`flex h-[110px] w-[110px] cursor-pointer flex-col items-center justify-center gap-[7px] overflow-hidden rounded-full border-[1.5px] ${
                    hasCurrentLogo ? `border-solid ${tokenBorder}` : "border-dashed border-[rgba(148,163,184,0.14)]"
                  } ${tokenInputBg}`}
                >
                  {hasCurrentLogo ? (
                    <Image
                      src={logoPreviewUrl}
                      alt="Logo do depositante"
                      width={110}
                      height={110}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-[#8B5CF6]" />
                      <span className={`text-center text-[11px] font-bold leading-tight ${tokenTextSub}`}>
                        Logotipo
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    name="logoFile"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setRemoveLogo(false);
                      setLogoPreviewUrl(URL.createObjectURL(file));
                    }}
                  />
                </label>
                <span className={`max-w-[120px] text-center text-[11px] leading-[1.4] ${tokenTextSub}`}>
                  PNG ou JPG, quadrado
                </span>
                {hasCurrentLogo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveLogo(true);
                      setLogoPreviewUrl("");
                    }}
                    className="text-[11px] font-bold text-[#EF4444]"
                  >
                    Remover logotipo
                  </button>
                ) : null}
                <input type="checkbox" name="removeLogo" checked={removeLogo} readOnly className="hidden" />
                {state.errors?.logoFile ? (
                  <span className="text-center text-xs text-[#EF4444]">{state.errors.logoFile}</span>
                ) : null}
              </div>

              <div className="grid flex-1 grid-cols-1 gap-3.5 sm:grid-cols-[1fr_2fr]">
                <FormField
                  label="Código"
                  name="codigo"
                  defaultValue={defaultValues?.codigo ?? ""}
                  placeholder="DEP-000"
                  error={state.errors?.codigo}
                  mono
                />
                <FormField
                  label="Nome fantasia"
                  name="nome"
                  defaultValue={defaultValues?.nome ?? ""}
                  placeholder="Nome fantasia"
                  error={state.errors?.nome}
                />
                <div className="sm:col-span-2">
                  <FormField
                    label="Razão social"
                    name="razaoSocial"
                    defaultValue={defaultValues?.razaoSocial ?? ""}
                    placeholder="Razão social completa"
                    error={state.errors?.razaoSocial}
                  />
                </div>
                <FormField
                  label="CNPJ"
                  name="cnpj"
                  defaultValue={defaultValues?.cnpj ?? ""}
                  placeholder="00.000.000/0001-00"
                  error={state.errors?.cnpj}
                  mono
                />
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Endereço fiscal</span>
            <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_2fr_1fr]">
              <FormField
                label="CEP"
                name="enderecoFiscalCep"
                defaultValue={defaultValues?.enderecoFiscalCep ?? ""}
                placeholder="00000-000"
                error={state.errors?.enderecoFiscalCep}
                mono
              />
              <FormField
                label="Logradouro"
                name="enderecoFiscalLogradouro"
                defaultValue={defaultValues?.enderecoFiscalLogradouro ?? ""}
                placeholder="Rua, avenida..."
                error={state.errors?.enderecoFiscalLogradouro}
              />
              <FormField
                label="Número"
                name="enderecoFiscalNumero"
                defaultValue={defaultValues?.enderecoFiscalNumero ?? ""}
                placeholder="000"
                error={state.errors?.enderecoFiscalNumero}
                mono
              />
              <FormField
                label="Bairro"
                name="enderecoFiscalBairro"
                defaultValue={defaultValues?.enderecoFiscalBairro ?? ""}
                placeholder="Bairro"
                error={state.errors?.enderecoFiscalBairro}
              />
              <FormField
                label="Cidade"
                name="enderecoFiscalCidade"
                defaultValue={defaultValues?.enderecoFiscalCidade ?? ""}
                placeholder="Cidade"
                error={state.errors?.enderecoFiscalCidade}
              />
              <FormField
                label="UF"
                name="enderecoFiscalUf"
                defaultValue={defaultValues?.enderecoFiscalUf ?? ""}
                placeholder="SP"
                error={state.errors?.enderecoFiscalUf}
                mono
              />
              <input
                type="hidden"
                name="enderecoFiscalComplemento"
                value={defaultValues?.enderecoFiscalComplemento ?? ""}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <section className={`${cardClass} flex flex-col gap-3.5`}>
              <div className="flex items-center justify-between">
                <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Telefones</span>
                <button
                  type="button"
                  onClick={() =>
                    setTelefonesContato((current) => [...current, { nome: "", telefone: "" }])
                  }
                  className="text-[12.5px] font-bold text-[#8B5CF6]"
                >
                  + Adicionar
                </button>
              </div>
              {telefonesContato.map((contato, index) => (
                <div key={`telefone-${index}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-[9px]">
                  <input
                    type="text"
                    name="contatoTelefoneNome"
                    defaultValue={contato.nome}
                    placeholder="Responsável"
                    className={`${inputClass} sm:w-[38%]`}
                  />
                  <div className="flex items-center gap-[9px]">
                    <input
                      type="text"
                      name="contatoTelefone"
                      defaultValue={contato.telefone}
                      placeholder="(00) 00000-0000"
                      className={`${inputClass} ${monoFont} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTelefonesContato((current) =>
                          current.length === 1
                            ? [{ nome: "", telefone: "" }]
                            : current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className={`group flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
                    >
                      <X className={`h-3.5 w-3.5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenTextSub}`} />
                    </button>
                  </div>
                </div>
              ))}
              {state.errors?.contatosTelefone ? (
                <span className="text-xs text-[#EF4444]">{state.errors.contatosTelefone}</span>
              ) : null}
            </section>

            <section className={`${cardClass} flex flex-col gap-3.5`}>
              <div className="flex items-center justify-between">
                <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>E-mails</span>
                <button
                  type="button"
                  onClick={() => setEmailsContato((current) => [...current, { email: "" }])}
                  className="text-[12.5px] font-bold text-[#8B5CF6]"
                >
                  + Adicionar
                </button>
              </div>
              {emailsContato.map((contato, index) => (
                <div key={`email-${index}`} className="flex items-center gap-[9px]">
                  <input
                    type="email"
                    name="contatoEmail"
                    defaultValue={contato.email}
                    placeholder="contato@empresa.com"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEmailsContato((current) =>
                        current.length === 1
                          ? [{ email: "" }]
                          : current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className={`group flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
                  >
                    <X className={`h-3.5 w-3.5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenTextSub}`} />
                  </button>
                </div>
              ))}
              {state.errors?.contatosEmail ? (
                <span className="text-xs text-[#EF4444]">{state.errors.contatosEmail}</span>
              ) : null}
            </section>
          </div>

          <section className={`${cardClass} flex flex-col gap-3.5`}>
            <div className="flex flex-col gap-1">
              <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Método de retirada</span>
              <span className={`text-[13px] ${tokenTextSub}`}>Como a mercadoria deste depositante deixa o CD.</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {metodoOptions.map((option) => {
                const active = option.key === metodoRetiradaPadrao;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMetodoRetiradaPadrao(option.key)}
                    className={`flex flex-col gap-[5px] rounded-[13px] border-[1.5px] p-4 text-left transition ${
                      active
                        ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.1)]"
                        : `${tokenBorder} ${tokenInputBg}`
                    }`}
                  >
                    <span className={`text-sm font-bold ${tokenText}`}>{option.nome}</span>
                    <span className={`text-xs leading-[1.4] ${tokenTextSub}`}>{option.desc}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="metodoRetiradaPadrao" value={metodoRetiradaPadrao} />
          </section>

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Parâmetros operacionais</span>
            <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FormField
                label="Prefixo de recebimento"
                name="prefixoRecebimento"
                defaultValue={defaultValues?.prefixoRecebimento ?? ""}
                placeholder="Ex.: REC"
                error={state.errors?.prefixoRecebimento}
                mono
              />
              <FormField
                label="Dias mínimos de validade"
                name="diasMinimosValidade"
                type="number"
                defaultValue={String(defaultValues?.diasMinimosValidade ?? 0)}
                error={state.errors?.diasMinimosValidade}
                mono
              />
            </div>
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleSwitchField
                name="exigeLotePadrao"
                label="Exigir lote por padrão"
                description="Novos recebimentos já nascem com conferência de lote habilitada."
                defaultChecked={defaultValues?.exigeLotePadrao ?? true}
              />
              <ToggleSwitchField
                name="exigeValidadePadrao"
                label="Exigir validade por padrão"
                description="Aplica controle de validade e suporte ao FEFO quando necessário."
                defaultChecked={defaultValues?.exigeValidadePadrao ?? true}
              />
              <ToggleSwitchField
                name="permiteFracionamento"
                label="Permitir fracionamento"
                description="Autoriza separação e movimentação fracionada para o cliente."
                defaultChecked={defaultValues?.permiteFracionamento ?? false}
              />
              <ToggleSwitchField
                name="ativo"
                label="Depositante ativo"
                description="Mantém disponível para novos produtos, usuários e pedidos."
                defaultChecked={defaultValues?.ativo ?? true}
              />
            </div>
          </section>

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Observações</span>
            <textarea
              name="observacoes"
              rows={4}
              defaultValue={defaultValues?.observacoes ?? ""}
              placeholder="Condições operacionais, restrições, observações comerciais ou fiscais."
              className={`mt-[14px] w-full resize-none rounded-[11px] border px-[15px] py-3 text-sm outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            />
            {state.errors?.observacoes ? (
              <span className="mt-1.5 block text-xs text-[#EF4444]">{state.errors.observacoes}</span>
            ) : null}
          </section>

          {state.message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                state.success
                  ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-[#10B981]"
                  : "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#EF4444]"
              }`}
            >
              {state.message}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

type FormFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  error?: string;
  type?: "text" | "number" | "email";
  mono?: boolean;
};

function FormField({ label, name, defaultValue, placeholder, error, type = "text", mono }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? monoFont : ""}`}
      />
      {error ? <span className="text-xs text-[#EF4444]">{error}</span> : null}
    </div>
  );
}

function ToggleSwitchField({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${tokenBorder} ${tokenInputBg}`}>
      <span className="flex flex-col gap-1">
        <span className={`text-sm font-bold ${tokenText}`}>{label}</span>
        <span className={`text-xs leading-[1.4] ${tokenTextSub}`}>{description}</span>
      </span>
      <span className="relative inline-flex h-[26px] w-[46px] shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-[rgba(100,116,139,0.3)] transition-colors peer-checked:bg-[#10B981] dark:bg-[rgba(148,163,184,0.25)]" />
        <span className="absolute left-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
