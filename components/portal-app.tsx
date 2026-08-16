"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, FileText, Home, LogOut, MessageSquarePlus, Package, RefreshCw, UserRound, WalletCards } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Tab = "home" | "tickets" | "payments" | "disputes" | "profile";

interface Ticket {
  id: string;
  type: string;
  operationalId: string;
  baseName: string;
  date?: string;
  value: number;
  status: string;
  detail?: string;
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
  return value.replaceAll("_", " ");
}

export function PortalApp({ initialData }: { initialData: PortalPayload }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<PortalPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [contest, setContest] = useState({ documentId: "", reason: "", reference: "", amount: "", description: "" });

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
  const pnr = tickets.filter((ticket) => ticket.type.includes("pnr")).length;
  const packages = tickets.filter((ticket) => ticket.type.includes("pacote")).length;

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

  async function createDispute() {
    setMessage("");
    const response = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contest),
    });
    if (!response.ok) {
      setMessage(await readError(response, "Falha ao abrir contestacao."));
      return;
    }
    setContest({ documentId: "", reason: "", reference: "", amount: "", description: "" });
    setTab("disputes");
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
        <div>
          <span>Portal do Motorista</span>
          <h1>{data?.driver.fullName || "Motorista ALC"}</h1>
          <p>{data?.driver.baseKey}{data?.driver.sigla ? ` · ${data.driver.sigla}` : ""}</p>
        </div>
        <button className="icon-button" onClick={() => setTab("profile")} aria-label="Perfil"><UserRound size={20} /></button>
      </header>

      {message ? <p className="app-message">{message}</p> : null}

      {tab === "home" ? (
        <section className="screen-stack">
          <div className="summary-grid">
            <button onClick={() => setTab("tickets")}><Package size={20} /><strong>{tickets.length}</strong><span>Pendencias</span></button>
            <button onClick={() => setTab("tickets")}><FileText size={20} /><strong>{pnr}</strong><span>PNR</span></button>
            <button onClick={() => setTab("tickets")}><WalletCards size={20} /><strong>{packages}</strong><span>Pacotes</span></button>
            <button onClick={() => setTab("payments")}><CreditCard size={20} /><strong>{documents.length}</strong><span>Pagamentos</span></button>
            <button onClick={() => setTab("disputes")}><MessageSquarePlus size={20} /><strong>{disputes.length}</strong><span>Contestacoes</span></button>
            <button onClick={() => setTab("profile")}><Bell size={20} /><strong>{unread}</strong><span>Avisos</span></button>
          </div>
          <section className="mobile-card">
            <div className="card-head"><h2>Ultimas pendencias</h2><button className="mini-icon" onClick={() => void load()}><RefreshCw size={16} /></button></div>
            <TicketList tickets={tickets.slice(0, 4)} />
          </section>
        </section>
      ) : null}

      {tab === "tickets" ? (
        <section className="screen-stack">
          <h2>Pendencias</h2>
          <TicketList tickets={tickets} />
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className="screen-stack">
          <h2>Pagamentos</h2>
          <div className="list-stack">
            {documents.map((doc) => (
              <article className="item-card" key={doc.id}>
                <div><strong>{doc.title}</strong><span>{doc.period || "Periodo nao informado"} · {doc.status}</span></div>
                <div className="action-row">
                  <button onClick={() => void openDocument(doc.id)}>Abrir PDF</button>
                  <button onClick={() => { setContest({ ...contest, documentId: doc.id }); setTab("disputes"); }}>Contestar</button>
                </div>
              </article>
            ))}
            {!documents.length ? <div className="empty-state">Nenhum PDF publicado.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "disputes" ? (
        <section className="screen-stack">
          <h2>Contestacoes</h2>
          <div className="mobile-card">
            <select value={contest.documentId} onChange={(event) => setContest({ ...contest, documentId: event.target.value })}>
              <option value="">Selecione o PDF</option>
              {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
            </select>
            <input value={contest.reason} onChange={(event) => setContest({ ...contest, reason: event.target.value })} placeholder="Motivo" />
            <input value={contest.reference} onChange={(event) => setContest({ ...contest, reference: event.target.value })} placeholder="Referencia do lancamento" />
            <input value={contest.amount} onChange={(event) => setContest({ ...contest, amount: event.target.value })} inputMode="decimal" placeholder="Valor" />
            <textarea value={contest.description} onChange={(event) => setContest({ ...contest, description: event.target.value })} placeholder="Descreva a contestacao" />
            <button className="primary-action" disabled={!contest.documentId || !contest.reason || !contest.description} onClick={() => void createDispute()}><MessageSquarePlus size={18} />Abrir contestacao</button>
          </div>
          <div className="list-stack">
            {disputes.map((dispute) => <article className="item-card" key={dispute.id}><div><strong>{dispute.reason}</strong><span>{dispute.driver_payment_documents?.title || dispute.document_id}</span></div><b>{statusLabel(dispute.status)}</b><p>{dispute.decision || dispute.description}</p></article>)}
            {!disputes.length ? <div className="empty-state">Nenhuma contestacao aberta.</div> : null}
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
          <div className="list-stack">
            {notifications.map((item) => <article className={`item-card ${item.read_at ? "" : "unread"}`} key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div></article>)}
            {!notifications.length ? <div className="empty-state">Sem notificacoes.</div> : null}
          </div>
        </section>
      ) : null}

      <nav className="bottom-nav">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><Home size={19} /><span>Inicio</span></button>
        <button className={tab === "tickets" ? "active" : ""} onClick={() => setTab("tickets")}><Package size={19} /><span>Pendencias</span></button>
        <button className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}><CreditCard size={19} /><span>Pagamentos</span></button>
        <button className={tab === "disputes" ? "active" : ""} onClick={() => setTab("disputes")}><MessageSquarePlus size={19} /><span>Contestacoes</span></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={19} /><span>Perfil</span></button>
      </nav>
    </main>
  );
}

function TicketList({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length) return <div className="empty-state">Nenhuma pendencia.</div>;
  return (
    <div className="list-stack">
      {tickets.map((ticket) => (
        <article className="item-card" key={ticket.id}>
          <div>
            <strong>{ticket.operationalId}</strong>
            <span>{statusLabel(ticket.type)} · {ticket.baseName}</span>
          </div>
          <b>{formatCurrency(ticket.value)}</b>
          <small>{statusLabel(ticket.status)}</small>
          {ticket.detail ? <p>{ticket.detail}</p> : null}
        </article>
      ))}
    </div>
  );
}
