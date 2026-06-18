import type { Assignment, PlanConfig, Slot, Teacher } from '../types/model';
import { isAllowedTeacherClassCombo, qualKey, sectionToGender } from '../types/model';

// ---------------------------------------------------------------------------
// Deterministic greedy construction + bounded local-search repair.
// The instance is tiny (tens of teachers, low-hundreds of slots) so a bespoke
// heuristic is fast, explainable, and degrades to "best partial" when short-staffed.
// ---------------------------------------------------------------------------

export interface SolveInput {
  slots: Slot[];
  teachers: Teacher[]; // pass only the relevant term roster; inactive are filtered out
  config: PlanConfig;
  existing?: Assignment[]; // locked manual edits are preserved & seed the state
}

export interface SolveResult {
  assignments: Assignment[];
}

/** Stable [0,1) hash for deterministic tie-breaks. */
function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Mutable aggregates maintained incrementally as slots are (un)committed. */
class SolverState {
  load = new Map<string, number>();
  // teacherId -> subjectId -> set of classGroupIds
  subjClasses = new Map<string, Map<string, Set<string>>>();
  // teacherId -> classGroupId -> non-tahfidz sks
  classLoad = new Map<string, Map<string, number>>();
  // teacherId -> classGroupId -> slots held (tahfidz included) for the per-class rule
  classSlots = new Map<string, Map<string, Slot[]>>();
  // slotId -> teacherId | null
  assign = new Map<string, string | null>();

  loadOf(t: string) {
    return this.load.get(t) ?? 0;
  }

  classesForSubject(t: string, subjectId: string): Set<string> | undefined {
    return this.subjClasses.get(t)?.get(subjectId);
  }

  classLoadOf(t: string, classGroupId: string): number {
    return this.classLoad.get(t)?.get(classGroupId) ?? 0;
  }

  slotsInClass(t: string, classGroupId: string): Slot[] {
    return this.classSlots.get(t)?.get(classGroupId) ?? [];
  }

  commit(teacherId: string, slot: Slot) {
    this.assign.set(slot.id, teacherId);
    this.load.set(teacherId, this.loadOf(teacherId) + slot.sks);
    let bySlotClass = this.classSlots.get(teacherId);
    if (!bySlotClass) this.classSlots.set(teacherId, (bySlotClass = new Map()));
    const arr = bySlotClass.get(slot.classGroupId);
    if (arr) arr.push(slot);
    else bySlotClass.set(slot.classGroupId, [slot]);
    if (!slot.isTahfidz) {
      let bySubj = this.subjClasses.get(teacherId);
      if (!bySubj) this.subjClasses.set(teacherId, (bySubj = new Map()));
      let set = bySubj.get(slot.subjectId);
      if (!set) bySubj.set(slot.subjectId, (set = new Set()));
      set.add(slot.classGroupId);

      let byClass = this.classLoad.get(teacherId);
      if (!byClass) this.classLoad.set(teacherId, (byClass = new Map()));
      byClass.set(slot.classGroupId, (byClass.get(slot.classGroupId) ?? 0) + slot.sks);
    }
  }

  remove(teacherId: string, slot: Slot) {
    this.assign.set(slot.id, null);
    this.load.set(teacherId, this.loadOf(teacherId) - slot.sks);
    const slotArr = this.classSlots.get(teacherId)?.get(slot.classGroupId);
    if (slotArr) {
      const i = slotArr.findIndex((s) => s.id === slot.id);
      if (i >= 0) slotArr.splice(i, 1);
      if (slotArr.length === 0) this.classSlots.get(teacherId)!.delete(slot.classGroupId);
    }
    if (!slot.isTahfidz) {
      const set = this.subjClasses.get(teacherId)?.get(slot.subjectId);
      if (set) {
        // only drop the class if no other slot of this subject in that class is held
        // (a teacher holds at most one slot per (class,subject), so safe to delete)
        set.delete(slot.classGroupId);
      }
      const byClass = this.classLoad.get(teacherId);
      if (byClass) {
        const next = (byClass.get(slot.classGroupId) ?? 0) - slot.sks;
        if (next <= 0) byClass.delete(slot.classGroupId);
        else byClass.set(slot.classGroupId, next);
      }
    }
  }
}

function canTake(state: SolverState, t: Teacher, slot: Slot, config: PlanConfig): boolean {
  if (sectionToGender(slot.section) !== t.gender) return false;
  if (!t.qualifiedKeys.includes(qualKey(slot.level, slot.subjectId))) return false;
  if (state.loadOf(t.id) + slot.sks > t.maxSks) return false;
  // At most one subject per class, except the 4-SKS-subject + Hifzhul Qur'an pairing.
  const held = state.slotsInClass(t.id, slot.classGroupId);
  if (held.length > 0 && !isAllowedTeacherClassCombo([...held, slot])) return false;
  if (!slot.isTahfidz) {
    const classes = state.classesForSubject(t.id, slot.subjectId);
    const distinct = classes?.size ?? 0;
    const alreadyHere = classes?.has(slot.classGroupId) ?? false;
    const after = alreadyHere ? distinct : distinct + 1;
    if (after > config.maxClassesPerSubjectPerTeacher) return false;
  }
  return true;
}

/** Greedy per-slot cost: lower is better. */
function greedyCost(state: SolverState, t: Teacher, slot: Slot, config: PlanConfig): number {
  const w = config.weights;
  let c = 0;
  const relaxedTarget = Math.min(config.targetMinSksPerTeacher, t.maxSks);
  const deficit = Math.max(0, relaxedTarget - state.loadOf(t.id));
  c -= w.underTargetPenalty * Math.min(deficit, slot.sks);
  if (!slot.isTahfidz) {
    const after = state.classLoadOf(t.id, slot.classGroupId) + slot.sks;
    if (after > config.maxSksPerTeacherPerClass) {
      c += w.perClassVarietyPenalty * (after - config.maxSksPerTeacherPerClass);
    }
  }
  c += w.loadBalancePenalty * state.loadOf(t.id);
  c += hash01(t.id) * 1e-3;
  return c;
}

/** Global objective for the repair phase: lower is better. */
function objective(state: SolverState, teachers: Teacher[], config: PlanConfig): number {
  const w = config.weights;
  let obj = 0;
  for (const t of teachers) {
    const load = state.loadOf(t.id);
    const relaxed = Math.min(config.targetMinSksPerTeacher, t.maxSks);
    obj += w.underTargetPenalty * Math.max(0, relaxed - load);
    obj += (w.loadBalancePenalty * load * load) / 100; // mild convex balance
    const cl = state.classLoad.get(t.id);
    if (cl) {
      for (const sks of cl.values()) {
        if (sks > config.maxSksPerTeacherPerClass) {
          obj += w.perClassVarietyPenalty * (sks - config.maxSksPerTeacherPerClass);
        }
      }
    }
  }
  return obj;
}

function sortSlots(slots: Slot[], teachers: Teacher[]): Slot[] {
  const feasibleCount = (slot: Slot) =>
    teachers.filter(
      (t) =>
        sectionToGender(slot.section) === t.gender &&
        t.qualifiedKeys.includes(qualKey(slot.level, slot.subjectId)),
    ).length;
  return [...slots].sort((a, b) => {
    const fa = feasibleCount(a);
    const fb = feasibleCount(b);
    if (fa !== fb) return fa - fb; // most constrained first
    if (a.sks !== b.sks) return b.sks - a.sks; // heavier first
    return a.id < b.id ? -1 : 1; // deterministic
  });
}

export function autoAssign(input: SolveInput): SolveResult {
  const { config } = input;
  const teachers = input.teachers.filter((t) => t.active);
  const slotById = new Map(input.slots.map((s) => [s.id, s]));
  const state = new SolverState();

  // Seed locked manual assignments — never touched, but they consume capacity.
  const lockedSlotIds = new Set<string>();
  for (const a of input.existing ?? []) {
    if (a.locked && a.teacherId) {
      const slot = slotById.get(a.slotId);
      const t = teachers.find((x) => x.id === a.teacherId);
      if (slot && t) {
        state.commit(a.teacherId, slot);
        lockedSlotIds.add(a.slotId);
      }
    }
  }

  const openSlots = input.slots.filter((s) => !lockedSlotIds.has(s.id));

  // ---- Greedy construction ----
  for (const slot of sortSlots(openSlots, teachers)) {
    const candidates = teachers.filter((t) => canTake(state, t, slot, config));
    if (candidates.length === 0) {
      state.assign.set(slot.id, null);
      continue;
    }
    let best = candidates[0];
    let bestCost = greedyCost(state, best, slot, config);
    for (let i = 1; i < candidates.length; i++) {
      const cost = greedyCost(state, candidates[i], slot, config);
      if (cost < bestCost) {
        bestCost = cost;
        best = candidates[i];
      }
    }
    state.commit(best.id, slot);
  }

  // ---- Local-search repair ----
  const MAX_PASSES = 30;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    // (A) reassign each open slot to whichever feasible teacher lowers the objective
    for (const slot of openSlots) {
      const cur = state.assign.get(slot.id) ?? null;
      if (cur) state.remove(cur, slot);
      let best: string | null = null;
      let bestObj = Infinity;
      for (const t of teachers) {
        if (!canTake(state, t, slot, config)) continue;
        state.commit(t.id, slot);
        const o = objective(state, teachers, config);
        state.remove(t.id, slot);
        if (o < bestObj - 1e-9) {
          bestObj = o;
          best = t.id;
        }
      }
      if (best) {
        state.commit(best, slot);
        if (best !== cur) improved = true;
      } else {
        state.assign.set(slot.id, null);
        if (cur !== null) improved = true;
      }
    }

    // (B) one swap pass to escape local minima
    for (let i = 0; i < openSlots.length; i++) {
      for (let j = i + 1; j < openSlots.length; j++) {
        const s1 = openSlots[i];
        const s2 = openSlots[j];
        const t1 = state.assign.get(s1.id) ?? null;
        const t2 = state.assign.get(s2.id) ?? null;
        if (!t1 || !t2 || t1 === t2) continue;
        const T1 = teachers.find((t) => t.id === t1)!;
        const T2 = teachers.find((t) => t.id === t2)!;
        const before = objective(state, teachers, config);
        state.remove(t1, s1);
        state.remove(t2, s2);
        if (canTake(state, T2, s1, config) && canTake(state, T1, s2, config)) {
          state.commit(T2.id, s1);
          state.commit(T1.id, s2);
          const after = objective(state, teachers, config);
          if (after < before - 1e-9) {
            improved = true;
          } else {
            // revert
            state.remove(T2.id, s1);
            state.remove(T1.id, s2);
            state.commit(t1, s1);
            state.commit(t2, s2);
          }
        } else {
          // revert removals
          state.commit(t1, s1);
          state.commit(t2, s2);
        }
      }
    }

    if (!improved) break;
  }

  // ---- Emit assignments (one per slot) ----
  const assignments: Assignment[] = input.slots.map((slot) => {
    if (lockedSlotIds.has(slot.id)) {
      const a = (input.existing ?? []).find((x) => x.slotId === slot.id)!;
      return { ...a };
    }
    return {
      slotId: slot.id,
      teacherId: state.assign.get(slot.id) ?? null,
      locked: false,
      source: 'auto',
    };
  });

  return { assignments };
}
