// src/utils.ts

import { Rem } from '@remnote/plugin-sdk';
import { jaroWinkler } from '@skyra/jaro-winkler';
import unidecode from 'unidecode';

/**
 * Normaliza o texto removendo acentos, pontuação e convertendo para minúsculas.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return unidecode(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ')   // Normaliza espaços
    .trim();
}

/**
 * Calcula a similaridade combinada entre dois textos usando Jaro-Winkler.
 * Jaro-Winkler é geralmente mais performático e adequado para strings curtas como títulos de flashcards.
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  if (!normalized1 || !normalized2) return 0;
  return jaroWinkler(normalized1, normalized2);
}

/**
 * Gera uma chave única para um flashcard para detecção de duplicatas exatas.
 */
export function getExactMatchKey(rem: Rem, checkOnlyFront: boolean): string {
  const front = normalizeText(rem.text?.toString() || '');
  if (checkOnlyFront) {
    return front;
  }
  const back = normalizeText(rem.backText?.toString() || '');
  return `${front}::${back}`;
}

/**
 * Gera uma chave para a frente do flashcard.
 */
export function getFrontMatchKey(rem: Rem): string {
    return normalizeText(rem.text?.toString() || '');
}