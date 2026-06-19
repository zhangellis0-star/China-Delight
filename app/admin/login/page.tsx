import { AdminLoginForm } from "@/components/orders/admin-login-form";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto flex max-w-md items-start px-4 py-8 sm:py-10">
      <AdminLoginForm />
    </section>
  );
}
