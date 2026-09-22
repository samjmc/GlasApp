/**
 * Shared response shapes for personal rankings.
 *
 * Lifted out of the unmounted personalRankingsRoutes router when the auth rebuild
 * deleted it; parliamentary/voting.ts is the live consumer.
 */
import { IDEOLOGY_DIMENSIONS } from '../../../constants/ideology.js';

interface PersonalRankingRow {
  politician_name?: string;
  overall_compatibility: number;
  ideology_match: number;
  policy_agreement: number;
  policies_compared?: number;
  personal_rank: number;
  public_rank?: number | null;
  td_scores?: {
    party?: string | null;
    constituency?: string | null;
    overall_score?: number | null;
    image_url?: string | null;
  };
}

export function formatUserProfilePayload(profile: unknown) {
  if (!profile) return null;

  const p = profile as Record<string, number>;

  const ideology = IDEOLOGY_DIMENSIONS.reduce<Record<string, number>>((acc, dimension) => {
    acc[dimension] = p[dimension] ?? 0;
    return acc;
  }, {});

  const averageMagnitude =
    IDEOLOGY_DIMENSIONS.reduce((sum, dimension) => sum + Math.abs(ideology[dimension]), 0) /
    IDEOLOGY_DIMENSIONS.length;

  const avgScore = Math.round((averageMagnitude / 10) * 100);

  // Nuanced multi-dimensional ideology labeling
  // Consider all 8 dimensions to create more accurate and varied labels
  const getNuancedIdeologyLabel = (ideology: Record<string, number>): string => {
    const {
      economic = 0,
      social = 0,
      cultural = 0,
      globalism = 0,
      environmental = 0,
      authority = 0,
      welfare = 0,
      technocratic = 0
    } = ideology;

    // Identify primary characteristics (strongest positions)
    const characteristics: string[] = [];
    
    // Economic dimension
    if (economic <= -6) characteristics.push('Left-Wing');
    else if (economic >= 6) characteristics.push('Right-Wing');
    else if (economic <= -3) characteristics.push('Center-Left');
    else if (economic >= 3) characteristics.push('Center-Right');
    
    // Social dimension
    if (social <= -6) characteristics.push('Progressive');
    else if (social >= 6) characteristics.push('Social Conservative');
    
    // Cultural dimension
    if (cultural <= -6) characteristics.push('Multicultural');
    else if (cultural >= 6) characteristics.push('Traditional');
    
    // Globalism dimension (scale: +10 = Ultranationalist, -10 = Internationalist)
    if (globalism >= 6) characteristics.push('Nationalist');
    else if (globalism <= -6) characteristics.push('Internationalist');
    
    // Environmental dimension (scale: +10 = Ecological, -10 = Industrial)
    if (environmental >= 6) characteristics.push('Ecological');
    else if (environmental <= -6) characteristics.push('Industrial');
    
    // Authority dimension
    if (authority <= -6) characteristics.push('Libertarian');
    else if (authority >= 6) characteristics.push('Authoritarian');
    
    // Welfare dimension (scale: +10 = Communitarian, -10 = Individual)
    if (welfare >= 6) characteristics.push('Communitarian');
    else if (welfare <= -6) characteristics.push('Individualist');
    
    // Governance dimension (scale: +10 = Technocratic, -10 = Populist)
    if (technocratic >= 6) characteristics.push('Technocratic');
    else if (technocratic <= -6) characteristics.push('Populist');
    
    // Build nuanced label based on combinations
    // Priority: Most extreme positions first, then combinations
    
    // Special combinations that create distinct ideologies
    // Check most specific combinations first
    // Note: globalism scale: +10 = Ultranationalist, -10 = Internationalist
    // Note: environmental scale: +10 = Ecological, -10 = Industrial
    
    // Traditional + Nationalist + Ecological = Traditional nationalist who prioritizes environment
    if (globalism >= 6 && cultural >= 6 && environmental >= 6) {
      return 'Traditional Nationalist';
    }
    
    // Ecological + Internationalist + Left = Environmental globalist
    if (globalism <= -6 && environmental >= 6 && economic <= -3) {
      return 'Green Internationalist';
    }
    
    // Nationalist + Traditional + Right = National conservative
    if (globalism >= 6 && cultural >= 6 && economic >= 3) {
      return 'National Conservative';
    }
    
    // Nationalist + Industrial + Right = Economic nationalist
    if (globalism >= 6 && environmental <= -6 && economic >= 3) {
      return 'Industrial Nationalist';
    }
    
    // Traditional + Social Conservative + Authoritarian = Social conservative
    if (cultural >= 6 && social >= 6 && authority >= 3) {
      return 'Traditional Conservative';
    }
    
    // Progressive + Multicultural + Left = Progressive multiculturalist
    if (cultural <= -6 && social <= -6 && economic <= -3) {
      return 'Progressive Multiculturalist';
    }
    
    // Ecological + Left + Communitarian = Eco-socialist
    if (environmental >= 6 && economic <= -3 && welfare >= 3) {
      return 'Eco-Socialist';
    }
    
    // Industrial + Right + Authoritarian = Industrial authoritarian
    if (environmental <= -6 && economic >= 6 && authority >= 3) {
      return 'Industrial Authoritarian';
    }
    
    // Technocratic + Authoritarian + Right = Technocratic conservative
    if (technocratic >= 6 && authority >= 3 && economic >= 3) {
      return 'Technocratic Conservative';
    }
    
    // Populist + Libertarian + Progressive = Libertarian progressive
    if (technocratic <= -6 && authority <= -3 && social <= -3) {
      return 'Libertarian Progressive';
    }
    
    // Communitarian + Left + Progressive = Social democrat
    if (welfare >= 6 && economic <= -3 && social <= -3) {
      return 'Social Democrat';
    }
    
    // Individualist + Right + Libertarian = Libertarian right
    if (welfare <= -6 && economic >= 6 && authority <= -3) {
      return 'Libertarian Right';
    }
    
    // Traditional + Nationalist (without strong environmental) = Cultural traditionalist who prioritizes nation
    if (globalism >= 6 && cultural >= 6 && Math.abs(environmental) < 6) {
      return 'Traditional Nationalist';
    }
    
    // Ecological + Nationalist = Green nationalist
    if (globalism >= 6 && environmental >= 6 && economic >= 0) {
      return 'Green Nationalist';
    }
    
    // Industrial + Internationalist = Business globalist (supports global trade)
    if (globalism <= -6 && environmental <= -6 && economic >= 0) {
      return 'Industrial Internationalist';
    }
    
    // Internationalist + Traditional = Cultural traditionalist who supports global cooperation
    if (globalism <= -6 && cultural >= 6) {
      return 'Traditional Internationalist';
    }
    
    // Ecological + Right = Green conservative
    if (environmental >= 6 && economic >= 3 && social >= 0) {
      return 'Green Conservative';
    }
    
    // Populist + Traditional = Traditional populist
    if (technocratic <= -6 && cultural >= 6) {
      return 'Traditional Populist';
    }
    
    // Technocratic + Progressive = Technocratic progressive
    if (technocratic >= 6 && social <= -3 && economic <= 0) {
      return 'Technocratic Progressive';
    }
    
    // If we have characteristics, combine the top 2-3 most relevant
    if (characteristics.length > 0) {
      // Sort by absolute value of corresponding dimension
      const sortedChars = characteristics
        .map(char => {
          let value = 0;
          if (char.includes('Left') || char.includes('Right')) value = Math.abs(economic);
          else if (char.includes('Progressive') || char.includes('Conservative')) value = Math.abs(social);
          else if (char.includes('Multicultural') || char.includes('Traditional')) value = Math.abs(cultural);
          else if (char.includes('Nationalist') || char.includes('Internationalist')) value = Math.abs(globalism);
          // Note: For globalism, higher positive = more nationalist, higher negative = more internationalist
          else if (char.includes('Industrial') || char.includes('Ecological')) value = Math.abs(environmental);
          else if (char.includes('Libertarian') || char.includes('Authoritarian')) value = Math.abs(authority);
          else if (char.includes('Individualist') || char.includes('Communitarian')) value = Math.abs(welfare);
          else if (char.includes('Populist') || char.includes('Technocratic')) value = Math.abs(technocratic);
          return { char, value };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 2)
        .map(item => item.char);
      
      if (sortedChars.length === 2) {
        return `${sortedChars[0]} ${sortedChars[1]}`;
      } else if (sortedChars.length === 1) {
        return sortedChars[0];
      }
    }
    
    // Fallback: use traditional left-right spectrum if nothing else fits
    const leanScore = (economic + social + welfare) / 3;
    if (leanScore <= -5) return 'Strongly Progressive';
    if (leanScore <= -2) return 'Progressive';
    if (leanScore >= 5) return 'Strongly Conservative';
    if (leanScore >= 2) return 'Conservative';
    
    return 'Centrist';
  };

  const ideologyLabel = getNuancedIdeologyLabel(ideology);

  const engagementLabel =
    p.total_weight >= 25
      ? 'Highly engaged'
      : p.total_weight >= 10
      ? 'Engaged'
      : p.total_weight > 0
      ? 'Getting started'
      : 'No votes yet';

  const intensityScore = Math.round(averageMagnitude);

  return {
    ideology,
    totalWeight: p.total_weight || 0,
    avgScore,
    ideologyLabel,
    intensity: intensityScore,
    engagement: engagementLabel,
  };
}

export function formatRankingsResponse(rankings: unknown[]) {
  return rankings.map((r) => {
    const row = r as PersonalRankingRow;
    return {
      name: row.politician_name,
      party: row.td_scores?.party,
      constituency: row.td_scores?.constituency,
      compatibility: Math.round(row.overall_compatibility),
      ideologyMatch: Math.round(row.ideology_match),
      policyAgreement: Math.round(row.policy_agreement),
      policiesCompared: row.policies_compared,
      rank: row.personal_rank,
      publicRank: row.public_rank,
      overallScore: row.td_scores?.overall_score,
      image_url: row.td_scores?.image_url,
      rankDifference: row.public_rank ? (row.public_rank || 0) - (row.personal_rank || 0) : null,
    };
  });
}
