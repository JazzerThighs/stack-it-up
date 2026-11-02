const KEY = 'stack-it-up.saved-game.v1';
// The native state transport validates rules, queue, pending choices and fragments.
// Undo history is intentionally session-only.
export function createLocalGame({engine, started, chooseNext, storage = () => globalThis.localStorage}) {
  let last = '';
  return {
    save() {
      if (!engine() || !started()) return false;
      try {
        const text = JSON.stringify({version:1, words:engine().exportState(), chooseNext:chooseNext()});
        if (text !== last) { storage().setItem(KEY, text); last = text; }
        return true;
      } catch { return false; }
    },
    restore() {
      try {
        const text = storage().getItem(KEY);
        if (!text) return {restored:false};
        if (text.length > 16000) throw Error('Saved game is too large');
        const data = JSON.parse(text);
        if (data.version !== 1 || !engine().importState(data.words)) throw Error('Incompatible saved game');
        last = text;
        return {restored:true, chooseNext:data.chooseNext === true};
      } catch { return {restored:false, error:true}; }
    },
  };
}
