"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CreditCard,
  Home,
  LogOut,
  MessageSquarePlus,
  Package,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Tab = "home" | "tickets" | "payments" | "disputes" | "profile";

interface Ticket {
  id: string;
  type: string;
  operationalId: string;
  routeId?: string;
  baseName: string;
  date?: string;
  value: number;
  status: string;
  detail?: string;
  source?: string;
}

interface DocumentRow {
  id: string;
  title: string;
  period?: string;
  status: string;
  active_version_id?: string;
}

interface DisputeRow {
  id: string;
  document_id: string;
  reason: string;
  status: string;
  decision?: string;
  description?: string;
  driver_payment_documents?: { title?: string };
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  read_at?: string | null;
}

export interface PortalPayload {
  driver: { fullName: string; driverCode: string; baseKey: string; sigla?: string };
  tickets: Ticket[];
  documents: DocumentRow[];
  disputes: DisputeRow[];
  notifications: NotificationRow[];
}

async function readError(response: Response, fallback: string) {
  return response.json().then((body) => body.error || fallback).catch(() => fallback);
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    pnr: "PNR",
    pacote_perdido: "Pacote perdido",
    aguardando_comprovante: "Aguardando comprovante",
    com_penalidade: "Com penalidade",
    enviado_faturamento: "Enviado ao faturamento",
    anulado: "Anulado",
    resolvido: "Resolvido",
    pendente: "Pendente",
    published: "Publicado",
    superseded: "Substituído",
  };

  if (labels[value]) return labels[value];
  const text = value.replaceAll("_", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function ticketTypeLabel(ticket: Ticket) {
  if (ticket.source === "pnr" || ticket.type === "pnr" || ticket.type === "aguardando_comprovante") return "PNR";
  if (ticket.type === "pacote_perdido") return "Pacote perdido";
  if (ticket.source === "risk") return "Ocorrência";
  return statusLabel(ticket.type);
}

function formatDate(value?: string) {
  if (!value) return "";

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;

  return value;
}

function formatWeek(period?: string) {
  if (!period) return "Período não informado";
  const dates = [...period.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  if (dates.length >= 2) return `Semana: ${dates[0][1]}/${dates[0][2]} a ${dates[1][1]}/${dates[1][2]}`;
  if (dates.length === 1) return `Semana: ${dates[0][1]}/${dates[0][2]}`;
  return `Semana: ${period}`;
}

function isOpenDispute(status: string) {
  const closed = new Set(["resolved", "closed", "approved", "rejected", "finalized", "resolvido", "encerrado"]);
  return !closed.has(status.toLowerCase());
}

function ticketStatusTone(status: string) {
  if (status === "com_penalidade") return "danger";
  if (status === "aguardando_comprovante") return "warning";
  if (status === "resolvido") return "success";
  return "neutral";
}

export function PortalApp({ initialData }: { initialData: PortalPayload }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<PortalPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contest, setContest] = useState({ documentId: "", reason: "", reference: "", amount: "", description: "" });

  function navigate(nextTab: Tab) {
    setNotificationsOpen(false);
    setTab(nextTab);
  }

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readError(response, "Falha ao carregar portal."));
      setData(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar portal.");
    } finally {
      setLoading(false);
    }
  }

  const tickets = useMemo(() => data.tickets ?? [], [data]);
  const documents = useMemo(() => data.documents ?? [], [data]);
  const disputes = useMemo(() => data.disputes ?? [], [data]);
  const notifications = useMemo(() => data.notifications ?? [], [data]);
  const unread = notifications.filter((item) => !item.read_at).length;
  const publishedDocuments = documents.filter((doc) => doc.status === "published");
  const availableDocuments = publishedDocuments.length ? publishedDocuments : documents;
  const latestDocument = availableDocuments[0];
  const openDisputes = disputes.filter((dispute) => isOpenDispute(dispute.status));

  async function openDocument(id: string) {
    setMessage("");
    const response = await fetch(`/api/documents/${id}/download`, { cache: "no-store" });
    if (!response.ok) {
      setMessage(await readError(response, "Falha ao abrir PDF."));
      return;
    }
    const payload = await response.json();
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function markNotificationRead(id: string) {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.read_at) return;

    const readAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => item.id === id ? { ...item, read_at: readAt } : item),
    }));

    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      setMessage(await readError(response, "Falha ao atualizar notificação."));
      await load();
    }
  }

  async function createDispute() {
    setMessage("");
    const response = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contest),
    });
    if (!response.ok) {
      setMessage(await readError(response, "Falha ao abrir contestação."));
      return;
    }
    setContest({ documentId: "", reason: "", reference: "", amount: "", description: "" });
    navigate("disputes");
    await load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) return <main className="app-shell"><div className="empty-state">Carregando portal...</div></main>;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <span className="app-kicker">Portal do Motorista</span>
          <div className="header-actions">
            <button
              className={`icon-button notification-trigger ${notificationsOpen ? "active" : ""}`}
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
            >
              <Bell size={19} />
              {unread > 0 ? <span className="notification-badge">{unread > 9 ? "9+" : unread}</span> : null}
            </button>
            <button className="icon-button" onClick={() => navigate("profile")} aria-label="Perfil"><UserRound size={19} /></button>
          </div>
        </div>
        <div className="driver-heading">
          <h1>{data?.driver.fullName || "Motorista ALC"}</h1>
          <p>{data?.driver.baseKey}{data?.driver.sigla ? ` • ${data.driver.sigla}` : ""}</p>
        </div>

        {notificationsOpen ? (
          <section className="notification-popover" aria-label="Central de notificações">
            <div className="notification-popover-head">
              <div>
                <strong>Notificações</strong>
                <span>{unread ? `${unread} ${unread === 1 ? "nova" : "novas"}` : "Tudo em dia"}</span>
              </div>
              <button onClick={() => setNotificationsOpen(false)}>Fechar</button>
            </div>
            <div className="notification-list">
              {notifications.map((item) => (
                <button
                  className={`notification-item ${item.read_at ? "" : "unread"}`}
                  key={item.id}
                  onClick={() => void markNotificationRead(item.id)}
                >
                  <span className="notification-dot" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </span>
                </button>
              ))}
              {!notifications.length ? <div className="notification-empty">Sem notificações.</div> : null}
            </div>
          </section>
        ) : null}
      </header>

      {message ? <p className="app-message">{message}</p> : null}

      {tab === "home" ? (
        <section className="screen-stack">
          <div className="summary-grid">
            <button className="summary-card summary-card-wide" onClick={() => navigate("tickets")}>
              <span className="summary-icon"><Package size={20} /></span>
              <span className="summary-copy"><b>Pendências</b><small>{tickets.length ? "Requer atenção" : "Tudo certo"}</small></span>
              <strong>{tickets.length}</strong>
            </button>
            <button className="summary-card" onClick={() => navigate("payments")}>
              <span className="summary-icon"><CreditCard size={19} /></span>
              <strong>{availableDocuments.length}</strong>
              <span className="summary-copy"><b>Pagamentos</b><small>{latestDocument ? formatWeek(latestDocument.period) : "Nenhum disponível"}</small></span>
            </button>
            <button className="summary-card" onClick={() => navigate("disputes")}>
              <span className="summary-icon"><MessageSquarePlus size={19} /></span>
              <strong>{openDisputes.length}</strong>
              <span className="summary-copy"><b>Contestações</b><small>{openDisputes.length ? "Em andamento" : "Nenhuma em andamento"}</small></span>
            </button>
          </div>

          <section className="mobile-card home-pending-card">
            <div className="card-head">
              <div><h2>Últimas pendências</h2><span>Itens mais recentes que exigem atenção.</span></div>
              <button className="mini-icon" onClick={() => void load()} aria-label="Atualizar pendências"><RefreshCw size={16} /></button>
            </div>
            <TicketList tickets={tickets.slice(0, 4)} />
          </section>
        </section>
      ) : null}

      {tab === "tickets" ? (
        <section className="screen-stack">
          <h2>Pendências</h2>
          <TicketList tickets={tickets} />
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className="screen-stack">
          <h2>Pagamentos</h2>
          <div className="list-stack">
            {documents.map((doc) => (
              <article className="item-card" key={doc.id}>
                <div><strong>{doc.title}</strong><span>{doc.period || "Período não informado"} · {statusLabel(doc.status)}</span></div>
                <div className="action-row">
                  <button onClick={() => void openDocument(doc.id)}>Abrir PDF</button>
                  <button onClick={() => { setContest({ ...contest, documentId: doc.id }); navigate("disputes"); }}>Contestar</button>
                </div>
              </article>
            ))}
            {!documents.length ? <div className="empty-state">Nenhum PDF publicado.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "disputes" ? (
        <section className="screen-stack">
          <h2>Contestações</h2>
          <div className="mobile-card">
            <select value={contest.documentId} onChange={(event) => setContest({ ...contest, documentId: event.target.value })}>
              <option value="">Selecione o PDF</option>
              {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
            </select>
            <input value={contest.reason} onChange={(event) => setContest({ ...contest, reason: event.target.value })} placeholder="Motivo" />
            <input value={contest.reference} onChange={(event) => setContest({ ...contest, reference: event.target.value })} placeholder="Referência do lançamento" />
            <input value={contest.amount} onChange={(event) => setContest({ ...contest, amount: event.target.value })} inputMode="decimal" placeholder="Valor" />
            <textarea value={contest.description} onChange={(event) => setContest({ ...contest, description: event.target.value })} placeholder="Descreva a contestação" />
            <button className="primary-action" disabled={!contest.documentId || !contest.reason || !contest.description} onClick={() => void createDispute()}><MessageSquarePlus size={18} />Abrir contestação</button>
          </div>
          <div className="list-stack">
            {disputes.map((dispute) => <article className="item-card" key={dispute.id}><div><strong>{dispute.reason}</strong><span>{dispute.driver_payment_documents?.title || dispute.document_id}</span></div><b>{statusLabel(dispute.status)}</b><p>{dispute.decision || dispute.description}</p></article>)}
            {!disputes.length ? <div className="empty-state">Nenhuma contestação aberta.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "profile" ? (
        <section className="screen-stack">
          <h2>Perfil</h2>
          <article className="mobile-card">
            <strong>{data?.driver.fullName}</strong>
            <span className="muted">ID {data?.driver.driverCode}</span>
            <span className="muted">Base {data?.driver.baseKey}</span>
            <button className="primary-action logout-action" onClick={() => void logout()}><LogOut size={18} />Sair</button>
          </article>
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Navegação principal">
        <button className={tab === "home" ? "active" : ""} onClick={() => navigate("home")}><Home size={19} /><span>Início</span></button>
        <button className={tab === "tickets" ? "active" : ""} onClick={() => navigate("tickets")}><Package size={19} /><span>Pendências</span></button>
        <button className={tab === "payments" ? "active" : ""} onClick={() => navigate("payments")}><CreditCard size={19} /><span>Pagamentos</span></button>
        <button className={tab === "disputes" ? "active" : ""} onClick={() => navigate("disputes")}><MessageSquarePlus size={19} /><span>Contestações</span></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={19} /><span>Perfil</span></button>
      </nav>
    </main>
  );
}

function TicketList({ tickets }: { tickets: Ticket[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!tickets.length) return <div className="empty-state">Nenhuma pendência.</div>;

  return (
    <div className="list-stack ticket-list">
      {tickets.map((ticket) => {
        const isExpanded = expanded === ticket.id;
        const date = formatDate(ticket.date);

        return (
          <article className="ticket-card" key={ticket.id}>
            <div className="ticket-card-top">
              <div className="ticket-labels">
                <span className="ticket-kind">{ticketTypeLabel(ticket)}</span>
                <span className={`status-badge ${ticketStatusTone(ticket.status)}`}>{statusLabel(ticket.status)}</span>
              </div>
              <b className="ticket-value">{formatCurrency(ticket.value)}</b>
            </div>

            <div className="ticket-main">
              <strong>Pacote {ticket.operationalId || "não informado"}</strong>
              <span>{ticket.baseName}{date ? ` • ${date}` : ""}</span>
            </div>

            {ticket.detail ? <p className="ticket-description">{ticket.detail}</p> : null}

            <button className="ticket-detail-button" onClick={() => setExpanded(isExpanded ? null : ticket.id)}>
              {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
            </button>

            {isExpanded ? (
              <div className="ticket-details">
                <div><span>Base</span><strong>{ticket.baseName || "Não informada"}</strong></div>
                {ticket.routeId ? <div><span>Rota</span><strong>{ticket.routeId}</strong></div> : null}
                {date ? <div><span>Data</span><strong>{date}</strong></div> : null}
                <div><span>Status</span><strong>{statusLabel(ticket.status)}</strong></div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
