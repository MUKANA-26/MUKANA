import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/types/db";
import { STATUS_LABEL, STATUS_VARIANT } from "./status";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
