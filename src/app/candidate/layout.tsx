import { RoleLayout } from "@/components/layout/role-layout";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="candidate">{children}</RoleLayout>;
}
