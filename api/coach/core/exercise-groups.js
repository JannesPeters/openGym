// Runtime-neutral state boundary, shared by the web app, API and read-only MCP bridge.
export const STATE_VERSION = 2;
export const isGroup = slot => slot?.kind === 'group';
export const groupOf = (state, slot) => (state?.exerciseGroups || []).find(group => group.id === slot?.groupId);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const ident = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const clone = value => structuredClone(value);
const nameOf = value => typeof value === 'string' ? value.trim().slice(0, 60) : '';
const legacyGroup = slot => object(slot) && (Array.isArray(slot.alternatives) || !!slot.groupName);
const META = new Set(['alternatives', 'slotId', 'groupName', 'sg', 'sgName', 'sgRest', 'needsConfig', 'choiceId',
  'choiceGroupId', 'choiceOptions', 'choiceRoutine', 'choicePending', 'optionId', 'entryId', 'groupInstance']);
export const prescriptionOf = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !META.has(key)));
const legacyOptions = slot => [prescriptionOf(slot), ...(slot.alternatives || []).map(prescriptionOf)];

export function deterministicGroupId(prefix, ...parts) {
  const text = JSON.stringify(parts);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return `${prefix}-${a.toString(36)}-${b.toString(36)}`;
}

export function assertStateVersion(state) {
  if (state?.stateVersion != null && ![1, STATE_VERSION].includes(state.stateVersion)) {
    throw Object.assign(new Error('This data format needs a newer version of openGym.'), { code: 'state-version' });
  }
}

export function resolvedOptions(slot, state) {
  if (!isGroup(slot)) return legacyOptions(slot);
  const group = groupOf(state, slot);
  if (!group) throw new Error('This exercise group is missing. Restore it or remove its placement.');
  return group.options.map(option => {
    const config = slot.optionConfigs?.[option.id];
    if (!object(config) || config.id !== option.exerciseId) return { id: option.exerciseId, optionId: option.id, needsConfig: true };
    return { ...config, optionId: option.id };
  });
}

export const workoutOptions = entry => entry?.groupInstance
  ? entry.groupInstance.options.map(option => ({ ...option.config, id: option.exerciseId, optionId: option.id }))
  : entry?.choiceOptions;
export const workoutGroupId = entry => entry?.groupInstance?.id || entry?.choiceGroupId || entry?.choiceId;
export const workoutGroupName = entry => nameOf(entry?.groupInstance?.name ?? entry?.groupName);

function unique(records, label) {
  if (!Array.isArray(records)) throw new Error(`Invalid ${label}: expected a list.`);
  const seen = new Set();
  for (const record of records) {
    if (!object(record) || !ident(record.id) || seen.has(record.id)) throw new Error(`Invalid ${label}: duplicate or missing identity.`);
    seen.add(record.id);
  }
}

// Drafts and missing per-placement settings are legal stored states, but never legal starts.
export function validateGroupState(state) {
  assertStateVersion(state);
  if (!object(state)) throw new Error('Invalid openGym state.');
  unique(state.exerciseGroups || [], 'exercise groups');
  const definitions = new Map((state.exerciseGroups || []).map(group => [group.id, group]));
  for (const group of definitions.values()) {
    if (typeof group.name !== 'string' || group.name.length > 60) throw new Error('Invalid exercise group name.');
    unique(group.options, 'exercise group options');
    if (new Set(group.options.map(option => option.exerciseId)).size !== group.options.length
      || group.options.some(option => !ident(option.exerciseId))) throw new Error('Invalid exercise group exercise identity.');
    if (group.archived != null && typeof group.archived !== 'boolean') throw new Error('Invalid exercise group archive flag.');
  }
  for (const routine of state.routines || []) {
    const slots = new Set();
    for (const slot of routine.ex || []) {
      if (!isGroup(slot)) {
        if (state.stateVersion === STATE_VERSION && legacyGroup(slot)) throw new Error('Inline exercise groups must be converted before writing version 2.');
        continue;
      }
      if (!ident(slot.slotId) || slots.has(slot.slotId) || !definitions.has(slot.groupId)
        || !object(slot.optionConfigs) || slot.id != null || slot.alternatives != null) {
        throw new Error('Invalid exercise group placement or missing definition.');
      }
      slots.add(slot.slotId);
      for (const [key, config] of Object.entries(slot.optionConfigs)) {
        if (!ident(key) || !object(config) || !ident(config.id)) throw new Error('Invalid exercise group prescription.');
      }
    }
  }
  for (const snapshot of state.coach?.snapshots || []) {
    validateGroupState({ ...snapshot, stateVersion: STATE_VERSION });
  }
  for (const session of [state.active, ...(state.workouts || [])].filter(Boolean)) {
    const instances = new Map(), entries = new Set();
    for (const entry of session.entries || []) {
      if (session === state.active && state.stateVersion === STATE_VERSION && entry.choiceOptions && !entry.groupInstance) {
        throw new Error('Legacy workout choices must be converted before writing version 2.');
      }
      if (!entry.groupInstance) continue;
      const instance = entry.groupInstance;
      if (!ident(instance.id) || !ident(entry.entryId) || entries.has(entry.entryId)
        || typeof instance.name !== 'string') throw new Error('Invalid workout group identity.');
      entries.add(entry.entryId);
      unique(instance.options, 'workout group options');
      if (instance.options.some(option => !ident(option.exerciseId) || !object(option.config) || option.config.id !== option.exerciseId)) {
        throw new Error('Invalid workout group prescription.');
      }
      const prior = instances.get(instance.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(instance)) throw new Error('Conflicting workout group snapshots.');
      instances.set(instance.id, instance);
      if (!entry.choicePending && !instance.options.some(option => option.id === entry.optionId && option.exerciseId === entry.id)) {
        throw new Error('Invalid selected exercise group option.');
      }
      if (entry.choicePending && (entry.id != null || (entry.sets || []).length)) throw new Error('An unselected group cannot contain exercise sets.');
    }
  }
  return state;
}

export function validateGroupStart(slot, state, exists) {
  const options = resolvedOptions(slot, state);
  if (!options.length) throw new Error('This exercise group is empty. Add an option before starting.');
  if (options.some(option => option.needsConfig)) throw new Error('An exercise group option needs its settings configured in this routine.');
  if (exists && options.some(option => !exists(option.id))) throw new Error('An exercise in this group is missing. Update the group before starting.');
  return options;
}

export function migrateExerciseGroups(input) {
  assertStateVersion(input);
  if (!object(input)) throw new Error('Invalid openGym state.');
  const needsMigration = input.stateVersion !== STATE_VERSION
    || (input.routines || []).some(r => (r.ex || []).some(slot => !isGroup(slot) && legacyGroup(slot)))
    || (input.coach?.snapshots || []).some(snapshot => (snapshot.routines || []).some(r =>
      (r.ex || []).some(slot => !isGroup(slot) && legacyGroup(slot))))
    || (input.active?.entries || []).some(entry => entry.choiceOptions && !entry.groupInstance);
  if (!needsMigration) return validateGroupState(input);
  const state = clone(input);
  state.exerciseGroups ||= [];
  const ids = new Set(state.exerciseGroups.map(group => group.id));
  for (const routine of state.routines || []) {
    routine.ex = (routine.ex || []).map((slot, index) => {
      if (isGroup(slot) || !legacyGroup(slot)) return slot;
      const occurrence = slot.slotId && routine.ex.filter(other => other.slotId === slot.slotId).length === 1
        ? slot.slotId : index;
      const groupId = deterministicGroupId('group', routine.id, occurrence);
      const slotId = slot.slotId || deterministicGroupId('slot', routine.id, index);
      const configs = legacyOptions(slot);
      const options = configs.map((config, i) => ({ id: deterministicGroupId('option', groupId, i, config.id), exerciseId: config.id }));
      if (ids.has(groupId)) throw new Error('Exercise group migration identity collision.');
      ids.add(groupId);
      state.exerciseGroups.push({ id: groupId, name: nameOf(slot.groupName), options });
      const meta = Object.fromEntries(['sg', 'sgName', 'sgRest'].filter(key => slot[key] != null).map(key => [key, slot[key]]));
      return { kind: 'group', slotId, groupId, ...meta, optionConfigs: Object.fromEntries(options.map((option, i) => [option.id, configs[i]])) };
    });
  }
  const active = state.active;
  if (active) {
    const snapshots = new Map();
    const legacyKey = (entry, index) => {
      if (entry.choiceGroupId) return entry.choiceGroupId;
      if (entry.choiceId && active.entries.some(other => other.choiceGroupId === entry.choiceId)) return entry.choiceId;
      const signature = item => JSON.stringify([item.rid || item.choiceRoutine?.id, item.slotId, nameOf(item.groupName), item.choiceOptions]);
      const members = entry.slotId ? active.entries.filter(other => other.choiceOptions && signature(other) === signature(entry)) : [entry];
      const explicit = [...new Set(members.map(other => other.choiceGroupId).filter(Boolean))];
      if (explicit.length === 1) return explicit[0];
      return (explicit.length > 1 ? entry.choiceId : members[0]?.choiceId)
        || deterministicGroupId('instance', active.id, entry.rid, entry.slotId ?? index);
    };
    const legacyKeys = (active.entries || []).map(legacyKey);
    (active.entries || []).forEach((entry, index) => {
      if (!entry.choiceOptions || entry.groupInstance) return;
      const key = legacyKeys[index];
      let instance = snapshots.get(key);
      if (!instance) {
        const sourceRid = entry.rid || entry.choiceRoutine?.id || active.routineId || active.routineIds?.[0];
        const routine = (state.routines || []).find(r => r.id === sourceRid);
        const placement = routine?.ex.find(slot => isGroup(slot) && slot.slotId === entry.slotId);
        const group = groupOf(state, placement);
        instance = {
          id: key, ...(group ? { groupId: group.id } : {}),
          ...(entry.slotId ? { slotId: entry.slotId } : {}), ...(sourceRid ? { rid: sourceRid } : {}),
          name: nameOf(entry.groupName),
          options: entry.choiceOptions.map((config, i) => ({
            id: group?.options.find(option => option.exerciseId === config.id)?.id || deterministicGroupId('option', key, i, config.id),
            exerciseId: config.id, config: prescriptionOf(config),
          })),
          ...(entry.choiceRoutine ? { routine: clone(entry.choiceRoutine) } : sourceRid ? { routine: {
            id: sourceRid, ...(routine?.prog ? { prog: routine.prog } : {}),
            ...(routine?.excludeFromProgression ? { excludeFromProgression: true } : {}),
          } } : {}),
        };
        snapshots.set(key, instance);
      }
      entry.groupInstance = clone(instance);
      entry.entryId = entry.choiceId || deterministicGroupId('entry', active.id, index);
      if (!entry.choicePending) entry.optionId = instance.options.find(option => option.exerciseId === entry.id)?.id;
      else {
        if (entry.sets?.length) throw new Error('An unselected legacy group contains sets. Resolve its selection before upgrading.');
        delete entry.id;
        entry.target = Object.fromEntries(['sg', 'sgName', 'sgRest'].filter(key => entry.target?.[key] != null).map(key => [key, entry.target[key]]));
        entry.sets = [];
        delete entry.plan;
        delete entry.planned;
      }
      for (const field of ['choiceOptions', 'choiceRoutine', 'choiceGroupId', 'choiceId', 'groupName']) delete entry[field];
    });
  }
  if (state.coach?.snapshots) {
    state.coach.snapshots = state.coach.snapshots.map(snapshot => {
      const converted = migrateExerciseGroups({ routines: snapshot.routines || [], exerciseGroups: snapshot.exerciseGroups || [] });
      return { ...snapshot, routines: converted.routines, exerciseGroups: converted.exerciseGroups };
    });
  }
  state.stateVersion = STATE_VERSION;
  return validateGroupState(state);
}
