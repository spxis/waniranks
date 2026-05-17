export type JlptMeta = {
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
  wordExamples: unknown;
  strokeCount: number | null;
  frequencyRank: number | null;
  schoolGrade: number | null;
  heisigKeyword: string | null;
};

export type JlptKanjiRow = JlptMeta & {
  kanji: string;
  nLevel: number;
  unicodeHex: string | null;
  sourceJlpt: number | null;
  notes: string[];
};
