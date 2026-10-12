/**
 * Client for the admin leave watch (/api/parliament/admin/leave-alerts). Types come from
 * @shared/parliamentApi.
 */
import { apiCall as call } from "@/lib/api";
import type { AbsenceKind, ConfirmLeaveInput, LeaveAlertView } from "@shared/parliamentApi";

export type { ConfirmLeaveInput, LeaveAlertView } from "@shared/parliamentApi";

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
