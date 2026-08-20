import { readFile } from 'node:fs/promises';
import path from 'node:path';

type CoachStyle = 'Encouraging & direct' | 'Calm & analytical' | 'High energy';

const toneDirectives: Record<CoachStyle, string> = {
  'Encouraging & direct': 'Tone: warm and action-oriented. Give one concrete next step without hype.',
  'Calm & analytical': 'Tone: measured and evidence-led. Name uncertainty plainly and avoid overclaiming.',
  'High energy': 'Tone: brisk and upbeat. Keep it respectful: no shouting, all caps, or pressure.',
};

let instructionsPromise: Promise<string> | undefined;

export async function loadCoachInstructions() {
  instructionsPromise ??= readFile(path.join(process.cwd(), 'prompts', 'coach-instructions.md'), 'utf8')
    .then((value) => value.trim())
    .then((value) => {
      if (!value) throw new Error('Coach instructions are empty');
      return value;
    });
  return instructionsPromise;
}

export async function buildCoachInstructions(style: CoachStyle) {
  return `${await loadCoachInstructions()}\n\n${toneDirectives[style]}`;
}
