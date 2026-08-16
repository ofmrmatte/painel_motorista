"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, IdCard, KeyRound, MapPin, ShieldCheck } from "lucide-react";

type Mode = "login" | "first";
type FirstStep = "identify" | "pin";

async function readError(response: Response, fallback: string) {
  return response.json().then((body) => body.error || fallback).catch(() => fallback);
}

export function DriverAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [firstStep, setFirstStep] = useState<FirstStep>("identify");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ driverCode: "", pin: "" });
  const [first, setFirst] = useState({ driverCode: "", baseKey: "", pin: "", confirmPin: "" });

  async function submitLogin() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha ao entrar."));
      router.push("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function startFirstAccess() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/first-access/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverCode: first.driverCode, baseKey: first.baseKey }),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha no primeiro acesso."));
      setFirstStep("pin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no primeiro acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function createPin() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/first-access/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: first.pin, confirmPin: first.confirmPin }),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha ao criar PIN."));
      router.push("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-stack">
      <div className="segmented">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
        <button className={mode === "first" ? "active" : ""} onClick={() => setMode("first")}>Primeiro acesso</button>
      </div>

      {mode === "login" ? (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submitLogin(); }}>
          <label><span>ID do motorista</span><div className="field"><IdCard size={18} /><input value={login.driverCode} onChange={(event) => setLogin({ ...login, driverCode: event.target.value })} autoComplete="username" inputMode="text" required /></div></label>
          <label><span>PIN</span><div className="field"><KeyRound size={18} /><input value={login.pin} onChange={(event) => setLogin({ ...login, pin: event.target.value.replace(/\D/g, "").slice(0, 4) })} type="password" inputMode="numeric" autoComplete="current-password" pattern="\d{4}" maxLength={4} required /></div></label>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="primary-action" disabled={loading || login.pin.length !== 4} type="submit"><ShieldCheck size={18} />{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      ) : null}

      {mode === "first" && firstStep === "identify" ? (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void startFirstAccess(); }}>
          <label><span>ID do motorista</span><div className="field"><IdCard size={18} /><input value={first.driverCode} onChange={(event) => setFirst({ ...first, driverCode: event.target.value })} inputMode="text" required /></div></label>
          <label><span>Sigla da base</span><div className="field"><MapPin size={18} /><input value={first.baseKey} onChange={(event) => setFirst({ ...first, baseKey: event.target.value })} inputMode="text" autoComplete="organization" required /></div></label>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="primary-action" disabled={loading} type="submit"><ArrowRight size={18} />Continuar</button>
        </form>
      ) : null}

      {mode === "first" && firstStep === "pin" ? (
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void createPin(); }}>
          <label><span>Crie seu PIN</span><div className="pin-row"><input aria-label="PIN" value={first.pin} onChange={(event) => setFirst({ ...first, pin: event.target.value.replace(/\D/g, "").slice(0, 4) })} type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required /></div></label>
          <label><span>Confirmar PIN</span><div className="pin-row"><input aria-label="Confirmar PIN" value={first.confirmPin} onChange={(event) => setFirst({ ...first, confirmPin: event.target.value.replace(/\D/g, "").slice(0, 4) })} type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required /></div></label>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="primary-action" disabled={loading || first.pin.length !== 4 || first.confirmPin.length !== 4} type="submit"><KeyRound size={18} />Criar meu acesso</button>
        </form>
      ) : null}
    </div>
  );
}
