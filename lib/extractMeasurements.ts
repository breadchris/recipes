export interface Measurements {
  temperatures: string[];
  amounts: string[];
  times: string[];
}

// Temperature patterns: 320°F, 180°C, medium-high heat, etc.
const TEMP_PATTERN = /\b(\d+\s*°\s*[FCfc]|\d+\s*degrees?\s*[FCfc](?:ahrenheit|elsius)?|(?:low|medium|medium-low|medium-high|high)\s*heat)\b/gi;

// Time patterns: 5 minutes, 30 seconds, 2 hours, etc.
const TIME_PATTERN = /\b(\d+(?:\s*-\s*\d+)?\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?))\b/gi;

// Amount patterns: 2 cups, 1/2 teaspoon, 3 tablespoons, etc.
const AMOUNT_PATTERN = /\b(\d+(?:\/\d+)?(?:\s*-\s*\d+(?:\/\d+)?)?\s*(?:cups?|tablespoons?|tbsps?|teaspoons?|tsps?|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|ml|liters?|l|quarts?|qt|pints?|pt|gallons?|gal|pinch(?:es)?|dash(?:es)?|cloves?|slices?|pieces?|inch(?:es)?|cm))\b/gi;

export function extractMeasurements(text: string): Measurements {
  const temperatures = [...new Set((text.match(TEMP_PATTERN) || []).map(s => s.trim()))];
  const times = [...new Set((text.match(TIME_PATTERN) || []).map(s => s.trim()))];
  const amounts = [...new Set((text.match(AMOUNT_PATTERN) || []).map(s => s.trim()))];

  return { temperatures, amounts, times };
}
