import { afterEach, describe, expect, it } from 'vitest'
import { EXIDX, mediaExerciseOf, registerCustom } from './exercises.js'
import {
  baseExerciseIdOf, groupExerciseVariants, referencedCustomExercises,
  variantBaseName, variantLabelOf, variantName,
} from './exercise-variants.js'

afterEach(() => registerCustom([]))

describe('exercise variants', () => {
  it('keeps a variant id independent and derives its display name from the base snapshot and label', () => {
    const variant = { id: 'machine-a', n: 'lever chest press (Nautilus)', baseExerciseId: '0576', variantLabel: 'Nautilus' }
    expect(baseExerciseIdOf(variant)).toBe('0576')
    expect(variantLabelOf(variant)).toBe('Nautilus')
    expect(variantBaseName(variant)).toBe('lever chest press')
    expect(variantName('lever chest press', 'Gym80')).toBe('lever chest press (Gym80)')
    expect(baseExerciseIdOf({ id: 'same', baseExerciseId: 'same' })).toBeNull()
  })

  it('keeps variants beside their base after sorting and still returns matches without the base', () => {
    const base = { id: '0576', n: 'lever chest press' }
    const nautilus = { id: 'nautilus', baseExerciseId: base.id, variantLabel: 'Nautilus', n: 'lever chest press (Nautilus)' }
    const gym80 = { id: 'gym80', baseExerciseId: base.id, variantLabel: 'Gym80', n: 'lever chest press (Gym80)' }
    const other = { id: 'other', n: 'row' }
    expect(groupExerciseVariants([gym80, other, nautilus, base])).toEqual([base, gym80, nautilus, other])
    expect(groupExerciseVariants([gym80, other])).toEqual([gym80, other])
    expect(groupExerciseVariants([other])).toEqual([other])
  })

  it('includes a custom base when a shared plan only uses its variant', () => {
    const base = { id: 'custom-base', n: 'Lever Chest Press', bp: 'chest', custom: true }
    const variant = { id: 'custom-variant', n: 'Lever Chest Press (Nautilus)', baseExerciseId: base.id, variantLabel: 'Nautilus', bp: 'chest', custom: true }
    expect(referencedCustomExercises([null, base, variant], [variant.id])).toEqual([base, variant])
    expect(referencedCustomExercises([variant], [variant.id])).toEqual([variant])
  })

  it('uses the base exercise media only until the variant has its own', () => {
    const variant = { id: 'machine-a', n: 'lever chest press (Nautilus)', bp: 'chest', custom: true, baseExerciseId: '0576', variantLabel: 'Nautilus' }
    registerCustom([variant])
    expect(mediaExerciseOf(variant)).toBe(EXIDX['0576'])
    const ownMedia = { ...variant, media: { kind: 'image', hash: 'a'.repeat(64), mime: 'image/webp', size: 10, width: 10, height: 10, at: 1 } }
    expect(mediaExerciseOf(ownMedia)).toBe(ownMedia)
  })
})
