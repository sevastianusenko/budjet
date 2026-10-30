import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export default async function RootPage() {
  const viewer = await getViewer();
  redirect(viewer ? "/home" : "/login");
}
