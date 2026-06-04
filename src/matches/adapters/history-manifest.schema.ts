// Manifest for the rotated history of `matches.json` snapshots produced
// by the GH Actions refresh pipeline (see design.md §4.1, §10.2).
//
// Invariants enforced by the pipeline (T11.3, NOT this runtime):
// - `entries` is sorted NEWEST-FIRST. Filenames carry an ISO date prefix,
//   so lex sort = chronological sort = newest-first when reversed.
// - The current `matches.json` served at the canonical path is byte-equal
//   to the entry referenced by `entries[0]` (data-source spec §7).
//
// `.strict()` means unknown keys fail validation — this is intentional,
// the manifest is a contract between the pipeline and the runtime.

import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const FILE_REGEX = /^matches-\d{4}-\d{2}-\d{2}\.json$/

export const historyManifestSchema = z
  .object({
    version: z.literal(1),
    entries: z
      .array(
        z
          .object({
            date: z.string().regex(DATE_REGEX),
            file: z.string().regex(FILE_REGEX),
          })
          .strict(),
      )
      .readonly(),
  })
  .strict()

export type HistoryManifest = z.infer<typeof historyManifestSchema>
