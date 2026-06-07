// Pre-match notification lead time. This is the single tunable for the
// "remind me before kickoff" feature; every layer (planner, adapters,
// i18n copy) references this constant.
//
// MVP value locked at 15 minutes per specs/notifications.md §2. The unit
// is milliseconds because every consumer compares it against epoch ms
// (Date.parse(utcKickoff)). Keeping the multiplication explicit (instead
// of `900_000`) keeps the intent obvious in greps.

export const NOTIFICATION_LEAD_MS = 15 * 60 * 1000
