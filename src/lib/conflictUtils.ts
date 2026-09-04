import { format } from "date-fns";

export interface AppointmentTimeslotInfo {
  id: string;
  start_time: string;
  end_time: string;
  department_id?: string;
  departments?: { name: string } | null;
}

export interface GenericAppointment {
  id: string;
  requester_id: string;
  status: string;
  timeslot_id: string;
  timeslots: AppointmentTimeslotInfo;
  [key: string]: any;
}

export interface ConflictResult {
  hasConflict: boolean;
  isOverlap?: boolean;
  isDisplacement?: boolean;
  conflictingAppointment?: GenericAppointment;
  message?: string;
}

/**
 * Checks if a candidate timeslot or existing appointment conflicts with a list of active appointments for the same requester.
 */
export function checkAppointmentConflict(
  targetApptId: string | null,
  targetSlot: { start_time: string; end_time: string },
  activeAppointments: GenericAppointment[],
  displacementMins: number = 15
): ConflictResult {
  const tsStart = new Date(targetSlot.start_time).getTime();
  const tsEnd = new Date(targetSlot.end_time).getTime();

  for (const appt of activeAppointments) {
    if (targetApptId && appt.id === targetApptId) continue;
    if (appt.status !== "active" || !appt.timeslots) continue;

    const appStart = new Date(appt.timeslots.start_time).getTime();
    const appEnd = new Date(appt.timeslots.end_time).getTime();
    const deptName = appt.timeslots.departments?.name || "outro setor";

    // 1. Direct Overlap Check: tsStart < appEnd && tsEnd > appStart
    if (tsStart < appEnd && tsEnd > appStart) {
      return {
        hasConflict: true,
        isOverlap: true,
        conflictingAppointment: appt,
        message: `Choque direto de horário com agendamento no setor ${deptName} (${format(appStart, "HH:mm")} - ${format(appEnd, "HH:mm")}).`
      };
    }

    // 2. Insufficient Travel Gap Check (when displacementMins > 0)
    if (displacementMins > 0) {
      if (appStart >= tsEnd) {
        const gapMinutes = (appStart - tsEnd) / 60000;
        if (gapMinutes < displacementMins) {
          return {
            hasConflict: true,
            isDisplacement: true,
            conflictingAppointment: appt,
            message: `Deslocamento curto: Apenas ${Math.round(gapMinutes)} min de intervalo antes do atendimento das ${format(appStart, "HH:mm")} no setor ${deptName} (mínimo exigido: ${displacementMins} min).`
          };
        }
      } else if (tsStart >= appEnd) {
        const gapMinutes = (tsStart - appEnd) / 60000;
        if (gapMinutes < displacementMins) {
          return {
            hasConflict: true,
            isDisplacement: true,
            conflictingAppointment: appt,
            message: `Deslocamento curto: Apenas ${Math.round(gapMinutes)} min de intervalo após o atendimento das ${format(appEnd, "HH:mm")} no setor ${deptName} (mínimo exigido: ${displacementMins} min).`
          };
        }
      }
    }
  }

  return { hasConflict: false };
}
