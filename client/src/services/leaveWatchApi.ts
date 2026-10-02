/**
 * Client for the admin leave watch (/api/parliament/admin/leave-alerts). Unwraps the
 * `{ success, data }` envelope; types come from @shared/parliamentApi.
 */
import { apiRequest } from "@/lib/queryClient";
import type { AbsenceKind, ConfirmLeaveInput, LeaveAlertView } from "@shared/parliamentApi";

export type { ConfirmLeaveInput, LeaveAlertView } from "@shared/parliamentApi";

type Envelope<T> = { success: boolean; data: T };

const call = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  (await apiRequest<Envelope<T>>({ method, path, body })).data;

export const leaveWatchApi = {
  list: (scope: "open" | "all") => call<LeaveAlertView[]>("GET", `/api/parliament/admin/leave-alerts?status=${scope}`),
  confirm: (id: number, input: ConfirmLeaveInput) =>
    call<{ confirmed: boolean }>("POST", `/api/parliament/admin/leave-alerts/${id}/confirm`, input),
  dismiss: (id: number, note: string | null) =>
    call<{ dismissed: boolean }>("POST", `/api/parliament/admin/leave-alerts/${id}/dismiss`, { note }),
};

/** Display labels for the reasons a leave can be confirmed with. */
export const LEAVE_REASON_LABELS: Record<AbsenceKind, string> = {
  parental_leave: "Parental leave",
  medical_leave: "Medical leave",
  bereavement: "Bereavement",
  other_leave: "Other leave",
};
