/**
 * Financial Module — Transaction Matching Algorithm
 *
 * Matches imported bank transactions against existing system transactions.
 * Uses tiered matching: Exact (0.95), Strong (0.85), Fuzzy (0.70), None (0.0).
 */

import type { FinancialTransaction } from '@/types/financial';
import type { ParsedRow } from './bankImportParser';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MatchType = 'exact' | 'strong' | 'fuzzy' | 'none';

export interface MatchResult {
  bankTransactionIndex: number;
  matchedTransactionId: string | null;
  confidence: number;
  matchType: MatchType;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EXACT_CONFIDENCE = 0.95;
const STRONG_CONFIDENCE = 0.85;
const FUZZY_CONFIDENCE = 0.70;

const STRONG_DATE_TOLERANCE_DAYS = 3;
const FUZZY_DATE_TOLERANCE_DAYS = 7;
const FUZZY_DESCRIPTION_THRESHOLD = 0.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the number of days between two date strings (YYYY-MM-DD).
 */
function daysDifference(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate word overlap similarity between two strings.
 * Returns a number between 0 and 1.
 */
function descriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const wordsA = new Set(
    a.toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2) // Skip very short words
  );

  const wordsB = new Set(
    b.toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let matchCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matchCount++;
  }

  const maxWords = Math.max(wordsA.size, wordsB.size);
  return matchCount / maxWords;
}

/**
 * Check if a reference matches. Handles partial reference matching.
 */
function referenceMatches(bankRef: string | undefined, txRef: string | null): boolean {
  if (!bankRef || !txRef) return false;
  const cleanBankRef = bankRef.trim().toLowerCase();
  const cleanTxRef = txRef.trim().toLowerCase();
  if (cleanBankRef.length === 0 || cleanTxRef.length === 0) return false;
  return cleanBankRef === cleanTxRef ||
    cleanBankRef.includes(cleanTxRef) ||
    cleanTxRef.includes(cleanBankRef);
}

// ─── Main Matching Function ─────────────────────────────────────────────────

/**
 * Match imported bank rows against existing transactions.
 * Returns one MatchResult per bank row.
 *
 * Each existing transaction can only be matched once (1-to-1).
 */
export function matchTransactions(
  bankRows: ParsedRow[],
  existingTransactions: FinancialTransaction[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedTransactionIds = new Set<string>();

  for (let i = 0; i < bankRows.length; i++) {
    const bankRow = bankRows[i];
    let bestMatch: MatchResult = {
      bankTransactionIndex: i,
      matchedTransactionId: null,
      confidence: 0,
      matchType: 'none',
    };

    for (const tx of existingTransactions) {
      // Skip already matched transactions
      if (usedTransactionIds.has(tx.id)) continue;

      // Amount must match (comparing absolute values since bank might use signed amounts)
      const amountMatches = Math.abs(bankRow.amount) === tx.amount;
      if (!amountMatches) continue;

      const dateDiff = daysDifference(bankRow.date, tx.date);

      // Tier 1: Exact match — same amount + same date + reference matches
      if (dateDiff === 0 && referenceMatches(bankRow.reference, tx.reference)) {
        if (EXACT_CONFIDENCE > bestMatch.confidence) {
          bestMatch = {
            bankTransactionIndex: i,
            matchedTransactionId: tx.id,
            confidence: EXACT_CONFIDENCE,
            matchType: 'exact',
          };
          break; // Can't do better than exact
        }
      }

      // Tier 2: Strong match — same amount + date within +/-3 days
      if (dateDiff <= STRONG_DATE_TOLERANCE_DAYS) {
        if (STRONG_CONFIDENCE > bestMatch.confidence) {
          bestMatch = {
            bankTransactionIndex: i,
            matchedTransactionId: tx.id,
            confidence: STRONG_CONFIDENCE,
            matchType: 'strong',
          };
        }
      }

      // Tier 3: Fuzzy match — same amount + date within +/-7 days + description overlap > 50%
      if (dateDiff <= FUZZY_DATE_TOLERANCE_DAYS) {
        const similarity = descriptionSimilarity(bankRow.description, tx.description);
        if (similarity >= FUZZY_DESCRIPTION_THRESHOLD && FUZZY_CONFIDENCE > bestMatch.confidence) {
          bestMatch = {
            bankTransactionIndex: i,
            matchedTransactionId: tx.id,
            confidence: FUZZY_CONFIDENCE,
            matchType: 'fuzzy',
          };
        }
      }
    }

    // Mark the matched transaction as used
    if (bestMatch.matchedTransactionId) {
      usedTransactionIds.add(bestMatch.matchedTransactionId);
    }

    results.push(bestMatch);
  }

  return results;
}
