# Browser performance measurements

Run from `stack-it-up-refactor`:

```powershell
npm run build
npm run bench:browser
```

Open `http://127.0.0.1:4174/`, click **Run benchmark**, and keep the tab visible until completion. Use **Download JSON report** to retain the raw measurements. `PORT` overrides 4174. The server binds only to loopback and serves the existing versioned build plus the probe; it does not modify the shipping app or user preferences. Stop it with Ctrl+C.

The Jelly benchmark defaults to and is capped at **15 cycles**, as requested. Choose **1** for a quick integration check or **10** for a shorter run. **Stop after current turn** ends the run safely and exports collected results; checkpoint downloads are also available during a run. Short runs explicitly leave the 10-to-15-cycle plateau unassessed. The initial long interactive run was stopped at the user's request; it is not a completed baseline.

Summarize a downloaded report with `npm run bench:report -- path/to/browser-performance.json`. This prints overall and first/last-five-cycle latency distributions and sampled heap maxima. It exits nonzero for incomplete/invalidated runs, reported errors, missing scenarios/turns, a failed buffer plateau or buffers remaining after destruction. These checks do not certify the broader milestone.

Use the same browser/device, viewport, settings and build when comparing runs; avoid concurrent builds, tests and other heavy workloads. The report records the actual WebGL renderer, so a software renderer cannot be mistaken for hardware GPU evidence. Record CPU/OS and concurrent workload separately when publishing results. Reload before a new run. Hiding the tab invalidates the run; reduced-motion mode is rejected because it bypasses animation.

## Scenarios

- Select the smallest family containing at least two packings and the largest family from the real dataset, with ID as a deterministic tie-breaker. Retain source IDs and assert query-family identity.
- Measure cold data-worker initialization, the first family query, and four cached queries. These times include fetch/decompression/RPC; they do not isolate the decode algorithm or filter scan.
- For each family, create a fresh production `PackingCube` and geometry worker for Jelly. This is a renderer integration probe, not the complete application or path-search UI.
- Measure cold worker geometry, five unchanged-state requests, 40%/100% size changes, and a profile-change burst. Assert that only the final revision becomes ready.
- Run a fixed six-turn path and its inverse closure (`U F L L' F' U'`) for the selected cycle count, with resource checkpoints after cycles 1, 5, 10, 15 and the final cycle when reached. Check that piece identities/colors return to the start after every cycle. Reset the history between cycles while preserving session branches.
- Destroy each cube and assert that all observed GL buffers are deleted. Dispose the data worker at the end, including failures.

This fixed path intentionally controls the rendering workload. It does not exercise the family path-search algorithm, arbitrary long demonstrations, game placement/clears, or every assembly mode.

## Measurement definitions

| Field | Meaning and limits |
| --- | --- |
| `commandToDrawMs` | Command invocation through geometry readiness and draw submission at the next animation frame. Includes the intentional 180 ms turn animation. Does **not** measure GPU completion, compositor presentation, or physical input latency |
| `preparation` | Most recent accepted worker stage/upload/request timings. Unchanged-state samples reuse the last preparation diagnostics; these are not new worker jobs |
| `liveBuffers`, `bufferBytes` | Observed WebGL buffer objects and their most recent allocated sizes, including transparency coverage buffers. Excludes textures, VAOs and driver overhead |
| `peakBuffers`, `peakBufferBytes` | Exact observed maxima for tracked buffer allocations during that scenario |
| `uploads`, `uploadBytes` | Cumulative `bufferData`/`bufferSubData` calls and transferred data bytes; allocation-only `bufferData(size)` contributes no uploaded bytes |
| `uploadsPerDraw`, `uploadBytesPerDraw` | Upload deltas between draw calls, including uploads prepared between frames. Multiple draw calls can occur in one display frame |
| `heapBytes` | Sampled `performance.memory.usedJSHeapSize` when available. Excludes worker/process memory, is GC-sensitive, and includes the growing benchmark report itself |
| `worker` | Requested/started/completed jobs, replaced queued jobs, stale replies, failures and current pending count. Cancellation is coalescing/stale-result rejection, not interruption of running Wasm |
| `bufferPlateau` | Exact agreement in live buffer count and allocated bytes at cycle 10 versus cycle 15. This is only a GL-buffer plateau, not proof of a total-memory plateau |
| `longTasks` | Main-page long-task entries, when the browser supports them. Worker computation is not included |

All latency summaries use the nearest-rank percentile. Raw samples are retained; five cold/warm-setting observations are not enough to claim a dependable p95. Playback has six turn samples per cycle. Compare early and late windows in addition to the overall distribution before drawing a degradation conclusion; these windows overlap on short runs.

Historical reports below retain supported-mode samples only; remaining timings were not remeasured. Global run metadata (such as long tasks and run timestamps) describes the original capture and is not attributed exclusively to the retained scenarios.

## Recorded quick check

`browser-quick-check.json` records a completed one-cycle run for both retained Jelly scenarios on Windows 10, Chrome 157, ANGLE/D3D11 with NVIDIA GeForce RTX 2070 SUPER, 640×480 canvas at DPR 1 (build `ecfbd8fd64861d97`). There were no reported runtime errors. Every renderer returned its tracked live GL buffer count to zero on destruction. Each setting burst recorded one queued replacement and one stale reply, with no failed worker jobs.

| Family | Effect | Median command-to-draw | Allocated buffer MiB at cycle 1 |
| --- | --- | ---: | ---: |
| 1282, small | Jelly | 495 ms | 62.22 |
| 310, large | Jelly | 504 ms | 59.90 |

Only six turns per row were sampled, including the intentional 180 ms animation. This is a reproducibility/integration check, not a statistical baseline or evidence of a 15-cycle plateau. The first longer run was stopped and is not included as completed evidence.

## Recorded 15-cycle baseline

`browser-15-cycle-baseline.json` contains both retained 15-cycle Jelly scenarios (90 turns each), using the same build, Chrome 157 and RTX 2070 SUPER setup as the quick check. Both Jelly scenarios passed the cycle-10 to cycle-15 buffer plateau and released every tracked buffer on destruction. No runtime errors were reported. This replaces the former long-run requirement for this workload; no 50-cycle run is needed.

| Family/effect | Median draw latency | p95 draw latency | First five cycles p95 | Last five cycles p95 | Buffers / MiB at cycles 10 and 15 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small / Jelly | 414 ms | 567 ms | 611 ms | 560 ms | 176 / 62.22 |
| Large / Jelly | 429 ms | 585 ms | 696 ms | 583 ms | 176 / 59.90 |

Latencies include the 180 ms animation. Both median and p95 were lower in the last five cycles than in the first five for each retained scenario; this run shows no progressive slowdown in this workload. It is a baseline, not a before/after optimization comparison.


## Remaining coverage

The milestone remains in progress until full application command-to-presentation, total/worker memory, longer paths and additional assembly modes have evidence. The automated smoke command (`npm run test:browser`) remains its own gate; its software-WebGL setup is not hardware performance certification. A successful interactive probe does not erase a smoke-runner failure.

Accounting tests run with `npm run test:performance-metrics`; queue diagnostics are covered by `npm run test:geometry-worker`. Both are included in `npm run test:render`. These tests validate instrumentation and lifecycle contracts, not GPU speed.
