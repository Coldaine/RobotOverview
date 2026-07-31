import '@testing-library/jest-dom';

// Node 22+ may expose a non-functional localStorage when --localstorage-file is
// unset; HangarProvider and several UI tests expect a working Web Storage API.
const memory = new Map<string, string>();
const storage: Storage = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  key(index: number) {
    return [...memory.keys()][index] ?? null;
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  setItem(key: string, value: string) {
    memory.set(key, String(value));
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  enumerable: true,
  value: storage,
  writable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
    writable: true,
  });
}
