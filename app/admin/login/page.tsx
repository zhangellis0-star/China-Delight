import { AdminLoginForm } from "@/components/orders/admin-login-form";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
      <AdminLoginForm />
    </section>
  );
}
