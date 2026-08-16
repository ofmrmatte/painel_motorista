"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  History,
  Home,
  LogOut,
  MessageSquarePlus,
  Package,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  DisputesView,
  type ContestDraft,
  type DisputeRecord,
} from "./disputes-view";
import {
  PaymentsView,
  paymentWeekLabel,
  type PaymentDocument,
} from "./payments-view";

type Tab = "home" | "tickets" | "payments" | "disputes" | "profile";
type TicketView = "active" | "history";
type TicketCategory = "all" | "pnr" | "package" | "occurrence";

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

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  read_at?: string | null;
}

export interface PortalPayload {
  driver: { fullName: string; driverCode: string; baseKey: string; sigla?: string };
  tickets: Ticket[];
  documents: PaymentDocument[];
  disputes: DisputeRecord[];
  notifications: NotificationRow[];
}

const emptyContest: ContestDraft = {
  documentId: "",
  reason: "",
  reference: "",
  amount: "",
  description: "",
};

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

function ticketCategory(ticket: Ticket): Exclude<TicketCategory, "all"> {
  if (ticket.source === "pnr" || ticket.type === "pnr" || ticket.type === "aguardando_comprovante") return "pnr";
  if (ticket.type === "pacote_perdido" || ticket.source === "prefatura") return "package";
  return "occurrence";
}

function ticketTypeLabel(ticket: Ticket) {
  const category = ticketCategory(ticket);
  if (category === "pnr") return "PNR";
  if (category === "package") return "Pacote perdido";
  return "Ocorrência";
}

function formatDate(value?: string) {
  if (!value) return "";

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;

  return value;
}

function normalizeDisputeStatus(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function isOpenDispute(status: string) {
  const closed = new Set([
    "resolved",
    "closed",
    "approved",
    "rejected",
    "finalized",
    "resolvido",
    "resolvida",
    "encerrado",
    "encerrada",
    "aprovado",
    "aprovada",
    "recusado",
    "recusada",
    "finalizado",
    "finalizada",
  ]);
  return !closed.has(normalizeDisputeStatus(status));
}

function isClosedTicket(status: string) {
  const closed = new Set(["resolvido", "resolved", "anulado", "annulled", "cancelado", "cancelled", "canceled"]);
  return closed.has(status.toLowerCase());
}

function ticketStatusTone(status: string) {
  if (status === "com_penalidade") return "danger";
  if (status === "aguardando_comprovante") return "warning";
  if (status === "resolvido" || status === "anulado") return "success";
  return "neutral";
}

function dedupeTickets(rows: Ticket[]) {
  const seen = new Set<string>();
  return rows.filter((ticket) => {
    const operationalId = ticket.operationalId.trim();
    if (!operationalId) return true;
    const key = `${ticketCategory(ticket)}:${operationalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesTicketSearch(ticket: Ticket, query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return true;

  return [
    ticket.operationalId,
    ticket.routeId,
    ticket.baseName,
    ticket.detail,
    ticketTypeLabel(ticket),
    statusLabel(ticket.status),
  ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalized));
}

export function PortalApp({ initialData }: { initialData: PortalPayload }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<PortalPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [ticketView, setTicketView] = useState<TicketView>("active");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<TicketCategory>("all");
  const [ticketQuery, setTicketQuery] = useState("");
  const [contest, setContest] = useState<ContestDraft>(emptyContest);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

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

  const tickets = useMemo(() => dedupeTickets(data.tickets ?? []), [data]);
  const activeTickets = useMemo(() => tickets.filter((ticket) => !isClosedTicket(ticket.status)), [tickets]);
  const historyTickets = useMemo(() => tickets.filter((ticket) => isClosedTicket(ticket.status)), [tickets]);
  const documents = useMemo(() => data.documents ?? [], [data]);
  const disputes = useMemo(() => data.disputes ?? [], [data]);
  const notifications = useMemo(() => data.notifications ?? [], [data]);
  const unread = notifications.filter((item) => !item.read_at).length;
  const publishedDocuments = documents.filter((doc) => doc.status === "published");
  const availableDocuments = publishedDocuments;
  const latestDocument = availableDocuments[0];
  const openDisputes = disputes.filter((dispute) => isOpenDispute(dispute.status));
  const ticketViewRows = ticketView === "active" ? activeTickets : historyTickets;
  const filteredTickets = useMemo(
    () => ticketViewRows.filter((ticket) => {
      const categoryMatches = ticketCategoryFilter === "all" || ticketCategory(ticket) === ticketCategoryFilter;
      return categoryMatches && matchesTicketSearch(ticket, ticketQuery);
    }),
    [ticketCategoryFilter, ticketQuery, ticketViewRows],
  );

  const categoryCounts = useMemo(() => ({
    all: ticketViewRows.length,
    pnr: ticketViewRows.filter((ticket) => ticketCategory(ticket) === "pnr").length,
    package: ticketViewRows.filter((ticket) => ticketCategory(ticket) === "package").length,
    occurrence: ticketViewRows.filter((ticket) => ticketCategory(ticket) === "occurrence").length,
  }), [ticketViewRows]);

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

  function contestDocument(id: string) {
    setContest((current) => ({ ...current, documentId: id }));
    navigate("disputes");
  }

  function updateContest(patch: Partial<ContestDraft>) {
    setContest((current) => ({ ...current, ...patch }));
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
    if (disputeSubmitting) return;
    setDisputeSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contest),
      });
      if (!response.ok) {
        setMessage(await readError(response, "Falha ao abrir contestação."));
        return;
      }
      setContest(emptyContest);
      navigate("disputes");
      await load();
    } finally {
      setDisputeSubmitting(false);
    }
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
              <span className="summary-copy"><b>Pendências</b><small>{activeTickets.length ? "Requer atenção" : "Tudo certo"}</small></span>
              <strong>{activeTickets.length}</strong>
            </button>
            <button className="summary-card" onClick={() => navigate("payments")}>
              <span className="summary-icon"><CreditCard size={19} /></span>
              <strong>{availableDocuments.length}</strong>
              <span className="summary-copy"><b>Pagamentos</b><small>{latestDocument ? paymentWeekLabel(latestDocument.period) : "Nenhum disponível"}</small></span>
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
            <TicketList tickets={activeTickets.slice(0, 4)} compact />
          </section>
        </section>
      ) : null}

      {tab === "tickets" ? (
        <section className="screen-stack ticket-screen">
          <div className="screen-title-row">
            <div>
              <h2>Pendências</h2>
              <p>{activeTickets.length === 1 ? "1 pendência ativa" : `${activeTickets.length} pendências ativas`}</p>
            </div>
            <button className="mini-icon" onClick={() => void load()} aria-label="Atualizar pendências"><RefreshCw size={16} /></button>
          </div>

          <div className="ticket-view-switch" role="tablist" aria-label="Situação das pendências">
            <button className={ticketView === "active" ? "active" : ""} onClick={() => setTicketView("active")} role="tab" aria-selected={ticketView === "active"}>
              <Package size={15} /> Ativas <span>{activeTickets.length}</span>
            </button>
            <button className={ticketView === "history" ? "active" : ""} onClick={() => setTicketView("history")} role="tab" aria-selected={ticketView === "history"}>
              <History size={15} /> Histórico <span>{historyTickets.length}</span>
            </button>
          </div>

          <label className="ticket-search">
            <Search size={17} />
            <input
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
              placeholder="Buscar pacote, rota ou base"
              aria-label="Buscar pendências"
            />
          </label>

          <div className="ticket-filter-row" aria-label="Filtrar pendências por tipo">
            <button className={ticketCategoryFilter === "all" ? "active" : ""} onClick={() => setTicketCategoryFilter("all")}>Todas <span>{categoryCounts.all}</span></button>
            <button className={ticketCategoryFilter === "pnr" ? "active" : ""} onClick={() => setTicketCategoryFilter("pnr")}>PNR <span>{categoryCounts.pnr}</span></button>
            <button className={ticketCategoryFilter === "package" ? "active" : ""} onClick={() => setTicketCategoryFilter("package")}>Pacotes <span>{categoryCounts.package}</span></button>
            <button className={ticketCategoryFilter === "occurrence" ? "active" : ""} onClick={() => setTicketCategoryFilter("occurrence")}>Ocorrências <span>{categoryCounts.occurrence}</span></button>
          </div>

          {filteredTickets.length ? (
            <TicketList tickets={filteredTickets} />
          ) : (
            <div className="empty-state ticket-empty-state">
              {ticketQuery ? "Nenhuma pendência encontrada para essa busca." : ticketView === "history" ? "Nenhuma pendência concluída no histórico." : "Nenhuma pendência ativa neste filtro."}
            </div>
          )}
        </section>
      ) : null}

      {tab === "payments" ? (
        <PaymentsView documents={documents} onOpen={openDocument} onContest={contestDocument} />
      ) : null}

      {tab === "disputes" ? (
        <DisputesView
          disputes={disputes}
          documents={documents}
          draft={contest}
          onDraftChange={updateContest}
          onSubmit={createDispute}
          submitting={disputeSubmitting}
        />
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

function TicketList({ tickets, compact = false }: { tickets: Ticket[]; compact?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!tickets.length) return <div className="empty-state">Nenhuma pendência.</div>;

  return (
    <div className={`list-stack ticket-list ${compact ? "compact" : ""}`}>
      {tickets.map((ticket) => {
        const isExpanded = expanded === ticket.id;
        const date = formatDate(ticket.date);
        const category = ticketCategory(ticket);

        return (
          <article className={`ticket-card ${isClosedTicket(ticket.status) ? "closed" : ""}`} key={ticket.id}>
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

            <button
              className="ticket-detail-button"
              onClick={() => setExpanded(isExpanded ? null : ticket.id)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isExpanded ? (
              <div className="ticket-details-wrap">
                <div className="ticket-details">
                  <div><span>Base</span><strong>{ticket.baseName || "Não informada"}</strong></div>
                  <div><span>Pacote</span><strong>{ticket.operationalId || "Não informado"}</strong></div>
                  {ticket.routeId ? <div><span>Rota</span><strong>{ticket.routeId}</strong></div> : null}
                  {date ? <div><span>Data</span><strong>{date}</strong></div> : null}
                  <div><span>Status</span><strong>{statusLabel(ticket.status)}</strong></div>
                  <div><span>Valor</span><strong>{formatCurrency(ticket.value)}</strong></div>
                </div>
                {category === "pnr" ? (
                  <div className="ticket-rule-note">
                    <CheckCircle2 size={15} />
                    <span>PNR não abre contestação por esta tela. Quando disponível, a contestação é feita pelo PDF de pagamento.</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
