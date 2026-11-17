//! Exact identifying-clue search over the existing packing catalog.
//! See ../README.md for semantics, resource costs, and runnable commands.
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    error::Error,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, BufWriter, Write},
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    time::Instant,
};

type Result<T> = std::result::Result<T, Box<dyn Error + Send + Sync>>;
const FULL: u32 = (1 << 27) - 1;

#[derive(Clone, Debug)]
struct Packing {
    id: u32,
    pieces: [u32; 6],
    extras: u32,
    counts: Vec<u8>,
}
#[derive(Clone)]
struct Piece {
    shape: usize,
}
struct Database {
    rows: Vec<Packing>,
    catalog: HashMap<u32, Piece>,
    names: Vec<String>,
    // Posting lists contain row indices in ascending order, in stored orientation.
    pieces: HashMap<u32, Vec<usize>>,
    // A pair is much more selective than either piece alone. u32 postings
    // keep the 15 entries per packing affordable for the full catalog.
    pairs: HashMap<[u32; 2], Vec<u32>>,
    extra_sets: HashMap<u32, Vec<u32>>,
    bags: HashMap<Vec<u8>, Vec<usize>>,
    rotations: Vec<[usize; 27]>,
}
#[derive(Default)]
struct Options {
    source: Option<PathBuf>,
    output: Option<PathBuf>,
    mode: String,
    ids: BTreeSet<u32>,
    start: usize,
    limit: Option<usize>,
    threads: Option<usize>,
    resume: bool,
    shard: Option<(usize, usize)>,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct Run {
    kind: String,
    version: u32,
    source: String,
    source_bytes: u64,
    source_fingerprint: String,
    catalog_fingerprint: String,
    universe_count: usize,
    shape_mode: String,
    shape_names: Vec<String>,
    equivalence: String,
    clue_cost: String,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Witness {
    profile: [u8; 3], // additional unlocated shapes, complete pieces, extra cells
    additional_shapes: BTreeMap<String, u8>,
    placed_masks: Vec<String>,
    extra_cells: Vec<usize>,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Analysis {
    kind: String,
    source_id: u32,
    equivalent_source_ids: Vec<u32>,
    shape_inventory: BTreeMap<String, u8>,
    minimum_total: u8,
    pareto: Vec<Witness>,
    // Best total using only each permitted combination, even when its witness
    // also works with a smaller permitted set. Null means impossible.
    minima: BTreeMap<String, Option<u8>>,
}

fn rotations() -> Vec<[usize; 27]> {
    let mut out = Vec::new();
    for p in [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
    ] {
        let inversions = (0..3)
            .flat_map(|i| (i + 1..3).map(move |j| (i, j)))
            .filter(|&(i, j)| p[i] > p[j])
            .count();
        for signs in 0..8 {
            if (inversions + (signs as u32).count_ones() as usize) % 2 != 0 {
                continue;
            }
            let mut map = [0; 27];
            for (i, dest) in map.iter_mut().enumerate() {
                let xyz = [i / 9, i / 3 % 3, i % 3];
                let q: Vec<_> = (0..3)
                    .map(|a| {
                        if signs & (1 << a) != 0 {
                            2 - xyz[p[a]]
                        } else {
                            xyz[p[a]]
                        }
                    })
                    .collect();
                *dest = q[0] * 9 + q[1] * 3 + q[2];
            }
            out.push(map);
        }
    }
    out
}
fn rotate(mut mask: u32, r: &[usize; 27]) -> u32 {
    let mut out = 0;
    while mask != 0 {
        let b = mask.trailing_zeros() as usize;
        mask &= mask - 1;
        out |= 1 << r[b];
    }
    out
}
fn cells(mask: u32) -> Vec<usize> {
    (0..27).filter(|&i| mask & (1 << i) != 0).collect()
}
fn contains(counts: &[u8], need: &[u8]) -> bool {
    counts.iter().zip(need).all(|(a, b)| a >= b)
}
fn dominates(a: [u8; 3], b: [u8; 3]) -> bool {
    (0..3).all(|i| a[i] <= b[i])
}
fn total(p: [u8; 3]) -> u8 {
    p.iter().sum()
}
fn named(names: &[String], counts: &[u8]) -> BTreeMap<String, u8> {
    names
        .iter()
        .cloned()
        .zip(counts.iter().copied())
        .filter(|(_, n)| *n > 0)
        .collect()
}

impl Database {
    fn new(rows: Vec<Packing>, catalog: HashMap<u32, Piece>, names: Vec<String>) -> Self {
        let mut db = Self {
            rows,
            catalog,
            names,
            pieces: HashMap::new(),
            pairs: HashMap::new(),
            extra_sets: HashMap::new(),
            bags: HashMap::new(),
            rotations: rotations(),
        };
        for (i, p) in db.rows.iter().enumerate() {
            for m in p.pieces {
                db.pieces.entry(m).or_default().push(i);
            }
            for a in 0..6 {
                for b in a + 1..6 {
                    let mut pair = [p.pieces[a], p.pieces[b]];
                    pair.sort_unstable();
                    db.pairs
                        .entry(pair)
                        .or_default()
                        .push(u32::try_from(i).expect("More than u32::MAX packing rows"));
                }
            }
            let mut sub = p.extras;
            while sub != 0 {
                db.extra_sets.entry(sub).or_default().push(i as u32);
                sub = (sub - 1) & p.extras;
            }
            db.bags.entry(p.counts.clone()).or_default().push(i);
        }
        db
    }
    // Every spatial clue is transformed by ONE common rotation. Intersecting
    // independently rotation-expanded clues would produce false matches.
    fn visit_matches(
        &self,
        pieces: &[u32],
        extras: u32,
        need: &[u8],
        mut visit: impl FnMut(usize) -> bool,
    ) -> bool {
        if pieces.is_empty() && extras == 0 {
            for (bag, ids) in &self.bags {
                if contains(bag, need) {
                    for &i in ids {
                        if visit(i) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        for r in &self.rotations {
            let mut storage = [0u32; 6];
            for (dest, &m) in storage.iter_mut().zip(pieces) {
                *dest = rotate(m, r);
            }
            let pm = &storage[..pieces.len()];
            let em = rotate(extras, r);
            let mut narrowest: Option<&Vec<u32>> = None;
            let mut impossible = false;
            for a in 0..pm.len() {
                for b in a + 1..pm.len() {
                    let mut pair = [pm[a], pm[b]];
                    pair.sort_unstable();
                    let Some(list) = self.pairs.get(&pair) else {
                        impossible = true;
                        break;
                    };
                    if narrowest.is_none_or(|s| list.len() < s.len()) {
                        narrowest = Some(list);
                    }
                }
                if impossible {
                    break;
                }
            }
            if impossible {
                continue;
            }
            if em != 0 {
                let Some(list) = self.extra_sets.get(&em) else {
                    continue;
                };
                if narrowest.is_none_or(|s| list.len() < s.len()) {
                    narrowest = Some(list);
                }
            }
            let mut shortest: Option<&Vec<usize>> = None;
            for m in pm {
                let Some(list) = self.pieces.get(m) else {
                    impossible = true;
                    break;
                };
                if shortest.is_none_or(|s| list.len() < s.len()) {
                    shortest = Some(list);
                }
            }
            if impossible {
                continue;
            }
            let matches = |i: usize| {
                let p = &self.rows[i];
                p.extras & em == em
                    && contains(&p.counts, need)
                    && pm.iter().all(|m| p.pieces.contains(m))
            };
            if let Some(list) = narrowest.filter(|n| shortest.is_none_or(|s| n.len() <= s.len())) {
                for &i in list {
                    if matches(i as usize) && visit(i as usize) {
                        return true;
                    }
                }
            } else {
                for &i in shortest.unwrap() {
                    if matches(i) && visit(i) {
                        return true;
                    }
                }
            }
        }
        false
    }
    fn analyze(&self, index: usize) -> Analysis {
        let target = &self.rows[index];
        // Duplicate source rows/rotated copies represent the same answer.
        let mut equivalent = HashSet::new();
        self.visit_matches(&target.pieces, target.extras, &target.counts, |i| {
            equivalent.insert(i);
            false
        });
        let mut equivalent_source_ids: Vec<_> =
            equivalent.iter().map(|&i| self.rows[i].id).collect();
        equivalent_source_ids.sort_unstable();
        let mut frontier: Vec<Witness> = Vec::new();
        let extra_cells = cells(target.extras);
        // Each piece is either hidden, shape-only, or fully placed. Enumerating
        // 3^6 * 2^3 covers all nonredundant clue sets, including duplicate shapes.
        // Deduplicate identical shape multisets for each placement subset.
        // Precompute only 64 subsets, then store compact subset indices in
        // queries instead of allocating/copying three vectors per query.
        let subset_counts: [Vec<u8>; 64] = std::array::from_fn(|subset| {
            let mut counts = vec![0; self.names.len()];
            for j in 0..6 {
                if subset & (1 << j) != 0 {
                    counts[self.catalog[&target.pieces[j]].shape] += 1;
                }
            }
            counts
        });
        let subset_pieces: [Vec<u32>; 64] = std::array::from_fn(|subset| {
            (0..6)
                .filter(|j| subset & (1 << j) != 0)
                .map(|j| target.pieces[j])
                .collect()
        });
        let subset_extras: [u32; 8] = std::array::from_fn(|subset| {
            extra_cells
                .iter()
                .enumerate()
                .filter(|(j, _)| subset & (1 << j) != 0)
                .fold(0, |mask, (_, c)| mask | (1 << c))
        });
        let mut queries = Vec::with_capacity(5832);
        for placed in 0u8..64 {
            let mut shapes = BTreeMap::new();
            for selected in 0u8..64 {
                if selected & placed == 0 {
                    shapes
                        .entry(&subset_counts[selected as usize])
                        .or_insert(selected);
                }
            }
            for (_, selected) in shapes {
                for extras in 0u8..8 {
                    let profile = [
                        selected.count_ones() as u8,
                        placed.count_ones() as u8,
                        extras.count_ones() as u8,
                    ];
                    queries.push((profile, placed, extras, selected));
                }
            }
        }
        queries.sort_unstable_by_key(|q| (total(q.0), q.0));
        for (profile, placed, extras, selected) in queries {
            if frontier.iter().any(|w| dominates(w.profile, profile)) {
                continue;
            }
            let pm = &subset_pieces[placed as usize];
            let em = subset_extras[extras as usize];
            let additional = &subset_counts[selected as usize];
            let need = &subset_counts[(placed | selected) as usize];
            let rival = self.visit_matches(pm, em, need, |i| !equivalent.contains(&i));
            if !rival {
                frontier.retain(|w| !dominates(profile, w.profile));
                frontier.push(Witness {
                    profile,
                    additional_shapes: named(&self.names, &additional),
                    placed_masks: pm.iter().map(|m| format!("{m:07x}")).collect(),
                    extra_cells: cells(em),
                });
            }
        }
        frontier.sort_by_key(|w| w.profile);
        let mut minima = BTreeMap::new();
        for (name, allowed) in [
            ("shapes", 1),
            ("placements", 2),
            ("extras", 4),
            ("shapes+placements", 3),
            ("shapes+extras", 5),
            ("placements+extras", 6),
            ("all", 7),
        ] {
            minima.insert(
                name.into(),
                frontier
                    .iter()
                    .filter(|w| (0..3).all(|i| allowed & (1 << i) != 0 || w.profile[i] == 0))
                    .map(|w| total(w.profile))
                    .min(),
            );
        }
        Analysis {
            kind: "packing".into(),
            source_id: target.id,
            equivalent_source_ids,
            shape_inventory: named(&self.names, &target.counts),
            minimum_total: frontier.iter().map(|w| total(w.profile)).min().unwrap(),
            pareto: frontier,
            minima,
        }
    }
}

fn fingerprint(bytes: &[u8]) -> String {
    // Portable FNV-1a for accidental input-change detection, not cryptographic authentication.
    let h = bytes.iter().fold(0xcbf29ce484222325u64, |h, b| {
        (h ^ u64::from(*b)).wrapping_mul(0x100000001b3)
    });
    format!("fnv1a64:{h:016x}")
}
fn find_source(root: &std::path::Path) -> Result<PathBuf> {
    let source: serde_json::Value =
        serde_json::from_slice(&fs::read(root.join("data/source.json"))?)?;
    let prefix = &source["sha256"].as_str().ok_or("Missing source SHA256")?[..12];
    let mut paths = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join(".packing-cache")) {
        for e in entries {
            let e = e?;
            if e.file_name().to_string_lossy().starts_with(prefix) {
                let p = e.path().join("source");
                if p.join("refined_families.txt").is_file() && p.join("piece_catalog.csv").is_file()
                {
                    paths.push(p);
                }
            }
        }
    }
    paths.sort();
    paths.pop().ok_or("No extracted current data found. From stack-it-up-3d run: node tools/build-packing-data.mjs (requires 7-Zip), or pass --source <extracted-source-directory>.".into())
}
fn load(source: &std::path::Path, mode: &str) -> Result<(Database, String, String, u64)> {
    let cat = fs::read(source.join("piece_catalog.csv"))?;
    let txt = std::str::from_utf8(&cat)?;
    let mut lines = txt.lines();
    let header: Vec<_> = lines.next().ok_or("Empty catalog")?.split(',').collect();
    let column = |s| {
        header
            .iter()
            .position(|&h| h == s)
            .ok_or_else(|| format!("Missing catalog column {s}"))
    };
    let (mi, ti, ii, fi) = (
        column("mask")?,
        column("type")?,
        column("identity")?,
        column("facebound")?,
    );
    let mut labels = BTreeMap::new();
    for line in lines.filter(|l| !l.trim().is_empty()) {
        let f: Vec<_> = line.split(',').collect();
        if f.len() != header.len() {
            return Err("Invalid catalog row".into());
        }
        let m = u32::from_str_radix(f[mi], 16)?;
        if m & !FULL != 0 || m.count_ones() != 4 {
            return Err("Invalid catalog mask".into());
        }
        let label = if mode == "facebound" && f[fi] == "1" && matches!(f[ti], "JL" | "SZ") {
            f[ii]
        } else {
            f[ti]
        };
        if labels.insert(m, label.to_owned()).is_some() {
            return Err("Duplicate catalog mask".into());
        }
    }
    let names: Vec<_> = labels
        .values()
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let catalog: HashMap<_, _> = labels
        .into_iter()
        .map(|(m, n)| {
            (
                m,
                Piece {
                    shape: names.binary_search(&n).unwrap(),
                },
            )
        })
        .collect();
    // Verify rotation closure, including facebound handedness classifications.
    for (&m, p) in &catalog {
        for r in rotations() {
            if catalog
                .get(&rotate(m, &r))
                .is_none_or(|q| q.shape != p.shape)
            {
                return Err(format!(
                    "Catalog shape classification is not rotation invariant at {m:07x}"
                )
                .into());
            }
        }
    }
    let raw = fs::read(source.join("refined_families.txt"))?;
    let mut rows = Vec::new();
    let mut ids = HashSet::new();
    for line in std::str::from_utf8(&raw)?.lines() {
        let line = line.trim();
        if !line.starts_with("line=") {
            continue;
        }
        let f: Vec<_> = line.split_whitespace().collect();
        if f.len() != 14 {
            return Err(format!("Unexpected packing row: {}", f[0]).into());
        }
        let id = f[0][5..].parse()?;
        if !ids.insert(id) {
            return Err(format!("Duplicate source ID {id}").into());
        }
        let mut pieces = [0; 6];
        let mut occupied = 0;
        let mut counts = vec![0; names.len()];
        for j in 0..6 {
            let m = u32::from_str_radix(f[3 + j], 16)?;
            let p = catalog
                .get(&m)
                .ok_or_else(|| format!("Unknown piece at {id}"))?;
            if occupied & m != 0 {
                return Err(format!("Overlapping pieces at {id}").into());
            }
            occupied |= m;
            pieces[j] = m;
            counts[p.shape] += 1;
        }
        let extras =
            u32::from_str_radix(f[9].strip_prefix("extras=").ok_or("Missing extras")?, 16)?;
        if extras != FULL ^ occupied || extras.count_ones() != 3 {
            return Err(format!("Invalid extras at {id}").into());
        }
        rows.push(Packing {
            id,
            pieces,
            extras,
            counts,
        });
    }
    if rows.is_empty() {
        return Err("No packings found".into());
    }
    rows.sort_unstable_by_key(|p| p.id);
    let hash = fingerprint(&raw);
    let bytes = raw.len() as u64;
    drop(raw);
    Ok((
        Database::new(rows, catalog, names),
        hash,
        fingerprint(&cat),
        bytes,
    ))
}

fn options() -> Result<Options> {
    let mut o = Options {
        mode: "free".into(),
        ..Options::default()
    };
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--help" || a == "-h" {
            println!(
                "packing-clues [--shapes free|facebound] [--id N[,N...]] [--start N] [--limit N]\n  [--shard I/N] [--threads N] [--source DIRECTORY] [--output FILE.jsonl] [--resume]\n\nDefaults: full current catalog; all target rows; proper rotations, mirrors distinct.\n--start is a zero-based sorted-row offset; --limit restricts TARGETS, never competitors.\n--shard I/N uses zero-based shard I. See tools/packing-clues/README.md."
            );
            std::process::exit(0);
        }
        if a == "--resume" {
            o.resume = true;
            continue;
        }
        let v = args
            .next()
            .ok_or_else(|| format!("Missing value for {a}"))?;
        match a.as_str() {
            "--source" => o.source = Some(v.into()),
            "--output" => o.output = Some(v.into()),
            "--shapes" => o.mode = v,
            "--start" => o.start = v.parse()?,
            "--limit" => o.limit = Some(v.parse()?),
            "--threads" => o.threads = Some(v.parse()?),
            "--id" => {
                for id in v.split(',') {
                    o.ids.insert(id.parse()?);
                }
            }
            "--shard" => {
                let (i, n) = v.split_once('/').ok_or("Expected --shard I/N")?;
                o.shard = Some((i.parse()?, n.parse()?));
            }
            _ => return Err(format!("Unknown option {a}").into()),
        }
    }
    if !matches!(o.mode.as_str(), "free" | "facebound") {
        return Err("--shapes must be free or facebound".into());
    }
    if o.threads == Some(0) {
        return Err("--threads must be positive".into());
    }
    if o.shard.is_some_and(|(i, n)| n == 0 || i >= n) {
        return Err("--shard requires 0 <= I < N".into());
    }
    Ok(o)
}

#[derive(Default, Serialize)]
struct Summary {
    analyzed_source_rows: usize,
    minimum_total_histogram: BTreeMap<u8, usize>,
    minima_histograms: BTreeMap<String, BTreeMap<String, usize>>,
    pareto_profile_counts: BTreeMap<String, usize>,
}
impl Summary {
    fn add(&mut self, a: &Analysis) {
        self.analyzed_source_rows += 1;
        *self
            .minimum_total_histogram
            .entry(a.minimum_total)
            .or_default() += 1;
        for (k, v) in &a.minima {
            *self
                .minima_histograms
                .entry(k.clone())
                .or_default()
                .entry(v.map_or("impossible".into(), |n| n.to_string()))
                .or_default() += 1;
        }
        for w in &a.pareto {
            *self
                .pareto_profile_counts
                .entry(format!(
                    "{},{},{}",
                    w.profile[0], w.profile[1], w.profile[2]
                ))
                .or_default() += 1;
        }
    }
}
fn main() -> Result<()> {
    let o = options()?;
    if let Some(n) = o.threads {
        rayon::ThreadPoolBuilder::new()
            .num_threads(n)
            .build_global()?;
    }
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let auto = o.source.is_none();
    let source = o
        .source
        .clone()
        .map_or_else(|| find_source(&root), Ok)?
        .canonicalize()?;
    eprintln!("Loading {} ...", source.display());
    let (db, hash, cat_hash, bytes) = load(&source, &o.mode)?;
    if auto {
        let meta: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("data/source.json"))?)?;
        if meta["packingCount"].as_u64() != Some(db.rows.len() as u64) {
            return Err("Current source packing count mismatch".into());
        }
    }
    let run = Run {kind:"run".into(),version:1,source:source.display().to_string(),source_bytes:bytes,
        source_fingerprint:hash,catalog_fingerprint:cat_hash,universe_count:db.rows.len(),shape_mode:o.mode.clone(),shape_names:db.names.clone(),
        equivalence:"proper whole-cube rotations; reflections distinct; duplicate equivalent rows excluded as rivals".into(),
        clue_cost:"one per additional shape occurrence, complete placed piece, or extra cell".into()};
    let output = o
        .output
        .unwrap_or_else(|| root.join(format!("packing-clues-{}.jsonl", o.mode)));
    let mut summary = Summary::default();
    let mut done = HashSet::new();
    if o.resume && output.exists() {
        let mut lines = BufReader::new(File::open(&output)?).lines();
        let old: Run = serde_json::from_str(&lines.next().ok_or("Empty resume file")??)?;
        if old != run {
            return Err("Resume metadata does not match inputs/mode; use a new output file".into());
        }
        for line in lines {
            let a: Analysis = serde_json::from_str(&line?).map_err(|e| {
                format!(
                    "Invalid resume record ({e}); remove any incomplete last line before resuming"
                )
            })?;
            if !done.insert(a.source_id) {
                return Err("Duplicate result ID in resume file".into());
            }
            summary.add(&a);
        }
        // An interrupted write may have completed the JSON without its newline.
        let bytes = fs::read(&output)?;
        if !bytes.ends_with(b"\n") {
            OpenOptions::new()
                .append(true)
                .open(&output)?
                .write_all(b"\n")?;
        }
    }
    for id in &o.ids {
        if db.rows.binary_search_by_key(id, |p| p.id).is_err() {
            return Err(format!("Unknown source ID {id}").into());
        }
    }
    let targets: Vec<_> = (0..db.rows.len())
        .skip(o.start)
        .filter(|&i| o.ids.is_empty() || o.ids.contains(&db.rows[i].id))
        .filter(|&i| o.shard.is_none_or(|(k, n)| i % n == k))
        .take(o.limit.unwrap_or(usize::MAX))
        .filter(|&i| !done.contains(&db.rows[i].id))
        .collect();
    let mut file = if o.resume && output.exists() {
        OpenOptions::new().append(true).open(&output)?
    } else {
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)?
    };
    if file.metadata()?.len() == 0 {
        serde_json::to_writer(&mut file, &run)?;
        writeln!(file)?;
        file.flush()?;
    }
    let sink = Mutex::new((BufWriter::new(file), summary));
    let completed = AtomicUsize::new(0);
    let started = Instant::now();
    eprintln!(
        "{} competitors; shapes {:?}; {} targets; {} Rayon threads",
        db.rows.len(),
        db.names,
        targets.len(),
        rayon::current_num_threads()
    );
    targets.par_iter().try_for_each(|&i| -> Result<()> {
        let result = db.analyze(i);
        let mut guard = sink.lock().map_err(|_| "Output lock poisoned")?;
        serde_json::to_writer(&mut guard.0, &result)?;
        writeln!(guard.0)?;
        guard.0.flush()?;
        guard.1.add(&result);
        let n = completed.fetch_add(1, Ordering::Relaxed) + 1;
        if n == 1 || n % 100 == 0 || n == targets.len() {
            eprintln!(
                "{n}/{} new targets ({:.1}s)",
                targets.len(),
                started.elapsed().as_secs_f64()
            );
        }
        Ok(())
    })?;
    let (_, summary) = sink.into_inner().map_err(|_| "Output lock poisoned")?;
    let summary_path = output.with_extension("summary.json");
    let report = serde_json::json!({"run":run,"results_file":output,"summary":summary,
        "scope":"Histograms count analyzed source rows only, each tested against the full input universe. Equivalent duplicate source rows, if present, count separately in histograms."});
    fs::write(&summary_path, serde_json::to_string_pretty(&report)?)?;
    println!(
        "Results: {}\nSummary: {}",
        output.display(),
        summary_path.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(mode: &str) -> Database {
        load(
            &PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures"),
            mode,
        )
        .unwrap()
        .0
    }
    #[test]
    fn cube_rotations_are_exactly_24_proper_permutations() {
        let rs = rotations();
        assert_eq!(rs.len(), 24);
        assert_eq!(rs.iter().collect::<HashSet<_>>().len(), 24);
        for r in rs {
            assert_eq!(
                r.iter().copied().collect::<BTreeSet<_>>(),
                (0..27).collect()
            );
            assert_eq!(r[13], 13);
            assert_eq!(rotate(FULL, &r), FULL);
            for i in 0..27 {
                for j in 0..27 {
                    let distance = |a: usize, b: usize| {
                        (a / 9).abs_diff(b / 9)
                            + (a / 3 % 3).abs_diff(b / 3 % 3)
                            + (a % 3).abs_diff(b % 3)
                    };
                    assert_eq!(distance(i, j), distance(r[i], r[j]));
                }
            }
        }
    }
    #[test]
    fn catalog_includes_branch_and_both_screws_and_optional_face_labels() {
        let free = fixture("free");
        assert_eq!(
            free.names,
            vec!["Branch", "JL", "LeftScrew", "O", "RightScrew", "SZ", "T"]
        );
        let face = fixture("facebound");
        for s in [
            "Branch",
            "J",
            "L",
            "JL",
            "S",
            "Z",
            "SZ",
            "LeftScrew",
            "RightScrew",
        ] {
            assert!(face.names.iter().any(|n| n == s));
        }
        assert!(contains(&[2, 0], &[2, 0]));
        assert!(!contains(&[1, 1], &[2, 0]));
    }
    #[test]
    fn indexed_search_and_frontier_match_exhaustive_oracle() {
        check_oracle("free");
        check_oracle("facebound");
    }
    fn check_oracle(mode: &str) {
        let db = fixture(mode);
        let t = &db.rows[0];
        // Independent oracle rotates candidate records, rather than the clues.
        let oriented: Vec<Vec<([u32; 6], u32)>> = db
            .rows
            .iter()
            .map(|p| {
                db.rotations
                    .iter()
                    .map(|r| (p.pieces.map(|m| rotate(m, r)), rotate(p.extras, r)))
                    .collect()
            })
            .collect();
        let mut profiles = BTreeSet::new();
        for state in 0..729 {
            let mut code = state;
            let mut pm = Vec::new();
            let mut need = vec![0u8; db.names.len()];
            let mut shapes = 0;
            for m in t.pieces {
                let choice = code % 3;
                code /= 3;
                if choice != 0 {
                    need[db.catalog[&m].shape] += 1;
                }
                if choice == 1 {
                    shapes += 1;
                }
                if choice == 2 {
                    pm.push(m);
                }
            }
            let ec = cells(t.extras);
            for subset in 0u8..8 {
                let em = ec
                    .iter()
                    .enumerate()
                    .filter(|(j, _)| subset & (1 << j) != 0)
                    .fold(0, |m, (_, c)| m | (1 << c));
                let expected: BTreeSet<_> = db
                    .rows
                    .iter()
                    .enumerate()
                    .filter(|(i, p)| {
                        contains(&p.counts, &need)
                            && oriented[*i].iter().any(|(pieces, extras)| {
                                extras & em == em && pm.iter().all(|m| pieces.contains(m))
                            })
                    })
                    .map(|(i, _)| i)
                    .collect();
                let mut actual = BTreeSet::new();
                db.visit_matches(&pm, em, &need, |i| {
                    actual.insert(i);
                    false
                });
                assert_eq!(actual, expected, "state={state} extras={subset}");
                if expected == BTreeSet::from([0]) {
                    profiles.insert([shapes, pm.len() as u8, subset.count_ones() as u8]);
                }
            }
        }
        let expected: BTreeSet<_> = profiles
            .iter()
            .copied()
            .filter(|p| !profiles.iter().any(|q| q != p && dominates(*q, *p)))
            .collect();
        let result = db.analyze(0);
        assert_eq!(
            result
                .pareto
                .iter()
                .map(|w| w.profile)
                .collect::<BTreeSet<_>>(),
            expected
        );
        for w in result.pareto {
            let masks: Vec<_> = w
                .placed_masks
                .iter()
                .map(|s| u32::from_str_radix(s, 16).unwrap())
                .collect();
            let mut need: Vec<u8> = db
                .names
                .iter()
                .map(|n| *w.additional_shapes.get(n).unwrap_or(&0))
                .collect();
            for m in &masks {
                need[db.catalog[m].shape] += 1;
            }
            let em = w.extra_cells.iter().fold(0, |m, c| m | (1 << c));
            assert!(!db.visit_matches(&masks, em, &need, |i| i != 0));
        }
    }
    #[test]
    fn equivalent_rotated_rows_are_not_rivals() {
        let mut db = fixture("free");
        let mut copy = db.rows[0].clone();
        copy.id = 99999;
        copy.pieces = copy.pieces.map(|m| rotate(m, &db.rotations[5]));
        copy.extras = rotate(copy.extras, &db.rotations[5]);
        let original = db.analyze(0);
        db.rows.push(copy);
        let db = Database::new(db.rows, db.catalog, db.names);
        let result = db.analyze(0);
        assert_eq!(result.equivalent_source_ids, vec![1, 99999]);
        assert_eq!(original.minima, result.minima);
        assert_eq!(
            original
                .pareto
                .iter()
                .map(|w| w.profile)
                .collect::<Vec<_>>(),
            result.pareto.iter().map(|w| w.profile).collect::<Vec<_>>()
        );
    }
}
