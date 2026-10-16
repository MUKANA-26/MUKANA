import { RoleLayout } from "@/components/layout/role-layout";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="employer">{children}</RoleLayout>;
}
