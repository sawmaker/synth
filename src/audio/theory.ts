export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const noteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** QWERTY -> semitone offset from the current base C. Layout independent (event.code). */
export const KEY_MAP: Record<string, number> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
};

/** Preferred printed cap label per semitone offset (lower row wins ties below 12). */
export const KEY_LABEL: Record<number, string> = {
  0: "Z",
  1: "S",
  2: "X",
  3: "D",
  4: "C",
  5: "V",
  6: "G",
  7: "B",
  8: "H",
  9: "N",
  10: "J",
  11: "M",
  12: "Q",
  13: "2",
  14: "W",
  15: "3",
  16: "E",
  17: "R",
  18: "5",
  19: "T",
  20: "6",
  21: "Y",
  22: "7",
  23: "U",
  24: "I",
};

export interface ChordShape {
  id: string;
  label: string;
  suffix: string;
  intervals: number[];
}

export const CHORDS: ChordShape[] = [
  { id: "maj", label: "MAJ", suffix: "", intervals: [0, 4, 7] },
  { id: "min", label: "MIN", suffix: "m", intervals: [0, 3, 7] },
  { id: "maj7", label: "MAJ7", suffix: "maj7", intervals: [0, 4, 7, 11] },
  { id: "min7", label: "MIN7", suffix: "m7", intervals: [0, 3, 7, 10] },
  { id: "dom7", label: "DOM7", suffix: "7", intervals: [0, 4, 7, 10] },
  { id: "sus4", label: "SUS4", suffix: "sus4", intervals: [0, 5, 7] },
  { id: "add9", label: "ADD9", suffix: "add9", intervals: [0, 4, 7, 14] },
  { id: "min9", label: "MIN9", suffix: "m9", intervals: [0, 3, 7, 10, 14] },
  { id: "dim", label: "DIM", suffix: "dim", intervals: [0, 3, 6] },
  { id: "aug", label: "AUG", suffix: "aug", intervals: [0, 4, 8] },
  { id: "sixth", label: "6/9", suffix: "6/9", intervals: [0, 4, 9, 14] },
  { id: "stack", label: "STACK", suffix: "5", intervals: [0, 7, 12, 19] },
];

export const chordNotes = (root: number, intervals: number[]) => intervals.map((i) => root + i);

export const formatHz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k` : v.toFixed(v < 100 ? 1 : 0));

export const formatTime = (v: number) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);

export const formatDb = (v: number) => (v <= 0.0001 ? "-∞" : `${(20 * Math.log10(v)).toFixed(1)}`);