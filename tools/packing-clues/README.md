# Packing clue analysis

An independent native Rust executable using Rayon `par_iter()` over target
packings. It does not change the game, its dependencies, or the packing data.
Requires Rust 1.85 or newer (edition 2024; use a current stable toolchain).

## Run

From **stack-it-up-3d**:

```powershell
# All targets, all competitors; J/L and S/Z are free 3D shapes.
cargo run --release --manifest-path tools/packing-clues/Cargo.toml

# Distinguish J/L and S/Z where the particular placement is facebound.
cargo run --release --manifest-path tools/packing-clues/Cargo.toml -- --shapes facebound

# One target, still compared against the ENTIRE catalog.
cargo run --release --manifest-path tools/packing-clues/Cargo.toml -- --id 1 --output clue-example.jsonl

# A manageable first batch, using four Rayon threads.
cargo run --release --manifest-path tools/packing-clues/Cargo.toml -- --limit 100 --threads 4 --output clue-batch.jsonl

# Continue that file; with no limit this eventually covers every target.
cargo run --release --manifest-path tools/packing-clues/Cargo.toml -- --output clue-batch.jsonl --resume

cargo test --manifest-path tools/packing-clues/Cargo.toml
```

Alternatively `cd tools/packing-clues` and use `cargo run --release` directly.
Default outputs live in `stack-it-up-3d`: `packing-clues-free.jsonl` and
`packing-clues-free.summary.json` (or `facebound`). An existing result file is
never overwritten; use `--resume` or a different `--output`.

The current `data/source.json` selects an extracted `.packing-cache` directory
by its archive checksum prefix. The loader checks the expected packing count,
mask validity, overlap, extras, source-ID uniqueness, and rotation closure of
the shape catalog. If no current extraction exists, run
`node tools/build-packing-data.mjs` first (requires 7-Zip). You can instead use
`--source PATH` pointing to a directory containing `piece_catalog.csv` and
`refined_families.txt`; in that case that entire input defines the universe.
There are no network requests by the analyzer. Cargo may download dependencies.

## Meaning of a clue

The profile is **[additional shape occurrences, complete placed pieces, extra
cells]**. Every clue has unit cost for the optional minimum-total statistic.

* Shape clues specify minimum occurrence counts, preserving duplicates. Two O
  clues require at least two O pieces. They reveal no locations or absences.
* A placement reveals the exact four-cell mask of one piece. Its shape is
  already known and costs nothing extra. Additional shape clues refer to other
  pieces: a placed O plus one additional O requires at least two O pieces.
* An extra clue reveals one cell not occupied by any tetracube. Extras have no
  individual identities. Cell indices use `x*9 + y*3 + z`, coordinates 0..2.

The free catalog includes **Branch, LeftScrew, RightScrew, JL, SZ, O, T**.
The two screws remain distinct under proper rotations. The straight four-cell
tetracube cannot fit inside this grid and has no placements in the catalog.
Shapes come from the catalog's physical `type`, not presentation color or
lowercase core/non-facebound labels.

In `--shapes facebound` mode, exterior-face JL placements become J or L, and
exterior-face SZ placements become S or Z, using the catalog's `identity`.
Non-facebound JL and SZ keep their combined labels. Thus a shape-only J clue in
this mode also tells you it is facebound. O/T/Branch/screws retain their physical
type regardless of face/core status. Each piece has exactly one category in
either mode; this is not a mixed system of coarse JL clues and refined J clues.

All spatial clues must match under **one common whole-cube rotation**. The
24 proper rotations are allowed. Mirror twins remain different solutions;
reflections are not allowed. Uniqueness means one geometric packing, ignoring
piece order, color, and equivalent rotated duplicate rows. Such duplicate IDs
are included in `equivalent_source_ids` for auditing. Histogram totals count
source rows, not deduplicated equivalence classes.

## Results

The first JSONL line records the input universe, mode, and input fingerprints.
Every subsequent line is a completed target and includes:

* `source_id`: the original `line=` identifier, not its family position.
* `shape_inventory`: complete multiset of shapes.
* `pareto`: all nondominated **count profiles**, with one concrete identifying
  witness per profile. This does not enumerate every witness of equal cost.
* `minimum_total`: smallest sum of the three clue counts.
* `minima`: minimum total for shapes only, placements only, extras only, each
  pair of clue types, and all three. `null` means impossible with that allowance.

The summary contains histograms for these minima and counts for each Pareto
profile. For example, the `shapes` histogram tells how many analyzed targets
can be identified with each number of shape clues; `impossible` counts the rest.
Divide by `analyzed_source_rows` for proportions. Profiles can overlap: one
packing may contribute to several Pareto profile counts. The pair categories
mean **allowed types**, not a requirement to use both types. Sort the per-target
`minimum_total` values to find the hardest packings, and inspect their witnesses.

Only a complete run gives whole-catalog statistics. Target selection never
shrinks the competing universe. Dataset uniqueness implies uniqueness among all
valid cubes only if the input enumeration exhaustively covers those rules.

## Exact algorithm and running long jobs

The analyzer indexes stored-orientation piece masks, pairs of complete pieces,
all nonempty subsets of each packing's extras, and complete shape inventories.
A query rotates the entire spatial clue set together, scans the shortest
applicable posting list, and stops as soon as a nonequivalent rival is found.
Pair indexes avoid scanning every packing containing just one of several known
pieces; extra-subset indexes apply all revealed extras at once. Shape-only
queries use inventory buckets. It never materializes 24 copies of every packing
and never searches move sequences.

Each of six pieces has three states: hidden, shape-only, or fully placed. Each
of three extras is hidden or revealed. This gives at most `3^6 * 2^3 = 5,832`
candidate clue sets per target, with duplicate shape multisets deduplicated.
The 64 piece subsets and eight extra subsets are prepared once per target;
queries store compact subset indices instead of allocating copies of their
masks and shape counts. Rotation queries use a fixed stack array.
Candidates are examined by increasing total cost. Once a profile identifies the
target, every componentwise-larger profile can be skipped. This is an exhaustive
search for the Pareto frontier; it is not a greedy approximation.

The full 1,871,891-target job can be expensive. No full-catalog runtime claim is
made. Work is parallel across targets, with one shared read-only index; the
loader temporarily holds the raw text, and memory scales with catalog size and
Rayon thread count. Use `--threads` to control concurrency. No full analysis is
run as part of compilation or tests.

The pair/extra-subset indexes add startup work and memory: they hold 22 32-bit
row references per packing (about 157 MiB for the current catalog before vector
capacity and hash-table overhead), in addition to the piece and inventory
indexes. They are shared across Rayon workers, not duplicated per thread.

A 100-target comparison spread across the full current catalog, using four
Rayon threads and release builds, reduced the search phase from 8.2 seconds to
3.4 seconds (about 2.4x). Minima, Pareto profiles, inventories, and equivalent IDs
matched for all 100 targets. These timings exclude loading/index construction;
they are a sample, not a guarantee of full-run speedup. Existing result files
remain compatible with `--resume` because the clue semantics and format did not
change. Reproduce the sampled target selection with `--shard 0/18718 --limit 100`.

* `--id 1,3,5`: explicit source IDs.
* `--start 1000`: skip 1,000 rows in ascending source-ID order, zero-based.
* `--limit 100`: take 100 selected targets, before skipping resumed results.
* `--shard 0/4`: analyze sorted row indices congruent to 0 modulo 4; other jobs
  use 1/4, 2/4, 3/4 with separate output filenames. Every shard compares against
  all competitors. Selection order is start, IDs, shard, limit, resume.
* `--resume`: skip completed IDs in the same output. Changing target selection
  is allowed; changing input contents or shape mode is rejected.

Results are flushed after every target. Completion order can differ with Rayon
scheduling. Ctrl+C loses at most work in progress, though interruption during a
write can leave a partial final line: remove that incomplete line before
resuming (the tool reports this rather than silently discarding it). The summary
is written when a run finishes and includes all completed records in that file,
including earlier resumed batches. A fresh summary can be produced with
`--resume --limit 0`. Never have two processes write the same output file.

Tests use a small fixture from the current source, check both classification
modes, compare indexed queries and Pareto results with a brute-force oracle,
and check rotated duplicate handling. Fixtures are intentionally not the full
comparison universe and should not be used to infer real-catalog minima.
