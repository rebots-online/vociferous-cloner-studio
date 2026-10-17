import type { SpeechSegment, SpeechUnit } from './chatterboxTypes';

export function segmentSpeechText(text: string, final: boolean): SpeechSegment[] {
  const units: SpeechSegment[] = [];
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
  let start = 0;
  for (const paragraph of text.matchAll(/[^\r\n]+(?:\r?\n|$)/gu)) {
    const closedLine = /[\r\n]$/.test(paragraph[0]);
    const segments = segmenter ? [...segmenter.segment(paragraph[0])] :
      [...paragraph[0].matchAll(/[^.!?]+(?:[.!?]+["'”’)]*(?:\s+|$)|$)/gu)].map(match => ({ index: match.index!, segment: match[0] }));
    for (const segment of segments) {
      const boundary = paragraph.index! + segment.index + segment.segment.length;
      const end = boundary - (segment.segment.length - segment.segment.trimEnd().length);
      const complete = boundary < text.length || final || closedLine || /[.!?]["'”’)\]]*\s+$/u.test(segment.segment);
      if (!complete || !text.slice(start, end).trim()) continue;
      units.push({ text: text.slice(start, end), start, end });
      start = end;
    }
  }
  if (final && start < text.length) {
    if (text.slice(start).trim()) units.push({ text: text.slice(start), start, end: text.length });
    else if (units.length) { units[units.length - 1].text += text.slice(start); units[units.length - 1].end = text.length; }
  }
  return units;
}

export function planSpeechUnits(text: string, countTokens: (value: string) => number, maxTokens: number): SpeechUnit[] {
  if (!text.trim()) throw new Error('No text to speak.');
  if (!Number.isInteger(maxTokens) || maxTokens < 1) throw new Error('Invalid speech token capacity.');
  return segmentSpeechText(text, true).map(unit => {
    const tokenCount = countTokens(unit.text);
    if (tokenCount > maxTokens) throw new Error('A complete sentence or logical unit exceeds the model capacity. No speech was truncated.');
    return { ...unit, tokenCount };
  });
}
