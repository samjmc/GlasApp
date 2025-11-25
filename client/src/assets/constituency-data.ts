// Electoral constituency data with additional information
export interface TD {
  name: string;
  party: string;
}

export interface ConstituencyDetail {
  seats: number;
  population: number;
  urbanCenters: string;
  outgoingTDs: TD[];
}

// Using simplified data to avoid formatting issues
export const constituencyDetails: Record<string, ConstituencyDetail> = {
  "Carlow-Kilkenny": {
    seats: 5,
    population: 156164,
    urbanCenters: "Carlow, Kilkenny, Tullow, Bagenalstown",
    outgoingTDs: [
      { name: "John McGuinness", party: "Fianna Fáil" },
      { name: "Jennifer Murnane O'Connor", party: "Fianna Fáil" },
      { name: "Kathleen Funchion", party: "Sinn Féin" },
      { name: "John Paul Phelan", party: "Fine Gael" },
      { name: "Malcolm Noonan", party: "Green Party" }
    ]
  },
  "Cavan-Monaghan": {
    seats: 5,
    population: 137562,
    urbanCenters: "Cavan, Monaghan, Bailieborough, Carrickmacross",
    outgoingTDs: [
      { name: "Brendan Smith", party: "Fianna Fáil" },
      { name: "Niamh Smyth", party: "Fianna Fáil" },
      { name: "Matt Carthy", party: "Sinn Féin" },
      { name: "Pauline Tully", party: "Sinn Féin" },
      { name: "Heather Humphreys", party: "Fine Gael" }
    ]
  },
  "Clare": {
    seats: 4,
    population: 118817,
    urbanCenters: "Ennis, Shannon, Kilrush, Kilkee",
    outgoingTDs: [
      { name: "Cathal Crowe", party: "Fianna Fáil" },
      { name: "Joe Carey", party: "Fine Gael" },
      { name: "Michael McNamara", party: "Independent" },
      { name: "Violet-Anne Wynne", party: "Independent" }
    ]
  },
  "Cork East": {
    seats: 4,
    population: 125118,
    urbanCenters: "Youghal, Midleton, Fermoy, Cobh",
    outgoingTDs: [
      { name: "James O'Connor", party: "Fianna Fáil" },
      { name: "Pat Buckley", party: "Sinn Féin" },
      { name: "David Stanton", party: "Fine Gael" },
      { name: "Sean Sherlock", party: "Labour Party" }
    ]
  },
  "Cork North-Central": {
    seats: 4,
    population: 125657,
    urbanCenters: "Blackpool, Gurranabraher, Mayfield",
    outgoingTDs: [
      { name: "Padraig O'Sullivan", party: "Fianna Fáil" },
      { name: "Thomas Gould", party: "Sinn Féin" },
      { name: "Colm Burke", party: "Fine Gael" },
      { name: "Mick Barry", party: "Solidarity–PBP" }
    ]
  },
  "Cork North-West": {
    seats: 3,
    population: 88542,
    urbanCenters: "Charleville, Newmarket, Kanturk, Millstreet",
    outgoingTDs: [
      { name: "Michael Moynihan", party: "Fianna Fáil" },
      { name: "Aindrias Moynihan", party: "Fianna Fáil" },
      { name: "Michael Creed", party: "Fine Gael" }
    ]
  },
  "Cork South-Central": {
    seats: 4,
    population: 134673,
    urbanCenters: "Ballincollig, Douglas, Carrigaline",
    outgoingTDs: [
      { name: "Micheál Martin", party: "Fianna Fáil" },
      { name: "Simon Coveney", party: "Fine Gael" },
      { name: "Donnchadh Ó Laoghaire", party: "Sinn Féin" },
      { name: "Michael McGrath", party: "Fianna Fáil" }
    ]
  },
  "Cork South-West": {
    seats: 3,
    population: 82796,
    urbanCenters: "Bandon, Kinsale, Clonakilty, Skibbereen",
    outgoingTDs: [
      { name: "Christopher O'Sullivan", party: "Fianna Fáil" },
      { name: "Michael Collins", party: "Independent" },
      { name: "Holly Cairns", party: "Social Democrats" }
    ]
  },
  "Donegal": {
    seats: 5,
    population: 166321,
    urbanCenters: "Letterkenny, Buncrana, Ballybofey, Donegal Town",
    outgoingTDs: [
      { name: "Charlie McConalogue", party: "Fianna Fáil" },
      { name: "Pearse Doherty", party: "Sinn Féin" },
      { name: "Pádraig Mac Lochlainn", party: "Sinn Féin" },
      { name: "Joe McHugh", party: "Fine Gael" },
      { name: "Thomas Pringle", party: "Independent" }
    ]
  },
  "Dublin Bay North": {
    seats: 5,
    population: 160258,
    urbanCenters: "Clontarf, Raheny, Howth, Coolock, Donaghmede",
    outgoingTDs: [
      { name: "Richard Bruton", party: "Fine Gael" },
      { name: "Aodhán Ó Ríordáin", party: "Labour Party" },
      { name: "Denise Mitchell", party: "Sinn Féin" },
      { name: "Cian O'Callaghan", party: "Social Democrats" },
      { name: "Seán Haughey", party: "Fianna Fáil" }
    ]
  },
  "Dublin Bay South": {
    seats: 4,
    population: 121096,
    urbanCenters: "Sandymount, Ballsbridge, Ranelagh, Rathmines",
    outgoingTDs: [
      { name: "Ivana Bacik", party: "Labour Party" },
      { name: "Eamon Ryan", party: "Green Party" },
      { name: "Jim O'Callaghan", party: "Fianna Fáil" },
      { name: "Chris Andrews", party: "Sinn Féin" }
    ]
  },
  "Dublin Central": {
    seats: 4,
    population: 124995,
    urbanCenters: "Cabra, Phibsborough, Drumcondra, North Inner City",
    outgoingTDs: [
      { name: "Mary Lou McDonald", party: "Sinn Féin" },
      { name: "Paschal Donohoe", party: "Fine Gael" },
      { name: "Gary Gannon", party: "Social Democrats" },
      { name: "Neasa Hourigan", party: "Green Party" }
    ]
  },
  "Dublin Fingal": {
    seats: 5,
    population: 167683,
    urbanCenters: "Swords, Malahide, Balbriggan, Rush, Skerries",
    outgoingTDs: [
      { name: "Darragh O'Brien", party: "Fianna Fáil" },
      { name: "Alan Farrell", party: "Fine Gael" },
      { name: "Louise O'Reilly", party: "Sinn Féin" },
      { name: "Duncan Smith", party: "Labour Party" },
      { name: "Joe O'Brien", party: "Green Party" }
    ]
  },
  "Dublin Mid-West": {
    seats: 4,
    population: 121674,
    urbanCenters: "Lucan, Clondalkin, Palmerstown, Newcastle",
    outgoingTDs: [
      { name: "John Curran", party: "Fianna Fáil" },
      { name: "Emer Higgins", party: "Fine Gael" },
      { name: "Mark Ward", party: "Sinn Féin" },
      { name: "Gino Kenny", party: "Solidarity–PBP" }
    ]
  },
  "Dublin North-West": {
    seats: 3,
    population: 96180,
    urbanCenters: "Ballymun, Finglas, Santry, Whitehall",
    outgoingTDs: [
      { name: "Dessie Ellis", party: "Sinn Féin" },
      { name: "Róisín Shortall", party: "Social Democrats" },
      { name: "Paul McAuliffe", party: "Fianna Fáil" }
    ]
  },
  "Dublin Rathdown": {
    seats: 3,
    population: 95003,
    urbanCenters: "Dundrum, Stillorgan, Goatstown, Sandyford",
    outgoingTDs: [
      { name: "Josepha Madigan", party: "Fine Gael" },
      { name: "Catherine Martin", party: "Green Party" },
      { name: "Neale Richmond", party: "Fine Gael" }
    ]
  },
  "Dublin South-Central": {
    seats: 4,
    population: 124989,
    urbanCenters: "Crumlin, Drimnagh, Walkinstown, Inchicore",
    outgoingTDs: [
      { name: "Aengus Ó Snodaigh", party: "Sinn Féin" },
      { name: "Bríd Smith", party: "Solidarity–PBP" },
      { name: "Patrick Costello", party: "Green Party" },
      { name: "Joan Collins", party: "Right to Change" }
    ]
  },
  "Dublin South-West": {
    seats: 5,
    population: 164054,
    urbanCenters: "Tallaght, Templeogue, Rathfarnham, Firhouse",
    outgoingTDs: [
      { name: "John Lahart", party: "Fianna Fáil" },
      { name: "Seán Crowe", party: "Sinn Féin" },
      { name: "Colm Brophy", party: "Fine Gael" },
      { name: "Paul Murphy", party: "RISE" },
      { name: "Francis Noel Duffy", party: "Green Party" }
    ]
  },
  "Dublin West": {
    seats: 4,
    population: 125597,
    urbanCenters: "Blanchardstown, Castleknock, Ongar, Mulhuddart",
    outgoingTDs: [
      { name: "Leo Varadkar", party: "Fine Gael" },
      { name: "Jack Chambers", party: "Fianna Fáil" },
      { name: "Paul Donnelly", party: "Sinn Féin" },
      { name: "Roderic O'Gorman", party: "Green Party" }
    ]
  },
  "Dún Laoghaire": {
    seats: 4,
    population: 126805,
    urbanCenters: "Dún Laoghaire, Blackrock, Dalkey, Killiney",
    outgoingTDs: [
      { name: "Jennifer Carroll MacNeill", party: "Fine Gael" },
      { name: "Cormac Devlin", party: "Fianna Fáil" },
      { name: "Ossian Smyth", party: "Green Party" },
      { name: "Richard Boyd Barrett", party: "Solidarity–PBP" }
    ]
  },
  "Galway East": {
    seats: 3,
    population: 93287,
    urbanCenters: "Tuam, Ballinasloe, Loughrea, Athenry",
    outgoingTDs: [
      { name: "Seán Canney", party: "Independent" },
      { name: "Anne Rabbitte", party: "Fianna Fáil" },
      { name: "Ciarán Cannon", party: "Fine Gael" }
    ]
  },
  "Galway West": {
    seats: 5,
    population: 167041,
    urbanCenters: "Galway City, Salthill, Barna, Oranmore",
    outgoingTDs: [
      { name: "Éamon Ó Cuív", party: "Fianna Fáil" },
      { name: "Noel Grealish", party: "Independent" },
      { name: "Hildegarde Naughton", party: "Fine Gael" },
      { name: "Mairéad Farrell", party: "Sinn Féin" },
      { name: "Catherine Connolly", party: "Independent" }
    ]
  },
  "Kerry": {
    seats: 5,
    population: 147554,
    urbanCenters: "Tralee, Killarney, Listowel, Kenmare",
    outgoingTDs: [
      { name: "Norma Foley", party: "Fianna Fáil" },
      { name: "Pa Daly", party: "Sinn Féin" },
      { name: "Brendan Griffin", party: "Fine Gael" },
      { name: "Michael Healy-Rae", party: "Independent" },
      { name: "Danny Healy-Rae", party: "Independent" }
    ]
  },
  "Kildare North": {
    seats: 4,
    population: 125094,
    urbanCenters: "Naas, Celbridge, Leixlip, Maynooth, Kilcock, Clane",
    outgoingTDs: [
      { name: "James Lawless", party: "Fianna Fáil" },
      { name: "Bernard Durkan", party: "Fine Gael" },
      { name: "Réada Cronin", party: "Sinn Féin" },
      { name: "Catherine Murphy", party: "Social Democrats" }
    ]
  },
  "Kildare South": {
    seats: 4,
    population: 105186,
    urbanCenters: "Newbridge, Kildare, Athy, Monasterevin",
    outgoingTDs: [
      { name: "Seán Ó Fearghaíl", party: "Fianna Fáil" },
      { name: "Martin Heydon", party: "Fine Gael" },
      { name: "Patricia Ryan", party: "Sinn Féin" },
      { name: "Cathal Berry", party: "Independent" }
    ]
  },
  "Laois-Offaly": {
    seats: 5,
    population: 162658,
    urbanCenters: "Portlaoise, Tullamore, Birr, Portarlington",
    outgoingTDs: [
      { name: "Seán Fleming", party: "Fianna Fáil" },
      { name: "Barry Cowen", party: "Fianna Fáil" },
      { name: "Charlie Flanagan", party: "Fine Gael" },
      { name: "Brian Stanley", party: "Sinn Féin" },
      { name: "Carol Nolan", party: "Independent" }
    ]
  },
  "Limerick City": {
    seats: 4,
    population: 116681,
    urbanCenters: "Limerick City, Castletroy, Dooradoyle",
    outgoingTDs: [
      { name: "Willie O'Dea", party: "Fianna Fáil" },
      { name: "Brian Leddin", party: "Green Party" },
      { name: "Maurice Quinlivan", party: "Sinn Féin" },
      { name: "Kieran O'Donnell", party: "Fine Gael" }
    ]
  },
  "Limerick County": {
    seats: 3,
    population: 89878,
    urbanCenters: "Newcastle West, Abbeyfeale, Kilmallock",
    outgoingTDs: [
      { name: "Niall Collins", party: "Fianna Fáil" },
      { name: "Patrick O'Donovan", party: "Fine Gael" },
      { name: "Richard O'Donoghue", party: "Independent" }
    ]
  },
  "Longford-Westmeath": {
    seats: 4,
    population: 127704,
    urbanCenters: "Athlone, Mullingar, Longford, Moate",
    outgoingTDs: [
      { name: "Joe Flaherty", party: "Fianna Fáil" },
      { name: "Peter Burke", party: "Fine Gael" },
      { name: "Robert Troy", party: "Fianna Fáil" },
      { name: "Sorca Clarke", party: "Sinn Féin" }
    ]
  },
  "Louth": {
    seats: 5,
    population: 159053,
    urbanCenters: "Dundalk, Drogheda, Ardee, Clogherhead",
    outgoingTDs: [
      { name: "Fergus O'Dowd", party: "Fine Gael" },
      { name: "Imelda Munster", party: "Sinn Féin" },
      { name: "Ruairí Ó Murchú", party: "Sinn Féin" },
      { name: "Ged Nash", party: "Labour Party" },
      { name: "Peter Fitzpatrick", party: "Independent" }
    ]
  },
  "Mayo": {
    seats: 4,
    population: 130638,
    urbanCenters: "Castlebar, Ballina, Westport, Claremorris",
    outgoingTDs: [
      { name: "Dara Calleary", party: "Fianna Fáil" },
      { name: "Michael Ring", party: "Fine Gael" },
      { name: "Alan Dillon", party: "Fine Gael" },
      { name: "Rose Conway-Walsh", party: "Sinn Féin" }
    ]
  },
  "Meath East": {
    seats: 3,
    population: 93617,
    urbanCenters: "Ashbourne, Ratoath, Dunshaughlin, Dunboyne",
    outgoingTDs: [
      { name: "Thomas Byrne", party: "Fianna Fáil" },
      { name: "Helen McEntee", party: "Fine Gael" },
      { name: "Darren O'Rourke", party: "Sinn Féin" }
    ]
  },
  "Meath West": {
    seats: 3,
    population: 89688,
    urbanCenters: "Navan, Trim, Kells, Athboy",
    outgoingTDs: [
      { name: "Johnny Guirke", party: "Sinn Féin" },
      { name: "Peadar Tóibín", party: "Aontú" },
      { name: "Damien English", party: "Fine Gael" }
    ]
  },
  "Roscommon-Galway": {
    seats: 3,
    population: 85338,
    urbanCenters: "Roscommon, Ballaghaderreen, Boyle, Castlerea",
    outgoingTDs: [
      { name: "Michael Fitzmaurice", party: "Independent" },
      { name: "Denis Naughten", party: "Independent" },
      { name: "Claire Kerrane", party: "Sinn Féin" }
    ]
  },
  "Sligo-Leitrim": {
    seats: 4,
    population: 130476,
    urbanCenters: "Sligo, Carrick-on-Shannon, Ballymote, Manorhamilton",
    outgoingTDs: [
      { name: "Marc MacSharry", party: "Independent" },
      { name: "Frank Feighan", party: "Fine Gael" },
      { name: "Martin Kenny", party: "Sinn Féin" },
      { name: "Marian Harkin", party: "Independent" }
    ]
  },
  "Tipperary": {
    seats: 5,
    population: 160441,
    urbanCenters: "Clonmel, Nenagh, Thurles, Roscrea, Tipperary Town",
    outgoingTDs: [
      { name: "Jackie Cahill", party: "Fianna Fáil" },
      { name: "Michael Lowry", party: "Independent" },
      { name: "Mattie McGrath", party: "Independent" },
      { name: "Alan Kelly", party: "Labour Party" },
      { name: "Martin Browne", party: "Sinn Féin" }
    ]
  },
  "Waterford": {
    seats: 4,
    population: 119782,
    urbanCenters: "Waterford City, Tramore, Dungarvan, Lismore",
    outgoingTDs: [
      { name: "Mary Butler", party: "Fianna Fáil" },
      { name: "David Cullinane", party: "Sinn Féin" },
      { name: "Matt Shanahan", party: "Independent" },
      { name: "Marc Ó Cathasaigh", party: "Green Party" }
    ]
  },
  "Wexford": {
    seats: 5,
    population: 149605,
    urbanCenters: "Wexford, Enniscorthy, New Ross, Gorey",
    outgoingTDs: [
      { name: "James Browne", party: "Fianna Fáil" },
      { name: "Paul Kehoe", party: "Fine Gael" },
      { name: "Johnny Mythen", party: "Sinn Féin" },
      { name: "Brendan Howlin", party: "Labour Party" },
      { name: "Verona Murphy", party: "Independent" }
    ]
  },
  "Wicklow": {
    seats: 5,
    population: 142332,
    urbanCenters: "Bray, Greystones, Arklow, Wicklow Town",
    outgoingTDs: [
      { name: "Stephen Donnelly", party: "Fianna Fáil" },
      { name: "Simon Harris", party: "Fine Gael" },
      { name: "John Brady", party: "Sinn Féin" },
      { name: "Steven Matthews", party: "Green Party" },
      { name: "Jennifer Whitmore", party: "Social Democrats" }
    ]
  }
};