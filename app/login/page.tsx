import Image from "next/image";
import { DriverAuthForm } from "@/components/driver-auth-form";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.shell}>
      <header className={styles.brand}>
        <Image src="/brand/alc-logo.png" alt="ALC Pereira Filho & Transportes" width={116} height={48} priority />
        <span className={styles.portalLabel}>Portal do Motorista</span>
      </header>

      <section className={styles.content}>
        <div className={styles.intro}>
          <span>Acesso do motorista</span>
          <h1>Seus pagamentos e pendências em um só lugar.</h1>
          <p>Consulte demonstrativos, acompanhe ocorrências e abra contestações de pagamento com segurança.</p>
        </div>

        <div className={styles.panel}>
          <DriverAuthForm />
        </div>
      </section>

      <footer className={styles.footer}>ALC Pereira Filho & Transportes · Ambiente de acesso restrito aos motoristas cadastrados.</footer>
    </main>
  );
}
