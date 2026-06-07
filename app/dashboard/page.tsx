import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground/60">{user.email}</p>
        <Link
          href="/picks"
          className="rounded-md bg-foreground px-6 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80"
        >
          Make your picks
        </Link>
      </div>
    </main>
  );
}
