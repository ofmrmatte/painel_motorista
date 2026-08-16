import Image from "next/image";
import { DriverAuthForm } from "@/components/driver-auth-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <Image src="/brand/alc-logo.png" alt="ALC" width={116} height={48} priority />
          <span>Portal do Motorista</span>
        </div>
        <DriverAuthForm />
      </section>
    </main>
  );
}

