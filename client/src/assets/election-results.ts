// Election results data for Irish constituencies
// Based on sample data from https://gist.github.com/cavedave/f043996ec398267c7a558a95c4dc2601

export const ELECTION_RESULTS: Record<string, string> = {
  // Kerry
  "Kerry1": "Independent",
  "Kerry2": "Independent",
  "Kerry3": "Fine Gael",
  "Kerry4": "Fianna Fáil",
  "Kerry5": "Sinn Féin",
  
  // Cork
  "Cork South-West1": "Fianna Fáil",
  "Cork South-West2": "Fine Gael",
  "Cork South-West3": "Independent",
  "Cork North-West1": "Fianna Fáil",
  "Cork North-West2": "Fianna Fáil",
  "Cork North-West3": "Fine Gael",
  "Cork East1": "Fine Gael",
  "Cork East2": "Fianna Fáil",
  "Cork East3": "Sinn Féin",
  "Cork East4": "Fine Gael",
  
  // Dublin
  "Dublin Central1": "Sinn Féin",
  "Dublin Central2": "Fine Gael",
  "Dublin Central3": "Green Party",
  "Dublin Central4": "Independent",
  "Dublin Bay North1": "Fianna Fáil",
  "Dublin Bay North2": "Fine Gael",
  "Dublin Bay North3": "Sinn Féin",
  "Dublin Bay North4": "Independent",
  "Dublin Bay North5": "Independent",
  "Dublin Bay South1": "Fine Gael",
  "Dublin Bay South2": "Green Party",
  "Dublin Bay South3": "Fianna Fáil",
  "Dublin Bay South4": "Sinn Féin",
  
  // Galway
  "Galway East1": "Fianna Fáil",
  "Galway East2": "Fine Gael",
  "Galway East3": "Independent",
  "Galway West1": "Fianna Fáil",
  "Galway West2": "Fine Gael",
  "Galway West3": "Sinn Féin",
  "Galway West4": "Independent",
  "Galway West5": "Independent"
};

// Party colors for visualization
export const PARTY_COLORS: Record<string, string> = {
  "Fianna Fáil": "#10823A", // Green
  "Fine Gael": "#0051BA", // Blue
  "Sinn Féin": "#326760", // Dark Green
  "Green Party": "#00FF00", // Bright Green
  "Labour Party": "#CC0000", // Red
  "Social Democrats": "#752F8B", // Purple
  "Solidarity–PBP": "#8B0000", // Dark Red
  "Independent": "#666666", // Gray
  "Aontú": "#FFA500", // Orange
  "Other": "#999999" // Light Gray
};

// Function to get party color
export function getPartyColor(partyName: string): string {
  return PARTY_COLORS[partyName] || PARTY_COLORS["Other"];
}