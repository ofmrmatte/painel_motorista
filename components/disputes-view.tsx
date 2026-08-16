"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  FileText,
  MessageSquarePlus,
  Plus,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { paymentWeekLabel, type PaymentDocument } from "./payments-view";
import styles from "./disputes-view.module.css";

export interface ContestDraft {
  documentId: string;
  reason: string;
  reference: string;
  amount: string;
  description: string;
}

export interface DisputeMessage {
  id?: string;
  body?: string;
  created_at?: string;
  author_driver_id?: string;
  author_admin_id?: string;
}

export interface DisputeRecord {
  id: string;
  document_id: string;
  reason: string;
  status: string;
  decision?: string;
  description?: string;
  reference?: string;
  amount?: number | null;
  created_at?: string;
  updated_at?: string;
  messages?: DisputeMessage[];
}

type Filter = "all" | "active" | "answered" | "closed";

type Bucket = Exclude<Filter, "all">;

const reasonOptions = [
  "Valor divergente",
  "Lançamento não reconhecido",
  "Desconto indevido",
  "Informação incorreta",
  "Outro",
];

function normalizedStatus(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function disputeBucket(status: string): Bucket {
  const value = normalizedStatus(status);
  if (["aprovada", "aprovado", "approved", "recusada", "recusado", "rejected", "resolvida", "resolvido", "resolved", "encerrada", "encerrado", "closed", "finalizada", "finalizado", "finalized"].includes(value)) return "closed";
  if (["respondida", "respondido", "answered", "replied", "aguardando_motorista", "waiting_driver"].includes(value)) return "answered";
  return "active";
}

function statusLabel(status: string) {
  const value = normalizedStatus(status);
  const labels: Record<string, string> = {
    aberta: "Aberta",
    open: "Aberta",
    em_analise: "Em análise",
    analise: "Em análise",
    in_review: "Em análise",
    pending: "Em análise",
    respondida: "Respondida",
    respondido: "Respondida",
    answered: "Respondida",
    replied: "Respondida",
    aguardando_motorista: "Aguardando motorista",
    waiting_driver: "Aguardando motorista",
    aprovada: "Aprovada",
    aprovado: "Aprovada",
    approved: "Aprovada",
    recusada: "Recusada",
    recusado: "Recusada",
    rejected: "Recusada",
    resolvida: "Finalizada",
    resolvido: "Finalizada",
    resolved: "Finalizada",
    encerrada: "Finalizada",
    encerrado: "Finalizada",
    closed: "Finalizada",
    finalizada: "Finalizada",
    finalizado: "Finalizada",
    finalized: "Finalizada",
  };
  return labels[value] || status.replaceAll("_", " ");
}

function statusTone(status: string) {
  const value = normalizedStatus(status);
  if (["aprovada", "aprovado", "approved", "resolvida", "resolvido", "resolved", "finalizada", "finalizado", "finalized"].includes(value)) return styles.success;
  if (["recusada", "recusado", "rejected"].includes(value)) return styles.danger;
  if (disputeBucket(status) === "answered") return styles.answered;
  return styles.activeStatus;
}

function formatDateTime(value?: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  return value;
}

function disputeCode(id: string) {
  const compact = id.replaceAll("-", "").slice(-6).toUpperCase();
  return `#CON-${compact || id.slice(0, 6).toUpperCase()}`;
}

function progressIndex(status: string) {
  const bucket = disputeBucket(status);
  if (bucket === "closed") return 3;
  const value = normalizedStatus(status);
  if (bucket === "answered" || value.includes("analise") || value === "in_review") return 2;
  return 1;
}

function documentLabel(documentId: string, documents: PaymentDocument[]) {
  const document = documents.find((item) => item.id === documentId);
  return document ? paymentWeekLabel(document.period) : "Demonstrativo de pagamento";
}

export function DisputesView({
  disputes,
  documents,
  draft,
  onDraftChange,
  onSubmit,
  submitting = false,
}: {
  disputes: DisputeRecord[];
  documents: PaymentDocument[];
  draft: ContestDraft;
  onDraftChange: (patch: Partial<ContestDraft>) => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(Boolean(draft.documentId));
  const [expanded, setExpanded] = useState<string | null>(null);

  const publishedDocuments = useMemo(() => documents.filter((document) => document.status === "published"), [documents]);
  const counts = useMemo(() => ({
    all: disputes.length,
    active: disputes.filter((item) => disputeBucket(item.status) === "active").length,
    answered: disputes.filter((item) => disputeBucket(item.status) === "answered").length,
    closed: disputes.filter((item) => disputeBucket(item.status) === "closed").length,
  }), [disputes]);
  const rows = useMemo(() => filter === "all" ? disputes : disputes.filter((item) => disputeBucket(item.status) === filter), [disputes, filter]);
  const canSubmit = Boolean(draft.documentId && draft.reason && draft.description.trim().length >= 5) && !submitting;

  return (
    <section className={styles.screen}>
      <div className={styles.titleRow}>
        <div>
          <h2>Contestações</h2>
          <p>{counts.active + counts.answered === 1 ? "1 contestação em andamento" : `${counts.active + counts.answered} contestações em andamento`}</p>
        </div>
        <button className={styles.newButton} onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? "Fechar" : "Nova"}
        </button>
      </div>

      {formOpen ? (
        <section className={styles.formCard} aria-label="Nova contestação">
          <div className={styles.formHeader}>
            <span className={styles.formIcon}><MessageSquarePlus size={19} /></span>
            <div>
              <strong>Nova contestação</strong>
              <small>A contestação ficará vinculada ao PDF selecionado.</small>
            </div>
          </div>

          <label className={styles.field}>
            <span>Demonstrativo de pagamento</span>
            <select value={draft.documentId} onChange={(event) => onDraftChange({ documentId: event.target.value })}>
              <option value="">Selecione o PDF</option>
              {publishedDocuments.map((document) => (
                <option key={document.id} value={document.id}>{paymentWeekLabel(document.period)}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Motivo</span>
            <select value={draft.reason} onChange={(event) => onDraftChange({ reason: event.target.value })}>
              <option value="">Selecione o motivo</option>
              {reasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </label>

          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>Referência <small>opcional</small></span>
              <input value={draft.reference} onChange={(event) => onDraftChange({ reference: event.target.value })} placeholder="Pacote, rota ou lançamento" />
            </label>
            <label className={styles.field}>
              <span>Valor contestado <small>opcional</small></span>
              <div className={styles.moneyField}><span>R$</span><input value={draft.amount} onChange={(event) => onDraftChange({ amount: event.target.value })} inputMode="decimal" placeholder="0,00" /></div>
            </label>
          </div>

          <label className={styles.field}>
            <span>Descrição</span>
            <textarea value={draft.description} onChange={(event) => onDraftChange({ description: event.target.value })} placeholder="Explique de forma objetiva qual informação do PDF está divergente." />
            <small className={styles.helper}>Informe o que está incorreto e, quando possível, identifique pacote, rota, lançamento ou valor.</small>
          </label>

          <button className={styles.submitButton} disabled={!canSubmit} onClick={() => void onSubmit()}>
            <MessageSquarePlus size={17} /> {submitting ? "Enviando..." : "Enviar contestação"}
          </button>
        </section>
      ) : null}

      <div className={styles.filters} aria-label="Filtrar contestações">
        <button className={filter === "all" ? styles.selected : ""} onClick={() => setFilter("all")}>Todas <span>{counts.all}</span></button>
        <button className={filter === "active" ? styles.selected : ""} onClick={() => setFilter("active")}>Em análise <span>{counts.active}</span></button>
        <button className={filter === "answered" ? styles.selected : ""} onClick={() => setFilter("answered")}>Respondidas <span>{counts.answered}</span></button>
        <button className={filter === "closed" ? styles.selected : ""} onClick={() => setFilter("closed")}>Finalizadas <span>{counts.closed}</span></button>
      </div>

      {rows.length ? (
        <div className={styles.list}>
          {rows.map((dispute) => {
            const isExpanded = expanded === dispute.id;
            const currentStep = progressIndex(dispute.status);
            return (
              <article className={styles.card} key={dispute.id}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIdentity}>
                    <span>{disputeCode(dispute.id)}</span>
                    <strong>{dispute.reason}</strong>
                    <small>{documentLabel(dispute.document_id, documents)}</small>
                  </div>
                  <span className={`${styles.status} ${statusTone(dispute.status)}`}>{statusLabel(dispute.status)}</span>
                </div>

                <div className={styles.progress} aria-label="Andamento da contestação">
                  <div className={currentStep >= 1 ? styles.done : ""}><span><CheckCircle2 size={13} /></span><small>Enviada</small></div>
                  <i className={currentStep >= 2 ? styles.doneLine : ""} />
                  <div className={currentStep >= 2 ? styles.done : ""}><span><CircleDot size={12} /></span><small>{disputeBucket(dispute.status) === "answered" ? "Respondida" : "Em análise"}</small></div>
                  <i className={currentStep >= 3 ? styles.doneLine : ""} />
                  <div className={currentStep >= 3 ? styles.done : ""}><span><CheckCircle2 size={13} /></span><small>Finalizada</small></div>
                </div>

                <div className={styles.metaRow}>
                  <span><CalendarDays size={14} /> Aberta em {formatDateTime(dispute.created_at)}</span>
                  {dispute.amount != null ? <strong>{formatCurrency(dispute.amount)}</strong> : null}
                </div>

                <button className={styles.detailsButton} onClick={() => setExpanded(isExpanded ? null : dispute.id)} aria-expanded={isExpanded}>
                  {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded ? (
                  <div className={styles.details}>
                    <div className={styles.detailGrid}>
                      <div><span>PDF</span><strong>{documentLabel(dispute.document_id, documents)}</strong></div>
                      <div><span>Status</span><strong>{statusLabel(dispute.status)}</strong></div>
                      {dispute.reference ? <div><span>Referência</span><strong>{dispute.reference}</strong></div> : null}
                      {dispute.amount != null ? <div><span>Valor</span><strong>{formatCurrency(dispute.amount)}</strong></div> : null}
                    </div>
                    {dispute.description ? <div className={styles.textBlock}><span>Descrição enviada</span><p>{dispute.description}</p></div> : null}
                    {dispute.decision ? <div className={`${styles.textBlock} ${styles.decision}`}><span>Resposta da Administração</span><p>{dispute.decision}</p></div> : null}
                    {dispute.messages?.length ? (
                      <div className={styles.timeline}>
                        <span>Histórico</span>
                        {dispute.messages.map((message, index) => (
                          <div key={message.id || `${dispute.id}-${index}`}>
                            <i />
                            <p>{message.body}</p>
                            <small>{formatDateTime(message.created_at)}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <MessageSquarePlus size={25} />
          <strong>{filter === "all" ? "Nenhuma contestação registrada" : "Nenhuma contestação neste status"}</strong>
          <span>{filter === "all" ? "Quando precisar contestar um PDF, use o botão Nova." : "Altere o filtro para consultar outras contestações."}</span>
        </div>
      )}
    </section>
  );
}
