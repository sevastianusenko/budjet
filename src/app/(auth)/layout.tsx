import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Flame } from "lucide-react";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer) redirect("/home");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-12">
      <div className="mb-8 flex items-center gap-2 text-green-text">
        <Flame size={22} strokeWidth={2.2} />
        <span className="display text-xl font-semibold tracking-tight text-ink">Hearth</span>
      </div>
      {children}
    </div>
  );
}
