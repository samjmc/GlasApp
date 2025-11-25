// Simplified constituency data for the electoral map
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

export const constituencyData: Record<string, ConstituencyDetail> = {
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
  }
};