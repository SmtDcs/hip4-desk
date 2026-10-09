/**
 * Market Discovery and Parsing Module
 * Identifies and filters priceBinary markets from Hyperliquid outcomeMeta.
 * STRICT ENFORCEMENT: Rejects sports/event/election markets.
 */

import {
  OutcomeMetaItem,
  ParsedPriceBinary,
  MarketTemplateType,
} from '../types.js';

export class MarketDiscovery {
  /**
   * Parses time string format 'YYYYMMDD-HHMM' or ISO/Unix timestamps into Date and ms
   */
  static parseExpiryTime(timeStr: string): { date: Date; timestampMs: number } | null {
    if (!timeStr) return null;

    // Check 'YYYYMMDD-HHMM' (e.g. '20261101-0000' or '20260825-1856')
    const pattern = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/;
    const match = timeStr.trim().match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed
      const day = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const date = new Date(Date.UTC(year, month, day, hour, minute, 0));
      return { date, timestampMs: date.getTime() };
    }

    // Try Unix epoch timestamp (seconds or ms)
    const num = Number(timeStr);
    if (!isNaN(num) && num > 0) {
      const ms = num < 10000000000 ? num * 1000 : num;
      const date = new Date(ms);
      return { date, timestampMs: ms };
    }

    // Try standard Date.parse
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) {
      return { date: new Date(parsed), timestampMs: parsed };
    }

    return null;
  }

  /**
   * Parses key-value pairs separated by '|' and ':' in description
   * e.g., "perp:BTC|threshold:85000|time:20261101-0000"
   */
  static parseDescriptionFields(description: string): Record<string, string> {
    const fields: Record<string, string> = {};
    if (!description) return fields;

    const parts = description.split('|');
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const key = part.slice(0, colonIdx).trim();
        const val = part.slice(colonIdx + 1).trim();
        fields[key] = val;
      }
    }
    return fields;
  }

  /**
   * Attempts to parse an outcome into a ParsedPriceBinary.
   * Returns null if the market is not a supported price binary market
   * (e.g., sports, subjective events, unsupported structures).
   */
  static parseOutcome(
    item: OutcomeMetaItem,
    nowMs: number = Date.now()
  ): ParsedPriceBinary | null {
    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();

    // STRICT REJECTION: Reject sports, tournaments, election, politics, entertainment
    const excludedKeywords = [
      'sports',
      'tournament',
      'participant',
      'match',
      'premier',
      'league',
      'nba',
      'uefa',
      'nfl',
      'election',
      'president',
      'winner',
      'champion',
      'other',
      'fallback',
    ];
    if (excludedKeywords.some((kw) => nameLower.includes(kw) || descLower.includes(kw))) {
      return null;
    }

    // Check template type
    let templateType: MarketTemplateType = 'unsupported';
    if (nameLower.includes('pricebinary') || descLower.includes('pricebinary')) {
      templateType = 'priceBinary';
    } else if (nameLower.includes('binarypriceexternal') || descLower.includes('binarypriceexternal')) {
      templateType = 'binaryPriceExternal';
    } else if (nameLower.includes('binaryprice') || descLower.includes('binaryprice')) {
      templateType = 'binaryPrice';
    } else if (nameLower.includes('pricetouch') || descLower.includes('pricetouch')) {
      templateType = 'priceTouch';
    } else if (nameLower.includes('price') || descLower.includes('perp:')) {
      templateType = 'priceBinary';
    } else {
      return null;
    }

    const fields = this.parseDescriptionFields(item.description);

    // Extract underlying coin
    let underlyingPerp = fields['perp'] || fields['shortName'] || '';
    if (!underlyingPerp) {
      // Fallback heuristics from description or name
      const btcMatch = item.description.match(/\b(BTC|ETH|SOL|HYPE)\b/i);
      if (btcMatch) {
        underlyingPerp = btcMatch[1].toUpperCase();
      }
    }
    // Clean up "xyz:SKHX" or "BTC-USD" -> extract root symbol
    if (underlyingPerp.includes('-')) {
      underlyingPerp = underlyingPerp.split('-')[0];
    }
    if (underlyingPerp.includes(':')) {
      const segs = underlyingPerp.split(':');
      underlyingPerp = segs[segs.length - 1];
    }
    underlyingPerp = underlyingPerp.toUpperCase().trim();

    if (!underlyingPerp) {
      return null;
    }

    // Extract strike price (threshold or target)
    const strikeRaw = fields['threshold'] || fields['target'];
    if (!strikeRaw) {
      return null;
    }
    const strikePrice = parseFloat(strikeRaw);
    if (isNaN(strikePrice) || strikePrice <= 0) {
      return null;
    }

    // Extract expiry time
    const timeRaw = fields['time'];
    const expiry = this.parseExpiryTime(timeRaw);
    if (!expiry) {
      return null;
    }

    const timeToExpirySeconds = (expiry.timestampMs - nowMs) / 1000;
    const isExpired = timeToExpirySeconds <= 0;

    return {
      outcomeId: item.outcome,
      venue: item.venue,
      quoteToken: item.quoteToken,
      templateType,
      underlyingPerp,
      strikePrice,
      expiryTimestampMs: expiry.timestampMs,
      expiryDate: expiry.date,
      isExpired,
      timeToExpirySeconds,
      rawName: item.name,
      rawDescription: item.description,
    };
  }

  /**
   * Discovers and parses all valid price binary markets from a list of outcomeMeta items
   */
  static discoverPriceBinaryMarkets(
    outcomes: OutcomeMetaItem[],
    options?: {
      includeExpired?: boolean;
      targetVenue?: string;
      nowMs?: number;
    }
  ): ParsedPriceBinary[] {
    const nowMs = options?.nowMs ?? Date.now();
    const results: ParsedPriceBinary[] = [];

    for (const item of outcomes) {
      if (options?.targetVenue && item.venue !== options.targetVenue) {
        continue;
      }

      const parsed = this.parseOutcome(item, nowMs);
      if (!parsed) continue;

      if (!options?.includeExpired && parsed.isExpired) {
        continue;
      }

      results.push(parsed);
    }

    return results;
  }
}
