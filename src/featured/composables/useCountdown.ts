import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { getNow } from '@/shared/time/now'

const TICK_MS = 1_000

export interface UseCountdown {
  readonly remaining: Readonly<Ref<number>>
  readonly isExpired: ComputedRef<boolean>
}

export function useCountdown(targetMs: MaybeRefOrGetter<number>): UseCountdown {
  const remaining = ref(Math.max(0, toValue(targetMs) - getNow()))
  let tickHandle: ReturnType<typeof setTimeout> | null = null

  const tick = (): void => {
    // Recompute against getNow() every tick (NOT a decremented counter): a
    // backgrounded/throttled tab re-aligns to wall-clock on the next tick,
    // so this single line IS the drift-correction mechanism.
    remaining.value = Math.max(0, toValue(targetMs) - getNow())
    if (remaining.value > 0) {
      tickHandle = setTimeout(tick, TICK_MS)
    } else {
      tickHandle = null
    }
  }

  const stop = (): void => {
    if (tickHandle !== null) {
      clearTimeout(tickHandle)
      tickHandle = null
    }
  }

  const start = (): void => {
    stop()
    tick()
  }

  onMounted(start)
  onBeforeUnmount(stop)

  watch(
    () => toValue(targetMs),
    () => {
      start()
    },
  )

  const isExpired = computed(() => remaining.value === 0)

  return { remaining, isExpired }
}
