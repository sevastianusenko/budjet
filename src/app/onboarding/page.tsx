import { requireViewer } from "@/lib/auth";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const viewer = await requireViewer();
  return (
    <ToastProvider>
      <Onboarding name={viewer.user.name} householdName={viewer.household.name} inviteCode={viewer.household.inviteCode} done={Boolean(viewer.household.onboardedAt)} />
    </ToastProvider>
  );
}
