"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" className="w-full" disabled={pending} onClick={() => start(() => signOut())}>
      <LogOut size={18} /> Sign out
    </Button>
  );
}
