import {refreshRangeCards} from './filter-range-ui.js';
import { countSpecs, countLimits, presetCounts } from './filter-counts.js';
import { packingPresentation } from './presentation.js';
import { createPackingClient } from './data-client.js';
import { createEngine } from '../engine/wasm.js';
import { createExplorerViews } from './views.js';
import {
  canonicalColor,
  cellsOf,
  practicePair,
  displayIndex,
} from './model.js';
import { OFFICIAL_MASKS } from './data-store.js';

export async function initializeSpatialExplorer(
  root = document,
  dependencies = {},
) {
  const $ = (id) => root.getElementById(id);
  $('status').textContent = 'Loading local tetracube index…';
  const client = await (dependencies.client ||
    createPackingClient({ onProgress: dependencies.onProgress }));
  const engine = await (dependencies.engine || createEngine());
  $('positionalColors').closest('label').title =
    'Assign a distinct color to each physical piece ID.';
  $('datasetSelect').value =
    dependencies.dataset === 'classic' ? 'classic' : 'spatial';
  const info = client.info,
    families = new Map(info.families.map((f) => [f.id, f])),
    membership = new Map();
  let current,
    position = 0,
    total = 0,
    counts = [],
    generation = 0,
    active = 'solved',
    scramble = [];
  const flags = [
    'surfaceOnly',
    'nonSurfaceOnly',
    'allSurfaceIdentities',
    'oneOfEach',
    'officialOnly',
    'iTunnelOnly',
    'somaVOnly',
    'somaSetOnly',
    'dominoGapOnly',
    'nonFaceboundSurface',
  ];
  const types = countSpecs.map(([id]) => id);
  for (const id of [
    'oneOfEach',
    'allSurfaceIdentities',
    'officialOnly',
    'surfaceOnly',
    'nonSurfaceOnly',
  ])
    $(id).checked = false;
  $('spatialFilters').hidden = false;
  try{const saved=localStorage.getItem('stack-it-up.family-inspect');if(saved!==null)$('familyInspectFilters').checked=saved!=='false';}catch{}
  $('familyInspectFilters').onchange=()=>{try{localStorage.setItem('stack-it-up.family-inspect',String($('familyInspectFilters').checked));}catch{}};
  let lockedFamily=null;
  function filters() {
    const f = Object.fromEntries(flags.map((id) => [id, $(id).checked]));
    for (const id of ['extraEdges', 'extraCorners', 'extraCenters'])
      f[id] = $(id).value;
    Object.assign(f, {
      family: lockedFamily ?? (+$('familySelect').value || 0),
      bag: $('familyBag').value || '',
      spatial:
        $('datasetSelect').value === 'classic'
          ? 'none'
          : $('spatialComposition').value,
      planar: $('planarSpanning').value,
      coreType: $('corePieceType').value,
    });
    f.counts = types.map((type) => ({
      type,
      min: +$('countMin' + type).value || 0,
      max:
        $('countMax' + type).value === ''
          ? countLimits[type]
          : +$('countMax' + type).value,
    }));
    return f;
  }
  function remember(p) {
    if (!p) return p;
    membership.set(p.lineNumber, {
      family: families.get(p.familyId),
      bag: p.bag,
    });
    if (membership.size > 256)
      membership.delete(membership.keys().next().value);
    return p;
  }
  const provider = {
    filters,
    lockFamily(id){lockedFamily=id;$('familySelect').disabled=id!==null;if(id!==null)$('familySelect').value=String(id);return query({},true,false);},
    presentation: (p) => packingPresentation(p, colorMode()),
    record: async (id) => remember(await client.record(id)),
    lookup: async (f, m) => {
      const matches=await client.lookup(f,m),criteria=filters(),accepted=[];
      for(const p of matches){const result=await client.query({filters:criteria,line:p.lineNumber});if(result.record?.lineNumber===p.lineNumber)accepted.push(p);}
      return accepted;
    },
    randomPair: async () => {
      const pair = await client.pair(filters());
      return pair?.map(remember);
    },
    selectionChanged: async (p) => {
      if (p) await query({ line: p.lineNumber }, false, false);
    },
    familyOptions: () =>
      info.families
        .filter((f) => counts[f.id] > 0)
        .map((f) => ({ ...f, matching: counts[f.id] })),
    familyStart: async (id) => {
      const result = await client.query({
        filters: { ...filters(), family: id },
        random: true,
      });
      remember(result.record);
      return result;
    },
  };
  const views = createExplorerViews({
    root,
    meshGenerator: (mask, cornerO) => engine.bandMesh(mask, cornerO),
    data: provider,
  });
  function options(select, items, label) {
    const value = select.value;
    select.replaceChildren();
    const any = document.createElement('option');
    any.value = '';
    any.textContent = label;
    select.append(any);
    for (const [value, text] of items) {
      const el = document.createElement('option');
      el.value = String(value);
      el.textContent = text;
      select.append(el);
    }
    select.value = value;
  }
  options(
    $('familyBag'),
    info.bags.map((b) => [b, b]),
    'All identity bags',
  );
  $('familyBag').disabled = false;
  function colorMode() {
    return $('positionalColors').checked ? 'multicolor' : 'canonical';
  }
  function displayPacking(p) {
    const shown = packingPresentation(p, colorMode());
    return [shown.packing, shown.palette];
  }
  function paint() {
    if (!current) return;
    const [display, palette] = displayPacking(current);
    $('sourceLine').value = current.lineNumber;
    $('packingIndex').textContent =
      `${position + 1} of ${total.toLocaleString()} matching · tetracubes-v2 line ${current.lineNumber}`;
    $('packingFamily').textContent =
      `Family ${current.familyId} · ${current.bag} · score ${current.score}`;
    $('packingCode').textContent = current.code;
    $('pieceIdentities').textContent = current.identities
      .map((c, i) => `${i + 1}: ${c}`)
      .join(' · ');
    $('colorStatus').textContent =
      $('positionalColors').checked ? 'Distinct physical-piece colors' : 'Canonical shape colors';
    $('scrambleText').textContent = scramble.join(' ');
    $('solutionText').textContent = scramble
      .slice()
      .reverse()
      .map((m) => (m.endsWith("'") ? m.slice(0, -1) : m + "'"))
      .join(' ');
    views.showPieces(current, palette);
    const solved = $('showSolved').checked,
      scrambled = $('showScrambled').checked;
    $('solvedPanel').hidden = !solved;
    $('scrambledPanel').hidden = !scrambled;
    $('cubeLayout').dataset.views = Number(solved) + Number(scrambled);
    $('emptyView').hidden = solved || scrambled;
    if (active === 'solved' && !solved) active = 'scrambled';
    if (active === 'scrambled' && !scrambled) active = 'solved';
    $('cubeLayout').dataset.active = active;
    $('viewTabs').hidden = !(solved && scrambled);
    $('viewSolved').setAttribute('aria-pressed', String(active === 'solved'));
    $('viewScrambled').setAttribute(
      'aria-pressed',
      String(active === 'scrambled'),
    );
    if (solved) views.showCube('solvedCube', display, palette);
    else views.hide('solvedCube');
    if (scrambled) views.showCube('scrambledCube', display, palette, scramble);
    else views.hide('scrambledCube');
    $('solvedFacelets').textContent =
      'Native tetracube rendering. Catalog masks above retain the source orientation.';
  }
  function clearFilters() {
    $('datasetSelect').value = 'spatial';
    $('spatialComposition').disabled = false;
    for (const id of flags) $(id).checked = false;
    for (const id of [
      'familySelect',
      'familyBag',
      'spatialComposition',
      'planarSpanning',
      'corePieceType',
    ])
      $(id).value = '';
    for (const id of ['extraEdges', 'extraCorners', 'extraCenters'])
      $(id).value = 'any';
    for (const t of types) {
      $('countMin' + t).value = '0';
      $('countMax' + t).value = String(countLimits[t]);
    }
  }
  async function query(action = {}, refresh = false, apply = true) {
    const invalidRanges=refreshRangeCards(root);
    const token = ++generation;
    if(invalidRanges){$('status').textContent='Correct the marked count ranges to filter packings.';return;}
    $('status').textContent = 'Filtering local index…';
    try {
      if(lockedFamily!==null)$('familySelect').value=String(lockedFamily);
      const f = filters();
      if(lockedFamily!==null && action.line){const requested=await client.record(action.line);if(requested?.familyId!==lockedFamily)throw Error(`Shapes are locked to family ${lockedFamily}. Unlock the family lock to change families.`);}
      provider.refreshDetection?.();
      $('filterFamilyStatus').textContent = f.family
        ? `Family ${f.family}`
        : 'All families';
      $('clearFilterFamily').disabled = lockedFamily!==null || !f.family;
      if (
        f.counts.some(
          (c) =>
            !Number.isInteger(c.min) ||
            !Number.isInteger(c.max) ||
            c.min < 0 ||
            c.max > countLimits[c.type] ||
            c.min > c.max,
        )
      ) {
        throw Error(
          'Use whole-number counts with 0 ≤ min ≤ max, within each row’s limit.',
        );
      }
      let result = await client.query({
        filters: f,
        position,
        // Refilter around the selected record, not the first matching result.
        ...(refresh && current ? { line: current.lineNumber } : {}),
        ...(action.offset && current ? { line: current.lineNumber } : {}),
        ...action,
      });
      if (token !== generation) return;
      if (!apply && action.line && result.record?.lineNumber !== action.line) {
        clearFilters();
        result = await client.query({ filters: filters(), line: action.line });
        if (token !== generation) return;
      }
      total = result.count;
      position = result.position;
      counts = result.familyCounts;
      const optionsList = info.families.filter(
        (f) => counts[f.id] || String(f.id) === $('familySelect').value,
      );
      options(
        $('familySelect'),
        optionsList.map((f) => [
          f.id,
          `Family ${f.id} · ${counts[f.id]} matching`,
        ]),
        'All families',
      );
      for (const id of [
        'previous',
        'next',
        'random',
        'back100',
        'back10',
        'forward10',
        'forward100',
      ])
        $(id).disabled = !total;
      $('status').textContent =
        `${total.toLocaleString()} matching packings in the local ${info.count.toLocaleString()}-packing collection.`;
      $('familySummary').textContent =
        `${counts.filter((n) => n > 0).length.toLocaleString()} matching families`;
      const inspecting=refresh&&current&&!action.line&&!action.offset&&!action.random&&$('familyExploreMode').checked&&$('familyInspectFilters').checked;
      const retained = inspecting || refresh && result.record && current &&
        result.record.lineNumber === current.lineNumber;
      if (result.record && !retained) {
        current = remember(result.record);
        scramble = Array.from(
          { length: 20 },
          () =>
            ['U', 'D', 'F', 'B', 'L', 'R'][Math.floor(Math.random() * 6)] +
            (Math.random() < 0.5 ? "'" : ''),
        );
        paint();
      } else {
        $('packingIndex').textContent = 'No matches — previous cube retained';
      }
      if (inspecting) $('packingIndex').textContent=`Inspecting tetracubes-v2 line ${current.lineNumber} - ${total.toLocaleString()} matching packings`;
      else if (retained) $('packingIndex').textContent =
        `${position + 1} of ${total.toLocaleString()} matching - tetracubes-v2 line ${current.lineNumber}`;
      if (result.record && apply && !retained) await views.navigate(current);
    } catch (e) {
      if (token === generation) $('status').textContent = e.message;
    }
  }
  for (const id of [
    ...flags,
    'familySelect',
    'familyBag',
    'extraEdges',
    'extraCorners',
    'extraCenters',
    'spatialComposition',
    'planarSpanning',
    'corePieceType',
    ...types.flatMap((t) => ['countMin' + t, 'countMax' + t]),
  ])
    $(id).addEventListener('change', () => query({ position: 0 }, true));
  function applyPreset(name) {
    if (!name) return;
    const current = Object.fromEntries(
      types.map((id) => [
        id,
        {
          min: Number($('countMin' + id).value),
          max: Number($('countMax' + id).value),
        },
      ]),
    );
    const preset = presetCounts(name, current, +$('familySelect').value || 0);
    clearFilters();
    for (const [id, range] of Object.entries(preset.ranges)) {
      $('countMin' + id).value = String(range.min);
      $('countMax' + id).value = String(range.max);
    }
    if (preset.family) {
      // Include the requested family even if the preceding query excluded it.
      const option = document.createElement('option');
      option.value = String(preset.family);
      option.textContent = `Family ${preset.family}`;
      $('familySelect').append(option);
    }
    $('familySelect').value = preset.family ? String(preset.family) : '';
    return query({ position: 0 }, true);
  }
  $('filterPreset').onchange = () => applyPreset($('filterPreset').value);
  $('resetPackingFilters').onclick = () => {
    $('filterPreset').value = '';
    return applyPreset('all');
  };
  $('resetPieceFilters').onclick = () => {
    $('filterPreset').value = '';
    return applyPreset('pieces');
  };
  $('clearFilterFamily').onclick = () => {
    $('familySelect').value = '';
    $('filterPreset').value = '';
    return query({ position: 0 }, true);
  };
  for (const id of types.flatMap((t) => ['countMin' + t, 'countMax' + t]))
    $(id).addEventListener('input', () => {
      $('filterPreset').value = '';
      refreshRangeCards(root);
    });
  function collectionChanged() {
    const classic = $('datasetSelect').value === 'classic';
    $('spatialComposition').disabled = classic;
    $('spatialComposition').value = classic ? 'none' : '';
    return query({ position: 0 }, true);
  }
  $('datasetSelect').onchange = collectionChanged;
  $('spatialComposition').disabled = $('datasetSelect').value === 'classic';
  if ($('spatialComposition').disabled) $('spatialComposition').value = 'none';
  $('random').onclick = () => query({ random: true });
  $('previous').onclick = () => query({ offset: -1 });
  $('next').onclick = () => query({ offset: 1 });
  for (const [id, offset] of [
    ['back100', -100],
    ['back10', -10],
    ['forward10', 10],
    ['forward100', 100],
  ])
    $(id).onclick = () => query({ offset });
  $('sourceJump').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const target = await provider.record(+$('sourceLine').value);
      clearFilters();
      await query({ line: target.lineNumber }, true);
      $('jumpStatus').textContent =
        'Filters cleared for this tetracubes-v2 source line.';
    } catch (e) {
      $('jumpStatus').textContent = e.message;
    }
  };
  $('exploreFamily').onclick = () => {
    if (current) {
      $('familySelect').value = String(current.familyId);
      return query({ line: current.lineNumber }, true);
    }
  };
  for (const id of ['canonicalColors', 'positionalColors'])
    $(id).onchange = () => {
      for (const other of [
        'canonicalColors',
        'positionalColors',
      ])
        $(other).checked = other === id;
      paint();
      views.refreshColors();
    };
  $('copyCode').onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({
          dataset: info.dataset,
          version: info.version,
          line: current.lineNumber,
          code: current.code,
        }),
      );
      $('status').textContent = 'Packing reference copied.';
    } catch {
      $('status').textContent = 'Select and copy the packing code above.';
    }
  };
  for (const [id, value] of [
    ['viewSolved', 'solved'],
    ['viewScrambled', 'scrambled'],
  ])
    $(id).onclick = () => {
      active = value;
      paint();
    };
  for (const id of ['showSolved', 'showScrambled']) $(id).onchange = paint;
  const picker=$('packingPicker');
  $('closePackingPicker').onclick=()=>{picker.open=false;picker.querySelector('summary')?.focus();};
  picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;picker.querySelector('summary')?.focus();}});
  picker.addEventListener('toggle',()=>{if(picker.open)$('settingsPanel').open=false;});
  $('settingsPanel').addEventListener('toggle',()=>{if($('settingsPanel').open)picker.open=false;});
  $('closeSettings').onclick = () => {
    $('settingsPanel').open = false;
  };
  $('settingsPanel').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('settingsPanel').open = false;
  });
  await query({ line: dependencies.initialLine ?? 50152 });
  await views.startMode();
  return {
    client,
    query,
    views,
    get current() {
      return current;
    },
  };
}
