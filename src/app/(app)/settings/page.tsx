import Link from "next/link";
import { Camera, ChevronRight, Download, FileSpreadsheet, FileText, ListTree, ReceiptText } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { HouseholdForm } from "@/components/settings/HouseholdForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { InviteCard } from "@/components/settings/InviteCard";
import { MembersList } from "@/components/settings/MembersList";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { SectionTitle } from "@/components/ui/Bits";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { DangerZone } from "@/components/settings/DangerZone";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const h = viewer.household;

  return (
    <div className="space-y-6">
      <h1 className="display pt-2 text-2xl font-semibold tracking-tight">Settings</h1>

      <section>
        <SectionTitle>Household</SectionTitle>
        <div className="space-y-3">
          <HouseholdForm name={h.name} needsPct={h.needsPct} wantsPct={h.wantsPct} savingsPct={h.savingsPct} expectedIncomeCents={h.expectedIncomeCents} comparisonProfile={h.comparisonProfile} tithePct={h.tithePct} />
          <InviteCard code={h.inviteCode} />
        </div>
      </section>

      <section>
        <SectionTitle>Members</SectionTitle>
        <MembersList members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color, role: m.role, email: m.email }))} meId={viewer.user.id} isOwner={viewer.user.role === "owner"} />
      </section>

      <section>
        <SectionTitle>You</SectionTitle>
        <div className="space-y-3">
          <ProfileForm name={viewer.user.name} color={viewer.user.color} />
          <PasswordForm />
        </div>
      </section>

      <section>
        <SectionTitle>Appearance</SectionTitle>
        <ThemeToggle />
      </section>

      <section>
        <SectionTitle>Setup</SectionTitle>
        <ul className="divide-y divide-line rounded-card bg-card shadow-card">
          <li>
            <Link href="/settings/categories" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <ListTree size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Categories</span>
              <span className="text-xs text-ink-3">{data.categories.filter((c) => !c.archived).length}</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/settings/bills" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <ReceiptText size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Recurring bills</span>
              <span className="text-xs text-ink-3">{data.recurring.filter((r) => r.active).length}</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/import" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <Camera size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Import a receipt</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/import/csv" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <FileSpreadsheet size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Import past months (CSV)</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/report" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <FileText size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Report: month, quarter, year (print / PDF)</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <Link href="/receipts" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <ReceiptText size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Receipt history</span>
              <ChevronRight size={18} className="text-ink-3" />
            </Link>
          </li>
          <li>
            <a href="/api/export" className="flex items-center gap-3 px-4 py-3.5 hover:bg-card-2/60">
              <Download size={20} className="text-ink-2" />
              <span className="flex-1 text-[15px] font-medium">Export everything as CSV</span>
              <ChevronRight size={18} className="text-ink-3" />
            </a>
          </li>
        </ul>
      </section>

      <SignOutButton />
      {viewer.user.role === "owner" && <DangerZone householdName={h.name} />}
      <p className="px-1 text-center text-xs text-ink-3">Hearth · your data stays in your own database.</p>
    </div>
  );
}
