"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileText, History, MessageSquarePlus } from "lucide-react";
import styles from "./payments-view.module.css";

export interface PaymentDocument {
  id: string;
  title: string;
  period?: string;
  status: string;
  active_version_id?: string;
}

type PaymentViewMode = "available" | "history";

function extractPeriodDates(period?: string) {
  if (!period) return [] as string[];

  const brDates = [...period.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((match) => `${match[1]}/${match[2]}/${match[3]}`);
  if (brDates.length) return brDates;

  const isoDates = [...period.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map((match) => `${match[3]}/${match[2]}/${match[1]}`);
  return isoDates;
}

export function paymentWeekLabel(period?: string) {
  const dates = extractPeriodDates(period);
  if (dates.length >= 2) {
    const start = dates[0].slice(0, 5);
    const end = dates[1].slice(0, 5);
    return `Semana: ${start} a ${end}`;
  }
  if (dates.length === 1) return `Semana: ${dates[0].slice(0, 5)}`;
  return period ? `Semana: ${period}` : "Período não informado";
}

function fullPeriodLabel(period?: string) {
  const dates = extractPeriodDates(period);
  if (dates.length >= 2) return `${dates[0]} a ${dates[1]}`;
  if (dates.length === 1) return dates[0];
  return period || "Período não informado";
}

function documentHeading(period?: string) {
  const dates = extractPeriodDates(period);
  if (dates.length >= 2) return `Semana ${dates[0].slice(0, 5)} a ${dates[1].slice(0, 5)}`;
  if (dates.length === 1) return `Semana ${dates[0].slice(0, 5)}`;
  return "Demonstrativo semanal";
}

export function paymentOptionLabel(document: PaymentDocument) {
  return `${documentHeading(document.period)} · ${document.status === "published" ? "Publicado" : "Histórico"}`;
}

export function PaymentsView({
  documents,
  onOpen,
  onContest,
}: {
  documents: PaymentDocument[];
  onOpen: (id: string) => void | Promise<void>;
  onContest: (id: string) => void;
}) {
  const [mode, setMode] = useState<PaymentViewMode>("available");
  const published = useMemo(() => documents.filter((document) => document.status === "published"), [documents]);
  const history = useMemo(() => documents.filter((document) => document.status !== "published"), [documents]);
  const rows = mode === "available" ? published : history;

  return (
    <section className={styles.screen}>
      <div className={styles.titleRow}>
        <div className={styles.titleCopy}>
          <h2>Pagamentos</h2>
          <p>
            {published.length === 1
              ? "1 demonstrativo disponível para conferência"
              : `${published.length} demonstrativos disponíveis para conferência`}
          </p>
        </div>
      </div>

      <div className={styles.switcher} role="tablist" aria-label="Situação dos pagamentos">
        <button
          className={mode === "available" ? styles.active : ""}
          onClick={() => setMode("available")}
          role="tab"
          aria-selected={mode === "available"}
        >
          <FileText size={15} /> Disponíveis <span>{published.length}</span>
        </button>
        <button
          className={mode === "history" ? styles.active : ""}
          onClick={() => setMode("history")}
          role="tab"
          aria-selected={mode === "history"}
        >
          <History size={15} /> Histórico <span>{history.length}</span>
        </button>
      </div>

      {rows.length ? (
        <div className={styles.list}>
          {rows.map((document) => {
            const isPublished = document.status === "published";
            return (
              <article className={`${styles.card} ${isPublished ? "" : styles.history}`} key={document.id}>
                <div className={styles.cardTop}>
                  <span className={styles.icon}><FileText size={20} /></span>
                  <div className={styles.heading}>
                    <small>Demonstrativo de pagamento</small>
                    <strong>{documentHeading(document.period)}</strong>
                  </div>
                  <span className={`${styles.status} ${isPublished ? "" : styles.history}`}>
                    {isPublished ? "Publicado" : "Substituído"}
                  </span>
                </div>

                <div className={styles.periodBox}>
                  <CalendarDays size={18} />
                  <div>
                    <span>Período</span>
                    <strong>{fullPeriodLabel(document.period)}</strong>
                  </div>
                </div>

                <p className={styles.helper}>
                  {isPublished
                    ? "Confira o PDF desta semana. Se houver divergência, a contestação deve ser aberta a partir deste demonstrativo."
                    : "Este demonstrativo faz parte do histórico e foi substituído por uma versão mais recente."}
                </p>

                <div className={styles.actions}>
                  <button
                    className={`${styles.openButton} ${!isPublished ? styles.historyAction : ""}`}
                    onClick={() => void onOpen(document.id)}
                  >
                    <FileText size={16} /> Visualizar PDF
                  </button>
                  {isPublished ? (
                    <button className={styles.contestButton} onClick={() => onContest(document.id)}>
                      <MessageSquarePlus size={16} /> Contestar PDF
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>{mode === "available" ? "Nenhum pagamento disponível" : "Nenhum pagamento no histórico"}</strong>
          <span>
            {mode === "available"
              ? "Quando um novo PDF for publicado pela Administração, ele aparecerá aqui para conferência."
              : "Demonstrativos substituídos aparecerão aqui para consulta."}
          </span>
        </div>
      )}
    </section>
  );
}
