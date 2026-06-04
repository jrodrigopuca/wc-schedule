let clock: () => number = Date.now

export function getNow(): number {
  return clock()
}

export function __setClockForTests(fn: () => number): void {
  clock = fn
}

export function __resetClockForTests(): void {
  clock = Date.now
}
