import { AuthForm } from "@/components/auth/AuthForm";
import type { SearchParams } from "@/lib/queries";

export const metadata = { title: "Join a household" };

export default async function JoinPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.toUpperCase().slice(0, 6) : undefined;
  return <AuthForm mode="join" inviteCode={code} />;
}
