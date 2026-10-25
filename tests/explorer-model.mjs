import assert from "node:assert/strict";
import fs from "node:fs";
import {
  turn,
  parseMoves,
  ROTATIONS,
  practicePair,
  randomFamilyPair,
  matchesTarget,
  displayIndex,
} from "../web/explorer/model.js";
import { xyz, rotateCell } from "../web/render/geometry.js";

const cells = Array.from({ length: 27 }, (_, i) => ({
  color: String(i),
  piece: i,
}));
for (let m = 0; m < 30; m++) {
  assert.deepEqual(turn(turn(cells, m), (m + 15) % 30), cells);
  assert.deepEqual([m, m, m, m].reduce(turn, cells), cells);
  const moved = turn(cells, m);
  for (let i = 0; i < 27; i++) {
    const geometry = [...xyz(i), 0, 0, 1, 1, 1, 1];
    rotateCell(geometry, 0, i, m, 1);
    const p = geometry.slice(0, 3).map((v) => Math.round(v) + 1);
    assert.equal(
      moved[p[0] * 9 + p[1] * 3 + p[2]],
      cells[i],
      `animation endpoint ${m}/${i}`,
    );
  }
}
assert.equal(new Set(ROTATIONS.map((r) => r.join(","))).size, 24);
assert.deepEqual(parseMoves(["R2", "U'", "F"]), [5, 5, 15, 2]);
// The measured AnimCube facelet map is retained and agrees with native faces.
for (const [indices, axis, side] of [
  ["123456789", 1, 1],
  ["jmpknqlor", 1, -1],
  ["1aj2bk3cl", 2, -1],
  ["9ir8hq7gp", 2, 1],
  ["147adgjmp", 0, -1],
  ["3cl6fo9ir", 0, 1],
]) {
  for (const char of indices)
    assert.equal(
      xyz(displayIndex("123456789abcdefghijklmnopqr".indexOf(char)))[axis],
      side,
    );
}
const families = [],
  familyByLine = new Map();
let family;
for (const line of fs
  .readFileSync(
    new URL("../web/explorer/refined_families.txt", import.meta.url),
    "utf8",
  )
  .split(/\r?\n/)) {
  const head = /^FAMILY (\d+)/.exec(line);
  if (head) {
    family = { id: Number(head[1]), members: [] };
    families.push(family);
  }
  const member = /^\s+line=(\d+) identities=\S+ scores=\S+ (.+)$/.exec(line);
  if (member) {
    const fields = member[2].split(/\s+/);
    const p = {
      lineNumber: Number(member[1]),
      masks: fields.slice(0, 6).map((x) => parseInt(x, 16)),
      extras: parseInt(fields[6].split("=")[1], 16),
    };
    family.members.push(p);
    familyByLine.set(p.lineNumber, { family });
  }
}
let checked = 0;
for (const f of families)
  for (const p of f.members) {
    const pair = practicePair(f.members[0], p);
    assert(pair.compatible, `family ${f.id}, line ${p.lineNumber}`);
    for (const color of "bymogrwl")
      for (let kind = 0; kind <= 3; kind++) {
        const count = (arr) =>
          arr.filter(
            (c, i) =>
              c.color === color &&
              xyz(i).filter((v) => v !== 0).length === kind,
          ).length;
        assert.equal(count(pair.left), count(pair.right));
      }
    for (let i = 0; i < 27; i++)
      if (xyz(i).filter((v) => v !== 0).length <= 1)
        assert.equal(pair.left[i].color, pair.right[i].color);
    checked++;
  }
const all = families.flatMap((f) => f.members),
  pick = randomFamilyPair(all, familyByLine, () => 0.43);
assert.notEqual(pick[0].lineNumber, pick[1].lineNumber);
assert.equal(
  familyByLine.get(pick[0].lineNumber).family.id,
  familyByLine.get(pick[1].lineNumber).family.id,
);
assert.equal(randomFamilyPair([all[0]], familyByLine), null);
const pair = practicePair(all[0], all[0]);
assert(matchesTarget(pair.left, pair.right));
const rotated = Array(27);
ROTATIONS[7].forEach((dest, i) => (rotated[dest] = pair.right[i]));
assert(matchesTarget(pair.left, rotated));
assert(
  !practicePair(families[0].members[0], families.at(-1).members[0]).compatible,
);
console.log(
  `PASS: 30 move/inverse/animation checks, measured facelet frame, all ${checked} family members, random distinct pairs, orientation-independent target matching.`,
);
