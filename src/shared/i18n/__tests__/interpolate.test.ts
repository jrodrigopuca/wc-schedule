import { describe, expect, it } from 'vitest'
import { interpolate } from '@/shared/i18n/interpolate'

describe('interpolate', () => {
  it('returns the template unchanged when no params are passed', () => {
    expect(interpolate('hello world')).toBe('hello world')
    expect(interpolate('Hay {n} partidos')).toBe('Hay {n} partidos')
  })

  it('substitutes {n} when params provide a value', () => {
    expect(interpolate('Hay {n} partidos', { n: 3 })).toBe('Hay 3 partidos')
  })

  it('substitutes multiple distinct placeholders', () => {
    expect(interpolate('{a} - {b}', { a: 'foo', b: 'bar' })).toBe('foo - bar')
  })

  it('substitutes the same placeholder repeated', () => {
    expect(interpolate('{x}/{x}', { x: 7 })).toBe('7/7')
  })

  it('leaves the literal placeholder when the param is missing', () => {
    expect(interpolate('hace {time}', {})).toBe('hace {time}')
  })

  it('coerces numbers to strings', () => {
    expect(interpolate('{n}', { n: 0 })).toBe('0')
  })
})
