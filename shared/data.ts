import type { PoliticalParty } from "./schema";

// Political parties by country
/** Political parties by country. */
export const politicalParties: PoliticalParty[] = [
  // Ireland
  {
    id: "ie-green",
    name: "Green Party",
    country: "ireland",
    economic: -4.0,
    social: -5.2,
    description: "Irish political party focused on environmental protection, social justice, and grassroots democracy. Key policies: 7% annual carbon emissions reduction, increased cycling infrastructure, renewable energy transition, and just transition for workers in carbon-intensive industries.",
    color: "#00C000"
  },
  {
    id: "ie-sd",
    name: "Social Democrats",
    country: "ireland",
    economic: -3.5,
    social: -4.0,
    description: "Center-left party advocating for progressive taxation, public healthcare, and housing reform. Key policies: Vienna Model public housing, universal single-tier healthcare (Sláintecare), affordable public childcare, and investment in public transport.",
    color: "#752F8B"
  },
  {
    id: "ie-labour",
    name: "Labour Party",
    country: "ireland",
    economic: -5.0,
    social: -2.0,
    description: "Democratic socialist party focusing on workers' rights, public services, and economic equality. Key policies: Living wage implementation (€12.30/hour), 80,000 social housing units, universal public childcare, and stronger collective bargaining rights.",
    color: "#CC0000"
  },
  {
    id: "ie-ff",
    name: "Fianna Fáil",
    country: "ireland",
    economic: 0.5,
    social: 2.0,
    description: "Centrist party with republican heritage, balancing market economics with state intervention. Key policies: Building 50,000 social housing units, reducing hospital waiting lists, economic stability with moderate government intervention, and rural regeneration.",
    color: "#008800"
  },
  {
    id: "ie-fg",
    name: "Fine Gael",
    country: "ireland",
    economic: 3.0,
    social: 1.0,
    description: "Center-right party combining fiscal conservatism with social liberalism. Key policies: Tax stability, National Broadband Plan implementation, first-time buyer housing supports, and reduced business regulation.",
    color: "#0099FF"
  },
  {
    id: "ie-aontu",
    name: "Aontú",
    country: "ireland",
    economic: -2.0,
    social: 5.0,
    description: "Socially conservative and economically center-left party combining traditional values with economic populism. Key policies: Review of abortion legislation, protection of community hospitals, opposition to vulture funds in housing market, and Irish unity.",
    color: "#D9681D"
  },
  {
    id: "ie-pbp",
    name: "People Before Profit",
    country: "ireland",
    economic: -8.0,
    social: -5.0,
    description: "Socialist party with strong anti-capitalist policies and socially progressive stance. Key policies: Wealth tax on millionaires, eviction bans and rent controls, public ownership of energy infrastructure, and free public transport.",
    color: "#8C1414"
  },
  {
    id: "ie-independent-ireland",
    name: "Independent Ireland",
    country: "ireland",
    economic: 3.0,
    social: 6.0,
    description: "Center-right, socially conservative party focused on national sovereignty and traditional values. Key policies: Opposition to EU integration, strengthening Irish neutrality, limiting immigration, and promoting traditional family values.",
    color: "#336699"
  },
  {
    id: "ie-irish-freedom",
    name: "Irish Freedom Party",
    country: "ireland",
    economic: 7.0, 
    social: 9.0,
    description: "Right-wing nationalist party advocating for Irish sovereignty, economic liberalism, and socially conservative policies. Key policies: Irexit (Irish exit from EU), strict immigration control, promotion of traditional values, and economic deregulation.",
    color: "#0A3161"
  },
  {
    id: "ie-sf",
    name: "Sinn Féin",
    country: "ireland",
    economic: -5.0,
    social: -2.0,
    description: "Left-wing republican party with strong focus on Irish unity and wealth redistribution. Key policies: 100,000 public homes on public land, wealth tax on assets over €1 million, all-Ireland universal healthcare system, and border poll on Irish unification.",
    color: "#326760"
  },
  
  // UK
  {
    id: "uk-labour",
    name: "Labour Party",
    country: "uk",
    economic: -4.0,
    social: -1.0,
    description: "Center-left party focused on social justice, workers' rights and public services.",
    color: "#E4003B"
  },
  {
    id: "uk-conservative",
    name: "Conservative Party",
    country: "uk",
    economic: 5.0,
    social: 4.0,
    description: "Center-right party advocating free markets, traditional values, and national sovereignty.",
    color: "#0087DC"
  },
  {
    id: "uk-libdem",
    name: "Liberal Democrats",
    country: "uk",
    economic: -2.0,
    social: -6.0,
    description: "Centrist to center-left party emphasizing civil liberties, social justice, and internationalism.",
    color: "#FAA61A"
  },
  {
    id: "uk-green",
    name: "Green Party",
    country: "uk",
    economic: -5.0,
    social: -6.0,
    description: "Left-wing party focused on environmental policies, social justice, and pacifism.",
    color: "#6AB023"
  },
  
  // US
  {
    id: "us-democrat",
    name: "Democratic Party",
    country: "us",
    economic: -2.5,
    social: -2.0,
    description: "Center-left party supporting progressive taxation, social programs, and civil liberties.",
    color: "#3333FF"
  },
  {
    id: "us-republican",
    name: "Republican Party",
    country: "us",
    economic: 6.0,
    social: 5.0,
    description: "Center-right to right-wing party advocating free markets, traditional values, and limited government.",
    color: "#E81B23"
  },
  {
    id: "us-libertarian",
    name: "Libertarian Party",
    country: "us",
    economic: 8.0,
    social: -7.0,
    description: "Right-wing economically, socially liberal party favoring minimal government in all spheres.",
    color: "#FED105"
  },
  {
    id: "us-green",
    name: "Green Party",
    country: "us",
    economic: -6.0,
    social: -6.0,
    description: "Left-wing party focused on environmentalism, social justice, and grassroots democracy.",
    color: "#17AA5C"
  },
  
  // France
  {
    id: "fr-lr",
    name: "Les Républicains",
    country: "france",
    economic: 4.5,
    social: 5.0,
    description: "Center-right party supporting free markets, traditional values, and national identity.",
    color: "#0066CC"
  },
  {
    id: "fr-ps",
    name: "Parti Socialiste",
    country: "france",
    economic: -3.5,
    social: -1.0,
    description: "Center-left party advocating social democracy, worker protections, and public services.",
    color: "#FF3366"
  },
  {
    id: "fr-lrem",
    name: "La République En Marche",
    country: "france",
    economic: 2.0,
    social: -2.0,
    description: "Centrist party combining economic liberalism with progressive social policies.",
    color: "#FFEB00"
  },
  {
    id: "fr-lfi",
    name: "La France Insoumise",
    country: "france",
    economic: -7.0,
    social: -4.0,
    description: "Left-wing populist party opposing austerity and advocating wealth redistribution.",
    color: "#C9462C"
  },
  
  // Germany
  {
    id: "de-cdu",
    name: "CDU/CSU",
    country: "germany",
    economic: 4.0,
    social: 3.0,
    description: "Center-right Christian democratic party emphasizing social market economy, traditional values, and European integration.",
    color: "#000000"
  },
  {
    id: "de-spd",
    name: "Social Democratic Party",
    country: "germany",
    economic: -3.0,
    social: -1.5,
    description: "Center-left party advocating for social justice, workers' rights, and strong welfare systems.",
    color: "#EB001F"
  },
  {
    id: "de-greens",
    name: "Alliance 90/The Greens",
    country: "germany",
    economic: -4.0,
    social: -4.5,
    description: "Left-wing environmentalist party focusing on climate action, social justice, and progressive values.",
    color: "#46962b"
  },
  {
    id: "de-fdp",
    name: "Free Democratic Party",
    country: "germany",
    economic: 6.0,
    social: -4.0,
    description: "Classical liberal party supporting free markets, civil liberties, and minimal government intervention.",
    color: "#FFED00"
  },
  {
    id: "de-afd",
    name: "Alternative for Germany",
    country: "germany",
    economic: 3.5,
    social: 7.0,
    description: "Right-wing populist party advocating for stricter immigration policies and Euroscepticism.",
    color: "#009ee0"
  },
  
  // Canada
  {
    id: "ca-liberal",
    name: "Liberal Party",
    country: "canada",
    economic: -2.0,
    social: -3.0,
    description: "Centrist to center-left party balancing social progressivism with economic pragmatism.",
    color: "#D71920"
  },
  {
    id: "ca-conservative",
    name: "Conservative Party",
    country: "canada",
    economic: 5.0,
    social: 3.5,
    description: "Center-right party supporting free markets, fiscal conservatism, and traditional values.",
    color: "#0C499C"
  },
  {
    id: "ca-ndp",
    name: "New Democratic Party",
    country: "canada",
    economic: -5.5,
    social: -4.5,
    description: "Social democratic party advocating for stronger public services, environmental protection, and workers' rights.",
    color: "#F37021"
  },
  {
    id: "ca-green",
    name: "Green Party",
    country: "canada",
    economic: -4.0,
    social: -5.0,
    description: "Environmentalist party focusing on sustainability, social justice, and participatory democracy.",
    color: "#3D9B35"
  },
  {
    id: "ca-bloc",
    name: "Bloc Québécois",
    country: "canada",
    economic: -3.0,
    social: 1.0,
    description: "Quebec nationalist party supporting Quebec sovereignty while advocating center-left social policies.",
    color: "#33B2CC"
  },
  
  // Australia
  {
    id: "au-labor",
    name: "Australian Labor Party",
    country: "australia",
    economic: -3.5,
    social: -2.0,
    description: "Center-left party advocating for workers' rights, public services, and social equality.",
    color: "#E13940"
  },
  {
    id: "au-liberal",
    name: "Liberal Party",
    country: "australia",
    economic: 4.5,
    social: 3.0,
    description: "Center-right party supporting free markets, individual liberty, and traditional institutions.",
    color: "#0047AB"
  },
  {
    id: "au-nationals",
    name: "National Party",
    country: "australia",
    economic: 3.5,
    social: 4.5,
    description: "Rural-focused conservative party representing agricultural interests and rural communities.",
    color: "#006644"
  },
  {
    id: "au-greens",
    name: "Australian Greens",
    country: "australia",
    economic: -5.0,
    social: -6.0,
    description: "Left-wing environmentalist party focused on climate action, social justice, and participatory democracy.",
    color: "#10C25B"
  },
  
  // Spain
  {
    id: "es-psoe",
    name: "Spanish Socialist Workers' Party",
    country: "spain",
    economic: -4.0,
    social: -3.0,
    description: "Center-left social democratic party advocating for public services, equality, and progressive reforms.",
    color: "#E30613"
  },
  {
    id: "es-pp",
    name: "People's Party",
    country: "spain",
    economic: 4.5,
    social: 4.0,
    description: "Center-right conservative party supporting economic liberalism, traditional values, and national unity.",
    color: "#0055A7"
  },
  {
    id: "es-vox",
    name: "Vox",
    country: "spain",
    economic: 6.0,
    social: 7.5,
    description: "Right-wing to far-right party advocating for Spanish nationalism, traditional values, and anti-immigration policies.",
    color: "#5AC035"
  },
  {
    id: "es-podemos",
    name: "Podemos",
    country: "spain",
    economic: -7.0,
    social: -5.0,
    description: "Left-wing populist party advocating for anti-austerity policies, direct democracy, and wealth redistribution.",
    color: "#612D62"
  },
  
  // Italy
  {
    id: "it-pd",
    name: "Democratic Party",
    country: "italy",
    economic: -3.5,
    social: -2.0,
    description: "Center-left party supporting social democracy, progressive values, and European integration.",
    color: "#FF0000"
  },
  {
    id: "it-lega",
    name: "Lega",
    country: "italy",
    economic: 3.0,
    social: 6.5,
    description: "Right-wing populist party advocating for stricter immigration policies, Euroscepticism, and Italian nationalism.",
    color: "#008000"
  },
  {
    id: "it-fdi",
    name: "Brothers of Italy",
    country: "italy",
    economic: 5.0,
    social: 7.0,
    description: "Right-wing to far-right party emphasizing traditional values, national sovereignty, and law and order.",
    color: "#0066CC"
  },
  {
    id: "it-m5s",
    name: "Five Star Movement",
    country: "italy",
    economic: -2.0,
    social: -1.0,
    description: "Populist party with a mixed platform of environmentalism, anti-establishment positions, and direct democracy.",
    color: "#FFCC00"
  },
  
  // Japan
  {
    id: "jp-ldp",
    name: "Liberal Democratic Party",
    country: "japan",
    economic: 5.0,
    social: 5.5,
    description: "Center-right conservative party supporting free market economics, traditional values, and strong national defense.",
    color: "#B22222"
  },
  {
    id: "jp-cdp",
    name: "Constitutional Democratic Party",
    country: "japan",
    economic: -3.0,
    social: -2.5,
    description: "Center-left party advocating for social welfare, pacifism, and constitutional principles.",
    color: "#4169E1"
  },
  {
    id: "jp-komeito",
    name: "Komeito",
    country: "japan",
    economic: 2.0,
    social: 3.0,
    description: "Centrist Buddhist-inspired party emphasizing welfare policies and pacifist foreign policy.",
    color: "#32CD32"
  },
  {
    id: "jp-jcp",
    name: "Japanese Communist Party",
    country: "japan",
    economic: -8.0,
    social: -4.0,
    description: "Left-wing party advocating for socialism, workers' rights, and opposition to militarism.",
    color: "#FF0000"
  }
];
