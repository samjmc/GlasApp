export interface ConstituencyStory {
  historicalFact?: string;
  politicalTrend?: string;
  notablePoliticians?: string[];
  keyIssues?: string[];
  economicFocus?: string;
}

export const constituencyStories: Record<string, ConstituencyStory> = {
  "Carlow–Kilkenny": {
    historicalFact: "Carlow-Kilkenny has been a traditional Fianna Fáil stronghold, consistently electing TDs from the party since the 1930s.",
    politicalTrend: "The constituency has shown a pattern of balance between rural conservative and urban progressive voting.",
    keyIssues: ["Agriculture", "Rural development", "Tourism infrastructure"],
    economicFocus: "Agricultural economy with growing tourism sector"
  },
  "Cavan–Monaghan": {
    historicalFact: "Cavan-Monaghan is a border constituency deeply affected by the Troubles and Brexit debates.",
    politicalTrend: "Strong Sinn Féin territory with growing support over recent elections.",
    keyIssues: ["Cross-border trade", "Brexit impacts", "Rural healthcare"],
    economicFocus: "Border trade and agriculture"
  },
  "Clare": {
    historicalFact: "Clare has a history of independent representation, often electing TDs outside the main parties.",
    politicalTrend: "Independent-minded constituency with traditional values.",
    keyIssues: ["Tourism", "Shannon Airport", "Rural depopulation"],
    economicFocus: "Tourism around Cliffs of Moher and the Burren"
  },
  "Cork East": {
    historicalFact: "Cork East is one of the few constituencies where Labour has maintained representation consistently.",
    politicalTrend: "Mix of urban centers and rural areas creates political diversity.",
    keyIssues: ["Urban-rural divide", "Industrial development", "Housing"],
    economicFocus: "Manufacturing and agriculture"
  },
  "Cork North-Central": {
    historicalFact: "Cork North-Central has seen significant demographic changes with new housing developments.",
    politicalTrend: "Growing Sinn Féin support in working-class areas.",
    keyIssues: ["Urban renewal", "Public transport", "Community services"],
    economicFocus: "Urban services and retail"
  },
  "Cork North-West": {
    historicalFact: "Cork North-West is one of Ireland's most rural constituencies.",
    politicalTrend: "Historically dominated by Fine Gael and Fianna Fáil.",
    keyIssues: ["Agricultural supports", "Rural infrastructure", "Farming sustainability"],
    economicFocus: "Agriculture and dairy farming"
  },
  "Cork South-Central": {
    historicalFact: "Cork South-Central has produced multiple party leaders and Taoisigh.",
    politicalTrend: "Highly competitive constituency between major parties.",
    keyIssues: ["Urban development", "Housing crisis", "Transport infrastructure"],
    economicFocus: "Professional services and technology"
  },
  "Cork South-West": {
    historicalFact: "Cork South-West includes some of Ireland's most scenic coastal areas.",
    politicalTrend: "Strong agricultural and rural community voice.",
    keyIssues: ["Tourism", "Coastal protection", "Rural services"],
    economicFocus: "Tourism and agriculture"
  },
  "Donegal": {
    historicalFact: "Donegal's unique position isolated from Northern Ireland by geography has shaped its political identity.",
    politicalTrend: "Growing Sinn Féin support with traditional Fianna Fáil backing.",
    keyIssues: ["Infrastructure isolation", "Emigration", "Cross-border services"],
    economicFocus: "Tourism and small-scale manufacturing"
  },
  "Dublin Bay North": {
    historicalFact: "Dublin Bay North includes some of Dublin's most valuable coastal property.",
    politicalTrend: "Increasingly progressive with strong environmental concerns.",
    keyIssues: ["Coastal development", "Housing costs", "Public transport"],
    economicFocus: "Professional services and retail"
  },
  "Dublin Bay South": {
    historicalFact: "Dublin Bay South contains many of Ireland's key institutions and embassies.",
    politicalTrend: "Liberal, wealthy constituency with growing Green support.",
    keyIssues: ["Urban development", "Housing crisis", "Environmental protection"],
    economicFocus: "Finance, tech, and government services"
  },
  "Dublin Central": {
    historicalFact: "Dublin Central includes the heart of the capital and many historic sites of the 1916 Rising.",
    politicalTrend: "Urban progressive with strong support for left parties.",
    keyIssues: ["Urban regeneration", "Social housing", "Homelessness"],
    economicFocus: "Retail, tourism, and services"
  },
  "Dublin Fingal": {
    historicalFact: "Dublin Fingal has transformed from rural county to suburban extension of Dublin.",
    politicalTrend: "Increasingly diverse politically with growing Green Party support.",
    keyIssues: ["Transport links", "New communities", "Airport expansion"],
    economicFocus: "Aviation, commuter economy, and agriculture"
  },
  "Dublin Mid-West": {
    historicalFact: "Dublin Mid-West has seen rapid development and demographic changes since the 1990s.",
    politicalTrend: "Working-class areas trending toward Sinn Féin with middle-class areas supporting traditional parties.",
    keyIssues: ["Housing affordability", "Transport congestion", "Community facilities"],
    economicFocus: "Retail, logistics, and services"
  },
  "Dublin North-West": {
    historicalFact: "Dublin North-West includes some of Dublin's most historically working-class areas.",
    politicalTrend: "Strong left-wing representation with increasing Sinn Féin dominance.",
    keyIssues: ["Social housing", "Employment opportunities", "Community services"],
    economicFocus: "Public sector employment and retail"
  },
  "Dublin Rathdown": {
    historicalFact: "Dublin Rathdown (formerly Dublin South) has the highest average income in Ireland.",
    politicalTrend: "Consistently elects candidates from center and center-right parties.",
    keyIssues: ["Property taxes", "Local amenities", "Public transport"],
    economicFocus: "Professional services, finance, and tech"
  },
  "Dublin South-Central": {
    historicalFact: "Dublin South-Central includes historically significant working-class neighborhoods of Dublin.",
    politicalTrend: "Strong support for left-wing candidates and progressive policies.",
    keyIssues: ["Housing regeneration", "Employment", "Community services"],
    economicFocus: "Services, retail, and light industry"
  },
  "Dublin South-West": {
    historicalFact: "Dublin South-West has transformed from rural villages to suburban communities over the past 40 years.",
    politicalTrend: "Working and middle-class mix creates political diversity.",
    keyIssues: ["Housing developments", "Transport links", "Community facilities"],
    economicFocus: "Commuter economy and retail"
  },
  "Dublin West": {
    historicalFact: "Dublin West includes the rapidly growing town of Blanchardstown and Dublin 15 area.",
    politicalTrend: "Increasingly diverse population reflected in voting patterns.",
    keyIssues: ["Integration", "Housing supply", "Transport infrastructure"],
    economicFocus: "Retail, pharmaceutical industry, and IT"
  },
  "Dún Laoghaire": {
    historicalFact: "Dún Laoghaire is one of Ireland's wealthiest and most educated constituencies.",
    politicalTrend: "Historically Fine Gael with growing Green Party support.",
    keyIssues: ["Coastal development", "Property taxes", "Marine conservation"],
    economicFocus: "Professional services, tech, and marine activities"
  },
  "Galway East": {
    historicalFact: "Galway East represents the rural hinterland of Galway city and has maintained its rural character.",
    politicalTrend: "Traditional Fianna Fáil and Fine Gael territory.",
    keyIssues: ["Agricultural policy", "Rural services", "Tourism development"],
    economicFocus: "Agriculture and rural tourism"
  },
  "Galway West": {
    historicalFact: "Galway West includes Galway City, one of Ireland's most culturally vibrant urban centers.",
    politicalTrend: "Urban-rural divide creates interesting political mix.",
    keyIssues: ["Tourism infrastructure", "Urban development", "University funding"],
    economicFocus: "Education, tourism, and technology"
  },
  "Kerry": {
    historicalFact: "Kerry has a history of electing strong independent voices to the Dáil.",
    politicalTrend: "Independent streak with traditional party loyalty.",
    keyIssues: ["Tourism infrastructure", "Rural services", "Coastal protection"],
    economicFocus: "Tourism and agricultural businesses"
  },
  "Kildare North": {
    historicalFact: "Kildare North has seen massive population growth due to Dublin commuter expansion.",
    politicalTrend: "Growing diversity in voting patterns as population changes.",
    keyIssues: ["Transport links", "Housing development", "Community services"],
    economicFocus: "Commuter economy and horse breeding industry"
  },
  "Kildare South": {
    historicalFact: "Kildare South includes the Curragh, home to Ireland's military traditions.",
    politicalTrend: "Traditional Fianna Fáil support with growing diversity.",
    keyIssues: ["Military facilities", "Transport infrastructure", "Housing development"],
    economicFocus: "Defense, equine industry, and agriculture"
  },
  "Laois–Offaly": {
    historicalFact: "Laois-Offaly was the constituency of former Taoiseach Brian Cowen.",
    politicalTrend: "Strong Fianna Fáil territory historically.",
    keyIssues: ["Bog conservation", "Agricultural supports", "Regional development"],
    economicFocus: "Agriculture and food processing"
  },
  "Limerick City": {
    historicalFact: "Limerick City has transformed from industrial center to educational and tech hub.",
    politicalTrend: "Urban-rural divide influences voting patterns.",
    keyIssues: ["Urban regeneration", "University expansion", "Industrial recovery"],
    economicFocus: "Education, technology, and services"
  },
  "Longford–Westmeath": {
    historicalFact: "Longford-Westmeath represents the heart of Ireland's midlands region.",
    politicalTrend: "Traditional voting patterns with strong localism.",
    keyIssues: ["Rural broadband", "Agricultural supports", "Tourism development"],
    economicFocus: "Agriculture and small manufacturing"
  },
  "Louth": {
    historicalFact: "Louth includes Ireland's largest town, Drogheda, and the border town of Dundalk.",
    politicalTrend: "Growing Sinn Féin territory historically represented by Gerry Adams.",
    keyIssues: ["Cross-border trade", "Urban development", "Brexit impacts"],
    economicFocus: "Manufacturing, retail, and border trade"
  },
  "Mayo": {
    historicalFact: "Mayo was the constituency of former Taoiseach Enda Kenny for over 40 years.",
    politicalTrend: "Strong Fine Gael territory with rural conservative values.",
    keyIssues: ["Rural depopulation", "Agricultural supports", "Tourism infrastructure"],
    economicFocus: "Agriculture, fishing, and tourism"
  },
  "Meath East": {
    historicalFact: "Meath East has transformed from rural to suburban as Dublin's commuter belt expanded.",
    politicalTrend: "Transitioning from traditional to commuter voting patterns.",
    keyIssues: ["Transport links", "New community services", "Housing development"],
    economicFocus: "Commuter economy and local services"
  },
  "Meath West": {
    historicalFact: "Meath West includes the historically significant Hill of Tara and Trim Castle.",
    politicalTrend: "More rural and traditional than neighboring Meath East.",
    keyIssues: ["Agricultural policy", "Rural services", "Heritage preservation"],
    economicFocus: "Agriculture and heritage tourism"
  },
  "Roscommon–Galway": {
    historicalFact: "Roscommon-Galway has frequently elected independent TDs, showing strong independent streak.",
    politicalTrend: "Independent-minded with focus on local representation.",
    keyIssues: ["Rural healthcare", "Turf cutting rights", "Agricultural supports"],
    economicFocus: "Agriculture and small business"
  },
  "Sligo-Leitrim": {
    historicalFact: "Sligo-Leitrim constituency includes parts of North Roscommon and South Donegal.",
    politicalTrend: "Traditional Fianna Fáil and Fine Gael support with growing Sinn Féin presence.",
    keyIssues: ["Rural development", "Tourism infrastructure", "Healthcare services"],
    economicFocus: "Tourism, agriculture, and small business"
  },
  "Tipperary": {
    historicalFact: "Tipperary has a strong tradition of independent representation in the Dáil.",
    politicalTrend: "Independent-minded with traditional values.",
    keyIssues: ["Agricultural supports", "Rural healthcare", "Employment creation"],
    economicFocus: "Agriculture, food production, and heritage tourism"
  },
  "Waterford": {
    historicalFact: "Waterford is Ireland's oldest city with a strong industrial heritage.",
    politicalTrend: "Urban areas increasingly progressive, rural areas more traditional.",
    keyIssues: ["Job creation", "Port development", "Urban renewal"],
    economicFocus: "Manufacturing, pharmaceuticals, and tourism"
  },
  "Wexford": {
    historicalFact: "Wexford has historical significance as the site of the 1798 rebellion.",
    politicalTrend: "Traditional Fianna Fáil and Labour territory.",
    keyIssues: ["Tourism development", "Fishing industry support", "Transport links"],
    economicFocus: "Agriculture, fishing, and tourism"
  },
  "Wicklow": {
    historicalFact: "Wicklow combines Dublin commuter towns in the north with rural areas in the south.",
    politicalTrend: "Growing Green and Social Democrat support in commuter areas.",
    keyIssues: ["Housing development", "Natural heritage protection", "Transport infrastructure"],
    economicFocus: "Commuter economy, tourism, and film industry"
  }
};