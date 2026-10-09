/* The save folder and save slot Chrome and Edge let HoopWire remember, and the newest save in that slot. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoopWireSaveFolder = factory();
})(globalThis, function () {
  'use strict';
  const DB = 'hoopwire.save-folder',
    STORE = 'handles',
    KEY = 'folder';
  const supported = () => typeof globalThis.showDirectoryPicker === 'function';
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function transact(mode, work) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode),
          request = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  // { folder, slot }: the folder handle and the save slot this league is played in.
  async function recall() {
    try {
      const saved = await transact('readonly', store => store.get(KEY));
      return saved?.folder ? saved : null;
    } catch {
      return null;
    }
  }
  const remember = value => transact('readwrite', store => store.put(value, KEY));
  // Asking needs the click that started the load; a saved grant is used without asking.
  async function permitted(handle, ask = false) {
    const options = { mode: 'read' };
    if ((await handle.queryPermission(options)) === 'granted') return true;
    return ask && (await handle.requestPermission(options)) === 'granted';
  }
  // Hoop Land names a save after its slot ("UBA_CAREER_Y1_1967_SAVE_FILE_01") and keeps the slot as the
  // career moves on, while the year in the name changes.
  const slotOf = name => /SAVE_FILE_(\d+)(?:\.json)?$/i.exec(String(name || ''))?.[1] || null;
  // Saves export without a file extension, so files are judged by their contents. Files with another
  // extension are skipped; the rest come newest first.
  async function files(handle) {
    const found = [];
    for await (const entry of handle.values())
      if (entry.kind === 'file' && !/\.(?!json$)[a-z0-9]{1,5}$/i.test(entry.name)) found.push(await entry.getFile());
    return found.sort((a, b) => b.lastModified - a.lastModified);
  }
  async function read(file, isSave) {
    try {
      const data = JSON.parse(await file.text());
      return isSave(data) ? data : null;
    } catch {
      return null;
    }
  }
  // Each slot in the folder with its newest save, described for choosing between them.
  async function slots(handle, isSave, describe) {
    const newest = new Map();
    for (const file of await files(handle)) {
      const slot = slotOf(file.name);
      if (slot && !newest.has(slot)) newest.set(slot, file);
    }
    const result = [];
    for (const [slot, file] of newest) {
      const data = await read(file, isSave);
      if (data) result.push({ slot, file, label: describe(data) });
    }
    return result.sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true }));
  }
  // The newest save in the slot.
  async function latestSave(handle, isSave, slot) {
    for (const file of (await files(handle)).filter(f => slotOf(f.name) === slot))
      if (await read(file, isSave)) return file;
    return null;
  }
  return { supported, recall, remember, permitted, slotOf, slots, latestSave };
});
