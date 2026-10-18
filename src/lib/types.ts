export type RoutineId = 'wake' | 'breakfast' | 'lunch' | 'dinner' | 'bed';

export type Routine = { id: RoutineId; weekday: string; weekend?: string };

export type Anchor = (
  | { routine: RoutineId; offsetMin: number }
  | { time: string }
) & { amount?: number };

export type Schedule =
  | { kind: 'daily'; at: Anchor[] }
  | { kind: 'weekdays'; days: number[]; at: Anchor[] }
  | { kind: 'interval'; everyDays: number; start: string; at: Anchor[] }
  | { kind: 'once'; when: string }
  | { kind: 'cycle'; on: number; off: number; start: string; at: Anchor[] }
  | { kind: 'prn'; minGapH?: number; maxPerDay?: number };

export type Unit = 'mg' | 'mcg' | 'g' | 'ml' | 'IU' | 'units';

export type Form =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'drops'
  | 'puff'
  | 'injection'
  | 'patch'
  | 'cream';

export type Food = 'before' | 'with' | 'after' | 'empty';

export type Shape = 'cap' | 'round' | 'oval';

export type Medicine = {
  id: string;
  name: string;
  strength?: { value: number; unit: Unit };
  form: Form;
  amount: number;
  doseUnit?: 'units' | 'ml' | 'mg' | 'mcg';
  insulin?: boolean;
  strengthLabel?: string;
  instructions?: string;
  site?: string;
  food?: Food;
  look: { shape: Shape; colors: string[] };
  schedule: Schedule;
  course?: { start: string; days?: number; end?: string };
  stock?: { count: number; refillAtDays: number; pack: number };
  notes?: string;
  archived?: boolean;
  created: string;
};

export type DoseStatus = 'taken' | 'skipped' | 'snoozed';

export type DoseLog = {
  medId: string;
  due: string;
  status: DoseStatus;
  amount?: number;
  at?: string;
  snoozeUntil?: string;
};

export type Scene = 'morning' | 'afternoon' | 'evening' | 'night';
