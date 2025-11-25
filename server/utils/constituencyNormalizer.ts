/**
 * Constituency Name Normalizer
 * Handles common misspellings, en-dashes vs hyphens, and standardizes constituency names
 */

/**
 * Official list of 44 Irish electoral constituencies (2024)
 * Includes Wicklow-Wexford, a new 3-seat constituency created in 2023 from parts of Wicklow and Wexford
 */
export const OFFICIAL_CONSTITUENCIES = [
  'Carlow-Kilkenny',
  'Cavan-Monaghan',
  'Clare',
  'Cork East',
  'Cork North-Central',
  'Cork North-West',
  'Cork South-Central',
  'Cork South-West',
  'Donegal',
  'Dublin Bay North',
  'Dublin Bay South',
  'Dublin Central',
  'Dublin Fingal East',
  'Dublin Fingal West',
  'Dublin Mid-West',
  'Dublin North-West',
  'Dublin Rathdown',
  'Dublin South-Central',
  'Dublin South-West',
  'Dublin West',
  'Dún Laoghaire',
  'Galway East',
  'Galway West',
  'Kerry',
  'Kildare North',
  'Kildare South',
  'Laois',
  'Limerick City',
  'Limerick County',
  'Longford-Westmeath',
  'Louth',
  'Mayo',
  'Meath East',
  'Meath West',
  'Offaly',
  'Roscommon-Galway',
  'Sligo-Leitrim',
  'Tipperary North',
  'Tipperary South',
  'Waterford',
  'Wexford',
  'Wicklow',
  'Wicklow-Wexford'
];

/**
 * Map of common misspellings/variations to official names
 */
const CONSTITUENCY_ALIASES: Record<string, string> = {
  // En-dash variations (– vs -)
  'Carlow–Kilkenny': 'Carlow-Kilkenny',
  'Cavan–Monaghan': 'Cavan-Monaghan',
  'Cork North–Central': 'Cork North-Central',
  'Cork North–West': 'Cork North-West',
  'Cork South–Central': 'Cork South-Central',
  'Cork South–West': 'Cork South-West',
  'Dublin Mid–West': 'Dublin Mid-West',
  'Dublin North–West': 'Dublin North-West',
  'Dublin South–Central': 'Dublin South-Central',
  'Dublin South–West': 'Dublin South-West',
  'Longford–Westmeath': 'Longford-Westmeath',
  'Roscommon–Galway': 'Roscommon-Galway',
  'Sligo–Leitrim': 'Sligo-Leitrim',
  'Wicklow–Wexford': 'Wicklow-Wexford', // En-dash variation
  
  // Legacy/alternative names
  'Tipperary': 'Tipperary North', // Default to North if unspecified
  'North Tipperary': 'Tipperary North',
  'South Tipperary': 'Tipperary South',
  'Dun Laoghaire': 'Dún Laoghaire',
  'Limerick': 'Limerick City', // Default to City if unspecified
  
  // Common typos
  'Dublin Rathdown ': 'Dublin Rathdown',
  'Dublin Bay  North': 'Dublin Bay North',
  'Dublin Bay  South': 'Dublin Bay South'
};

/**
 * Normalize a constituency name to match official format
 * @param name Raw constituency name from database or user input
 * @returns Normalized constituency name, or null if invalid
 */
export function normalizeConstituencyName(name: string | null | undefined): string | null {
  if (!name || typeof name !== 'string') {
    return null;
  }

  // Trim whitespace
  let normalized = name.trim();

  // Replace en-dashes with regular hyphens
  normalized = normalized.replace(/–/g, '-');

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Check if it's in our aliases map
  if (CONSTITUENCY_ALIASES[normalized]) {
    return CONSTITUENCY_ALIASES[normalized];
  }

  // Check if it's an official constituency (case-insensitive match)
  const officialMatch = OFFICIAL_CONSTITUENCIES.find(
    official => official.toLowerCase() === normalized.toLowerCase()
  );

  if (officialMatch) {
    return officialMatch;
  }

  // Return the normalized version even if not in official list
  // This handles edge cases and new constituencies
  return normalized;
}

/**
 * Check if a constituency name is valid (exists in official list)
 * @param name Constituency name to check
 * @returns true if valid, false otherwise
 */
export function isValidConstituency(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizeConstituencyName(name);
  return normalized !== null && OFFICIAL_CONSTITUENCIES.includes(normalized);
}

/**
 * Get the official constituency name for a given input
 * Returns 'Unknown' if the input cannot be matched
 * @param name Raw constituency name
 * @returns Official constituency name or 'Unknown'
 */
export function getOfficialConstituencyName(name: string | null | undefined): string {
  const normalized = normalizeConstituencyName(name);
  if (normalized && OFFICIAL_CONSTITUENCIES.includes(normalized)) {
    return normalized;
  }
  return 'Unknown';
}

