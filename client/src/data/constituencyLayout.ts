/**
 * Geographic Layout for Irish Constituencies
 * Organized to roughly match Ireland's actual geography
 * All 43 constituencies positioned by region
 */

export interface ConstituencyPosition {
  name: string;
  gridRow: number;
  gridCol: number;
  region: 'Dublin' | 'Leinster' | 'Munster' | 'Connacht' | 'Ulster';
}

/**
 * 43 Constituencies organized geographically
 * Grid layout: 12 rows x 8 columns
 * Positioned to roughly match Ireland's shape
 */
export const CONSTITUENCY_LAYOUT: ConstituencyPosition[] = [
  // ULSTER (Top - North)
  { name: 'Donegal', gridRow: 1, gridCol: 3, region: 'Ulster' },
  { name: 'Sligo-Leitrim', gridRow: 2, gridCol: 3, region: 'Ulster' },
  { name: 'Cavan-Monaghan', gridRow: 2, gridCol: 5, region: 'Ulster' },
  { name: 'Louth', gridRow: 3, gridCol: 6, region: 'Ulster' },

  // CONNACHT (West)
  { name: 'Mayo', gridRow: 3, gridCol: 2, region: 'Connacht' },
  { name: 'Galway West', gridRow: 4, gridCol: 1, region: 'Connacht' },
  { name: 'Galway East', gridRow: 4, gridCol: 2, region: 'Connacht' },
  { name: 'Roscommon-Galway', gridRow: 4, gridCol: 3, region: 'Connacht' },

  // LEINSTER (East/Midlands)
  { name: 'Longford-Westmeath', gridRow: 5, gridCol: 4, region: 'Leinster' },
  { name: 'Meath East', gridRow: 4, gridCol: 6, region: 'Leinster' },
  { name: 'Meath West', gridRow: 4, gridCol: 5, region: 'Leinster' },
  { name: 'Offaly', gridRow: 6, gridCol: 4, region: 'Leinster' },
  { name: 'Laois', gridRow: 7, gridCol: 4, region: 'Leinster' },
  { name: 'Kildare North', gridRow: 6, gridCol: 5, region: 'Leinster' },
  { name: 'Kildare South', gridRow: 7, gridCol: 5, region: 'Leinster' },
  { name: 'Carlow-Kilkenny', gridRow: 8, gridCol: 5, region: 'Leinster' },
  { name: 'Wexford', gridRow: 9, gridCol: 6, region: 'Leinster' },
  { name: 'Wicklow', gridRow: 7, gridCol: 6, region: 'Leinster' },
  { name: 'Wicklow-Wexford', gridRow: 8, gridCol: 6, region: 'Leinster' },

  // DUBLIN (Greater Dublin Area)
  { name: 'Dublin Fingal West', gridRow: 5, gridCol: 6, region: 'Dublin' },
  { name: 'Dublin Fingal East', gridRow: 5, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin Bay North', gridRow: 6, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin North-West', gridRow: 6, gridCol: 6, region: 'Dublin' },
  { name: 'Dublin West', gridRow: 7, gridCol: 6, region: 'Dublin' },
  { name: 'Dublin Mid-West', gridRow: 7, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin Central', gridRow: 6, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin Bay South', gridRow: 7, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin South-West', gridRow: 8, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin South-Central', gridRow: 8, gridCol: 7, region: 'Dublin' },
  { name: 'Dublin Rathdown', gridRow: 7, gridCol: 8, region: 'Dublin' },
  { name: 'Dún Laoghaire', gridRow: 8, gridCol: 8, region: 'Dublin' },

  // MUNSTER (South)
  { name: 'Clare', gridRow: 6, gridCol: 2, region: 'Munster' },
  { name: 'Limerick City', gridRow: 7, gridCol: 2, region: 'Munster' },
  { name: 'Limerick County', gridRow: 7, gridCol: 3, region: 'Munster' },
  { name: 'Tipperary North', gridRow: 7, gridCol: 4, region: 'Munster' },
  { name: 'Tipperary South', gridRow: 8, gridCol: 3, region: 'Munster' },
  { name: 'Waterford', gridRow: 9, gridCol: 4, region: 'Munster' },
  { name: 'Cork North-West', gridRow: 9, gridCol: 2, region: 'Munster' },
  { name: 'Cork North-Central', gridRow: 9, gridCol: 3, region: 'Munster' },
  { name: 'Cork East', gridRow: 10, gridCol: 3, region: 'Munster' },
  { name: 'Cork South-Central', gridRow: 10, gridCol: 2, region: 'Munster' },
  { name: 'Cork South-West', gridRow: 11, gridCol: 2, region: 'Munster' },
  { name: 'Kerry', gridRow: 10, gridCol: 1, region: 'Munster' }
];

/**
 * Get all 43 constituency names
 */
export const ALL_CONSTITUENCIES = CONSTITUENCY_LAYOUT.map(c => c.name);

/**
 * Group constituencies by region
 */
export const CONSTITUENCIES_BY_REGION = {
  Dublin: CONSTITUENCY_LAYOUT.filter(c => c.region === 'Dublin'),
  Leinster: CONSTITUENCY_LAYOUT.filter(c => c.region === 'Leinster'),
  Munster: CONSTITUENCY_LAYOUT.filter(c => c.region === 'Munster'),
  Connacht: CONSTITUENCY_LAYOUT.filter(c => c.region === 'Connacht'),
  Ulster: CONSTITUENCY_LAYOUT.filter(c => c.region === 'Ulster')
};

