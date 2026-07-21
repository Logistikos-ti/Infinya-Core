"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { saveDepositanteAction } from "@/app/(dashboard)/configuracoes/depositantes/actions";
import { Button } from "@/components/ui/button";
import type { EmailContato, MetodoRetirada, TelefoneContato } from "@/lib/depositantes";

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
};

export function DepositanteForm({ defaultValues }: DepositanteFormProps) {
  const initialState = {
    success: false,
    message: null,
  };

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
  const [state, formAction, isPending] = useActionState(saveDepositanteAction, initialState);

  const hasCurrentLogo = useMemo(() => Boolean(logoPreviewUrl), [logoPreviewUrl]);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/55"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {defaultValues?.id ? "Editar depositante" : "Novo depositante"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cadastro mestre com nome fantasia, razão social, dados fiscais, endereço
            fiscal, contatos e parâmetros operacionais.
          </p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/70">
          {hasCurrentLogo ? (
            <Image
              src={logoPreviewUrl}
              alt="Preview da logo"
              width={64}
              height={64}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <span className="text-xs font-semibold text-slate-400">Sem logo</span>
          )}
        </div>
      </div>

      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
      <input type="hidden" name="currentLogoUrl" value={defaultValues?.logoUrl ?? ""} />
      <input
        type="hidden"
        name="currentLogoStoragePath"
        value={defaultValues?.logoStoragePath ?? ""}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field
          label="Código"
          name="codigo"
          defaultValue={defaultValues?.codigo ?? ""}
          error={state.errors?.codigo}
        />
        <Field
          label="Nome fantasia"
          name="nome"
          defaultValue={defaultValues?.nome ?? ""}
          error={state.errors?.nome}
        />
        <Field
          label="Razão social"
          name="razaoSocial"
          defaultValue={defaultValues?.razaoSocial ?? ""}
          error={state.errors?.razaoSocial}
        />
        <Field
          label="CNPJ"
          name="cnpj"
          defaultValue={defaultValues?.cnpj ?? ""}
          error={state.errors?.cnpj}
        />

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Logo do depositante
          </span>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-700 transition hover:border-sky-400 hover:bg-sky-50/40 dark:border-white/15 dark:text-slate-200 dark:hover:bg-sky-500/10">
            <Upload className="h-4 w-4 text-slate-500" />
            <span>Selecionar imagem PNG, JPG ou WEBP</span>
            <input
              type="file"
              name="logoFile"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                setRemoveLogo(false);
                setLogoPreviewUrl(URL.createObjectURL(file));
              }}
            />
          </label>
          {state.errors?.logoFile ? (
            <span className="mt-2 block text-xs text-rose-600">{state.errors.logoFile}</span>
          ) : null}
          <label className="mt-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="removeLogo"
              checked={removeLogo}
              onChange={(event) => {
                setRemoveLogo(event.target.checked);
                if (event.target.checked) {
                  setLogoPreviewUrl("");
                } else {
                  setLogoPreviewUrl(defaultValues?.logoUrl?.trim() ?? "");
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Remover logo atual
          </label>
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-950">Endereço fiscal</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="CEP"
            name="enderecoFiscalCep"
            defaultValue={defaultValues?.enderecoFiscalCep ?? ""}
            error={state.errors?.enderecoFiscalCep}
          />
          <Field
            label="Logradouro"
            name="enderecoFiscalLogradouro"
            defaultValue={defaultValues?.enderecoFiscalLogradouro ?? ""}
            error={state.errors?.enderecoFiscalLogradouro}
          />
          <Field
            label="Número"
            name="enderecoFiscalNumero"
            defaultValue={defaultValues?.enderecoFiscalNumero ?? ""}
            error={state.errors?.enderecoFiscalNumero}
          />
          <Field
            label="Complemento"
            name="enderecoFiscalComplemento"
            defaultValue={defaultValues?.enderecoFiscalComplemento ?? ""}
            error={state.errors?.enderecoFiscalComplemento}
          />
          <Field
            label="Bairro"
            name="enderecoFiscalBairro"
            defaultValue={defaultValues?.enderecoFiscalBairro ?? ""}
            error={state.errors?.enderecoFiscalBairro}
          />
          <Field
            label="Cidade"
            name="enderecoFiscalCidade"
            defaultValue={defaultValues?.enderecoFiscalCidade ?? ""}
            error={state.errors?.enderecoFiscalCidade}
          />
          <Field
            label="UF"
            name="enderecoFiscalUf"
            defaultValue={defaultValues?.enderecoFiscalUf ?? ""}
            error={state.errors?.enderecoFiscalUf}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Contatos telefônicos</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cada telefone precisa do nome do responsável.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setTelefonesContato((current) => [...current, { nome: "", telefone: "" }])
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar telefone
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {telefonesContato.map((contato, index) => (
            <div
              key={`telefone-${index}`}
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto] dark:border-white/10 dark:bg-slate-950/45"
            >
              <Field
                label="Responsável"
                name="contatoTelefoneNome"
                defaultValue={contato.nome}
                error={undefined}
              />
              <Field
                label="Telefone"
                name="contatoTelefone"
                defaultValue={contato.telefone}
                error={undefined}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setTelefonesContato((current) =>
                      current.length === 1
                        ? [{ nome: "", telefone: "" }]
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {state.errors?.contatosTelefone ? (
            <span className="block text-xs text-rose-600">{state.errors.contatosTelefone}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-white/10 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">E-mails do depositante</h3>
            <p className="mt-1 text-sm text-slate-500">
              Para e-mail, basta informar o endereço.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEmailsContato((current) => [...current, { email: "" }])}
          >
            <Plus className="h-4 w-4" />
            Adicionar e-mail
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {emailsContato.map((contato, index) => (
            <div
              key={`email-${index}`}
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto] dark:border-white/10 dark:bg-slate-950/45"
            >
              <Field
                label="E-mail"
                name="contatoEmail"
                defaultValue={contato.email}
                error={undefined}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setEmailsContato((current) =>
                      current.length === 1
                        ? [{ email: "" }]
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {state.errors?.contatosEmail ? (
            <span className="block text-xs text-rose-600">{state.errors.contatosEmail}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Método de retirada padrão
          </span>
          <select
            name="metodoRetiradaPadrao"
            defaultValue={defaultValues?.metodoRetiradaPadrao ?? "FEFO"}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="FEFO">FEFO</option>
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
          </select>
        </label>

        <Field
          label="Prefixo de recebimento"
          name="prefixoRecebimento"
          defaultValue={defaultValues?.prefixoRecebimento ?? ""}
          error={state.errors?.prefixoRecebimento}
        />

        <Field
          label="Dias mínimos de validade"
          name="diasMinimosValidade"
          type="number"
          defaultValue={String(defaultValues?.diasMinimosValidade ?? 0)}
          error={state.errors?.diasMinimosValidade}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CheckboxField
          name="exigeLotePadrao"
          label="Exigir lote por padrão"
          description="Novos recebimentos já nascem com conferência de lote habilitada."
          defaultChecked={defaultValues?.exigeLotePadrao ?? true}
        />
        <CheckboxField
          name="exigeValidadePadrao"
          label="Exigir validade por padrão"
          description="Aplica controle de validade e suporte ao FEFO quando necessário."
          defaultChecked={defaultValues?.exigeValidadePadrao ?? true}
        />
        <CheckboxField
          name="permiteFracionamento"
          label="Permitir fracionamento"
          description="Autoriza operação com separação e movimentação fracionada para o cliente."
          defaultChecked={defaultValues?.permiteFracionamento ?? false}
        />
        <CheckboxField
          name="ativo"
          label="Depositante ativo"
          description="Mantém o depositante disponível para novos produtos, usuários e pedidos."
          defaultChecked={defaultValues?.ativo ?? true}
        />
      </div>

      <div className="mt-4">
        <TextÁreaField
          label="Observações"
          name="observacoes"
          rows={4}
          defaultValue={defaultValues?.observacoes ?? ""}
          error={state.errors?.observacoes}
          placeholder="Condições operacionais, restrições, observações comerciais ou fiscais."
        />
      </div>

      {state.message ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            state.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
        >
          {isPending
            ? "Salvando..."
            : defaultValues?.id
              ? "Salvar alterações"
              : "Criar depositante"}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  type?: "text" | "number";
};

function Field({ label, name, defaultValue, error, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
      />
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

type TextÁreaFieldProps = {
  label: string;
  name: string;
  rows: number;
  defaultValue: string;
  error?: string;
  placeholder?: string;
};

function TextÁreaField({
  label,
  name,
  rows,
  defaultValue,
  error,
  placeholder,
}: TextÁreaFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
      />
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

type CheckboxFieldProps = {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
}: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      <span>
        <span className="font-medium text-slate-950">{label}</span>
        <span className="mt-1 block text-slate-500">{description}</span>
      </span>
    </label>
  );
}
