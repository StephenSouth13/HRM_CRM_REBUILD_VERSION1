// Salary calculation utilities
// Based on formula: Net Salary = Base + Bonus - Deductions
// Base = (Working Days * Shift Rate) + (Overtime Hours * Overtime Rate)
// Bonus = KPI + Sales + Weekend + Other
// Deductions = Late Penalty + Absence Penalty + Violation Penalty

export interface SalaryInput {
  workingDays: number;
  shiftRate: number;
  overtimeHours: number;
  overtimeRate: number;
  kpiBonus: number;
  salesBonus: number;
  weekendBonus: number;
  otherBonus: number;
  lateCount: number;
  latePenaltyPerTime: number;
  absenceCount: number;
  absencePenaltyPerDay: number;
  violationPenalty: number;
}

export interface SalaryBreakdown {
  baseSalary: number;         // Working days * shift rate
  overtimePay: number;        // Overtime hours * overtime rate
  totalBonus: number;         // Sum of all bonuses
  totalDeductions: number;    // Sum of all penalties
  netSalary: number;          // Final amount
  details: {
    shiftSalary: number;
    overtimeSalary: number;
    kpiBonus: number;
    salesBonus: number;
    weekendBonus: number;
    otherBonus: number;
    latePenalty: number;
    absencePenalty: number;
    violationPenalty: number;
  };
}

export function calculateSalary(input: SalaryInput): SalaryBreakdown {
  // Calculate base components
  const shiftSalary = input.workingDays * input.shiftRate;
  const overtimeSalary = input.overtimeHours * input.overtimeRate;
  const baseSalary = shiftSalary + overtimeSalary;

  // Calculate bonuses
  const totalBonus = input.kpiBonus + input.salesBonus + input.weekendBonus + input.otherBonus;

  // Calculate deductions/penalties
  const latePenalty = input.lateCount * input.latePenaltyPerTime;
  const absencePenalty = input.absenceCount * input.absencePenaltyPerDay;
  const totalDeductions = latePenalty + absencePenalty + input.violationPenalty;

  // Final calculation
  const netSalary = Math.max(0, baseSalary + totalBonus - totalDeductions);

  return {
    baseSalary,
    overtimePay: overtimeSalary,
    totalBonus,
    totalDeductions,
    netSalary,
    details: {
      shiftSalary,
      overtimeSalary,
      kpiBonus: input.kpiBonus,
      salesBonus: input.salesBonus,
      weekendBonus: input.weekendBonus,
      otherBonus: input.otherBonus,
      latePenalty,
      absencePenalty,
      violationPenalty: input.violationPenalty,
    },
  };
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactVND(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return formatVND(amount);
}

// Calculate working data from attendance records
export interface AttendanceRecord {
  user_id: string;
  timestamp: string;
  type: 'check_in' | 'check_out';
}

export interface ShiftInfo {
  start_time: string; // HH:mm format
  end_time: string;
}

export interface WorkingDataResult {
  totalDays: number;
  totalHours: number;
  overtimeHours: number;
  lateCount: number;
  earlyLeaveCount: number;
}

export function calculateWorkingData(
  attendance: AttendanceRecord[],
  month: string,
  expectedShift?: ShiftInfo
): WorkingDataResult {
  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  // Filter attendance for the specific month
  const monthAttendance = attendance.filter(a => {
    const date = new Date(a.timestamp);
    return date >= monthStart && date <= monthEnd;
  });

  // Group by date
  const dateGroups: Record<string, AttendanceRecord[]> = {};
  monthAttendance.forEach(record => {
    const date = record.timestamp.split('T')[0];
    if (!dateGroups[date]) dateGroups[date] = [];
    dateGroups[date].push(record);
  });

  let totalDays = 0;
  let totalHours = 0;
  let overtimeHours = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;

  const STANDARD_HOURS_PER_DAY = 8;

  Object.values(dateGroups).forEach(dayRecords => {
    const checkIn = dayRecords.find(r => r.type === 'check_in');
    const checkOut = dayRecords.find(r => r.type === 'check_out');

    if (checkIn && checkOut) {
      totalDays++;
      const hoursWorked = (new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60 * 60);
      totalHours += hoursWorked;

      // Calculate overtime (hours > 8 per day)
      if (hoursWorked > STANDARD_HOURS_PER_DAY) {
        overtimeHours += hoursWorked - STANDARD_HOURS_PER_DAY;
      }

      // Check for late arrival if shift info is provided
      if (expectedShift) {
        const checkInTime = new Date(checkIn.timestamp);
        const [shiftHour, shiftMinute] = expectedShift.start_time.split(':').map(Number);
        const expectedStart = new Date(checkInTime);
        expectedStart.setHours(shiftHour, shiftMinute, 0, 0);

        if (checkInTime > expectedStart) {
          lateCount++;
        }

        // Check for early leave
        const checkOutTime = new Date(checkOut.timestamp);
        const [endHour, endMinute] = expectedShift.end_time.split(':').map(Number);
        const expectedEnd = new Date(checkOutTime);
        expectedEnd.setHours(endHour, endMinute, 0, 0);

        if (checkOutTime < expectedEnd) {
          earlyLeaveCount++;
        }
      }
    }
  });

  return {
    totalDays,
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    lateCount,
    earlyLeaveCount,
  };
}
