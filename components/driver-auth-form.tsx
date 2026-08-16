"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  IdCard,
  KeyRound,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import styles from "./driver-auth-form.module.css";

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
  const [loadingLabel, setLoadingLabel] = useState("");
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ driverCode: "", pin: "" });
  const [first, setFirst] = useState({ driverCode: "", baseKey: "", pin: "", confirmPin: "" });

  function changeMode(nextMode: Mode) {
    if (loading) return;
    setMode(nextMode);
    setMessage("");
    if (nextMode === "first") setFirstStep("identify");
  }

  async function submitLogin() {
    if (loading) return;
    setLoading(true);
    setLoadingLabel("Validando seu acesso...");
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha ao entrar."));

      setLoadingLabel("Acesso confirmado. Abrindo portal...");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao entrar.");
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function startFirstAccess() {
    if (loading) return;
    setLoading(true);
    setLoadingLabel("Validando seus dados...");
    setMessage("");

    try {
      const response = await fetch("/api/auth/first-access/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverCode: first.driverCode, baseKey: first.baseKey }),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha no primeiro acesso."));
      setFirstStep("pin");
      setLoading(false);
      setLoadingLabel("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no primeiro acesso.");
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function createPin() {
    if (loading) return;
    setLoading(true);
    setLoadingLabel("Criando seu acesso...");
    setMessage("");

    try {
      const response = await fetch("/api/auth/first-access/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: first.pin, confirmPin: first.confirmPin }),
      });
      if (!response.ok) throw new Error(await readError(response, "Falha ao criar PIN."));

      setLoadingLabel("Acesso criado. Abrindo portal...");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar PIN.");
      setLoading(false);
      setLoadingLabel("");
    }
  }

  return (
    <div className={styles.authStack} aria-busy={loading}>
      <div className={styles.segmented} role="tablist" aria-label="Forma de acesso">
        <button
          type="button"
          className={mode === "login" ? styles.active : ""}
          onClick={() => changeMode("login")}
          role="tab"
          aria-selected={mode === "login"}
          disabled={loading}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === "first" ? styles.active : ""}
          onClick={() => changeMode("first")}
          role="tab"
          aria-selected={mode === "first"}
          disabled={loading}
        >
          Primeiro acesso
        </button>
      </div>

      {mode === "login" ? (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submitLogin(); }}>
          <div className={styles.formHeading}>
            <strong>Bem-vindo de volta</strong>
            <span>Use seu ID de motorista e o PIN de 4 dígitos.</span>
          </div>

          <label className={styles.label}>
            <span>ID do motorista</span>
            <div className={styles.field}>
              <IdCard size={18} />
              <input
                value={login.driverCode}
                onChange={(event) => setLogin({ ...login, driverCode: event.target.value })}
                autoComplete="username"
                inputMode="text"
                placeholder="Digite seu ID"
                disabled={loading}
                required
              />
            </div>
          </label>

          <label className={styles.label}>
            <span>PIN</span>
            <div className={styles.field}>
              <KeyRound size={18} />
              <input
                value={login.pin}
                onChange={(event) => setLogin({ ...login, pin: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                disabled={loading}
                required
              />
            </div>
          </label>

          {message ? <p className={styles.errorMessage} role="alert">{message}</p> : null}

          <button
            className={styles.primaryAction}
            disabled={loading || !login.driverCode.trim() || login.pin.length !== 4}
            type="submit"
          >
            {loading ? <LoaderCircle className={styles.spinner} size={19} /> : <ShieldCheck size={18} />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      ) : null}

      {mode === "first" ? (
        <div className={styles.firstAccessHeader}>
          <div className={`${styles.stepDot} ${firstStep === "identify" ? styles.current : styles.done}`}>
            {firstStep === "pin" ? <CheckCircle2 size={14} /> : "1"}
          </div>
          <span className={styles.stepLine} />
          <div className={`${styles.stepDot} ${firstStep === "pin" ? styles.current : ""}`}>2</div>
          <div className={styles.stepCopy}>
            <strong>{firstStep === "identify" ? "Confirme seus dados" : "Crie seu PIN"}</strong>
            <span>Etapa {firstStep === "identify" ? "1" : "2"} de 2</span>
          </div>
        </div>
      ) : null}

      {mode === "first" && firstStep === "identify" ? (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void startFirstAccess(); }}>
          <p className={styles.helperText}>Informe os dados cadastrados pela operação para validar sua identificação.</p>

          <label className={styles.label}>
            <span>ID do motorista</span>
            <div className={styles.field}>
              <IdCard size={18} />
              <input
                value={first.driverCode}
                onChange={(event) => setFirst({ ...first, driverCode: event.target.value })}
                inputMode="text"
                autoComplete="username"
                placeholder="Digite seu ID"
                disabled={loading}
                required
              />
            </div>
          </label>

          <label className={styles.label}>
            <span>Sigla da base</span>
            <div className={styles.field}>
              <MapPin size={18} />
              <input
                value={first.baseKey}
                onChange={(event) => setFirst({ ...first, baseKey: event.target.value.toUpperCase() })}
                inputMode="text"
                autoComplete="organization"
                placeholder="Ex.: SSP5"
                disabled={loading}
                required
              />
            </div>
          </label>

          {message ? <p className={styles.errorMessage} role="alert">{message}</p> : null}

          <button className={styles.primaryAction} disabled={loading || !first.driverCode.trim() || !first.baseKey.trim()} type="submit">
            {loading ? <LoaderCircle className={styles.spinner} size={19} /> : <ArrowRight size={18} />}
            {loading ? "Validando..." : "Continuar"}
          </button>
        </form>
      ) : null}

      {mode === "first" && firstStep === "pin" ? (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void createPin(); }}>
          <p className={styles.helperText}>Escolha um PIN numérico de 4 dígitos. Ele será usado nos próximos acessos.</p>

          <label className={styles.label}>
            <span>Crie seu PIN</span>
            <div className={`${styles.field} ${styles.pinField}`}>
              <KeyRound size={18} />
              <input
                aria-label="PIN"
                value={first.pin}
                onChange={(event) => setFirst({ ...first, pin: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                disabled={loading}
                required
              />
            </div>
          </label>

          <label className={styles.label}>
            <span>Confirmar PIN</span>
            <div className={`${styles.field} ${styles.pinField}`}>
              <ShieldCheck size={18} />
              <input
                aria-label="Confirmar PIN"
                value={first.confirmPin}
                onChange={(event) => setFirst({ ...first, confirmPin: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                disabled={loading}
                required
              />
            </div>
          </label>

          {message ? <p className={styles.errorMessage} role="alert">{message}</p> : null}

          <div className={styles.pinActions}>
            <button
              className={styles.secondaryAction}
              type="button"
              disabled={loading}
              onClick={() => { setFirstStep("identify"); setMessage(""); }}
            >
              <ArrowLeft size={17} /> Voltar
            </button>
            <button
              className={styles.primaryAction}
              disabled={loading || first.pin.length !== 4 || first.confirmPin.length !== 4}
              type="submit"
            >
              {loading ? <LoaderCircle className={styles.spinner} size={19} /> : <KeyRound size={18} />}
              {loading ? "Criando..." : "Criar acesso"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className={styles.loadingOverlay} role="status" aria-live="polite">
          <div className={styles.loadingCard}>
            <LoaderCircle className={styles.spinner} size={30} />
            <strong>{loadingLabel || "Processando..."}</strong>
            <span>Não feche esta tela.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
