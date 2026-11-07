/**
 * What the airport summary shows (round 174, John 2026-11-07: "The airport summary should be when you
 * select an airport or hold to select it", with public transit, hours and rental car facilities).
 * Hand-checked against each airport's own site (or its transit agency's) on `checked`; null means we
 * couldn't confirm it, and the sheet says so instead of guessing. Later this moves to the schedule DB.
 */
export interface TransitLine {
  /** As riders know it: "DART Orange Line". */
  name: string;
  /** Where you catch it and where it goes: "Terminal A, to downtown Dallas". */
  detail: string;
}

export interface AirportInfo {
  transit: TransitLine[] | null;
  hours: string | null;
  rentalCars: string | null;
  /** "YYYY-MM-DD" the facts were checked. */
  checked: string;
}

export const AIRPORT_INFO: Readonly<Record<string, AirportInfo>> = {
  ATL: {
    transit: [
      { name: 'MARTA Red and Gold lines', detail: 'Airport station, west end of Domestic Terminal' },
      { name: 'ATL SkyTrain', detail: 'Free, 24 hours, links terminal to Rental Car Center' },
    ],
    hours: 'Terminals open to travelers and greeters only',
    rentalCars: 'Rental Car Center, by SkyTrain from west end of Domestic Terminal',
    checked: '2026-11-07',
  },
  BNA: {
    transit: [{ name: 'WeGo Route 18 Airport', detail: 'Terminal Garage 2 level 1, to downtown WeGo Central' }],
    hours: 'TSA checkpoint opens daily at 3:30 a.m.',
    rentalCars: 'Counters on terminal level 1; walk to cars at Terminal Garage 1',
    checked: '2026-11-07',
  },
  CLT: {
    transit: [
      { name: 'CATS Sprinter', detail: 'To Charlotte Transportation Center, uptown' },
      { name: 'CATS Route 60', detail: 'To Blue Line Tyvola station' },
    ],
    hours: 'TSA checkpoints closed about 10:45 p.m. to 3:45 a.m.',
    rentalCars: 'Counters on Level 2 of Hourly Deck, walk from baggage claim',
    checked: '2026-11-07',
  },
  DAL: {
    transit: [
      { name: 'DART Route 5 Love Link', detail: 'Lower level outside baggage claim, to Inwood/Love Field' },
      { name: 'DART Green and Orange lines', detail: 'Inwood/Love Field station, to downtown Dallas' },
    ],
    hours: null,
    rentalCars: 'Counters by baggage claim; company shuttles from lower level',
    checked: '2026-11-07',
  },
  DEN: {
    transit: [{ name: 'RTD A Line', detail: 'Transit Center at south end of terminal, to Union Station' }],
    hours: null,
    rentalCars: 'Company shuttles to on-airport lots from Level 5, Island 4',
    checked: '2026-11-07',
  },
  DFW: {
    transit: [
      { name: 'DART Orange Line', detail: 'Terminal A, to downtown Dallas' },
      { name: 'DART Silver Line', detail: 'Terminal B, to Addison, Richardson and Plano' },
      { name: 'TEXRail', detail: 'Terminal B, to downtown Fort Worth' },
    ],
    hours: null,
    rentalCars: 'Rental Car Center, by 24-hour shuttle from terminal lower level',
    checked: '2026-11-07',
  },
  LAX: {
    transit: [
      { name: 'Metro C and K lines', detail: 'Free shuttle to LAX/Metro Transit Center' },
      { name: 'LAX FlyAway', detail: 'Arrivals level, to Union Station or Van Nuys' },
    ],
    hours: null,
    rentalCars: 'LAX Rental Car Center, by free shuttle from the terminals',
    checked: '2026-11-07',
  },
  LGA: {
    transit: [
      { name: 'Q70 LaGuardia Link', detail: 'Free, Terminals B and C, to subway and LIRR' },
      { name: 'M60-SBS', detail: 'All terminals, to upper Manhattan' },
    ],
    hours: null,
    rentalCars: 'Free shuttle from each terminal to the rental car center',
    checked: '2026-11-07',
  },
  MIA: {
    transit: [
      { name: 'MIA Mover', detail: 'Level 3 between Dolphin and Flamingo garages' },
      { name: 'Metrorail Orange Line', detail: 'Via MIA Mover, to downtown Miami' },
      { name: 'Tri-Rail', detail: 'Via MIA Mover to Miami Central Station' },
      { name: 'Metrobus 150', detail: 'Miami Beach Airport Express' },
    ],
    hours: 'TSA Checkpoint 9, South Terminal, open 24 hours',
    rentalCars: 'MIA Rental Car Center, by MIA Mover from Level 3',
    checked: '2026-11-07',
  },
  ORD: {
    transit: [
      { name: 'CTA Blue Line', detail: 'Under garage via T1 to T3 tunnels, 24 hours, to city' },
      { name: 'Metra North Central Service', detail: 'ATS to Multi-Modal Facility, weekdays to Union Station' },
      { name: 'Pace 250 and 330', detail: 'Multi-Modal Facility, bays 8 and 9' },
    ],
    hours: 'TSA Checkpoint 10, Terminal 5, open 24 hours',
    rentalCars: 'Multi-Modal Facility, by 24-hour ATS train from terminals',
    checked: '2026-11-07',
  },
  PHX: {
    transit: [
      { name: 'PHX Sky Train', detail: 'Free, 24 hours, Terminals 3 and 4 to 44th St station' },
      { name: 'Valley Metro Rail', detail: '44th St station, to Phoenix, Tempe and Mesa' },
    ],
    hours: 'At least one TSA checkpoint open 24 hours per terminal',
    rentalCars: 'Rental Car Center, by PHX Sky Train from the terminals',
    checked: '2026-11-07',
  },
  SEA: {
    transit: [{ name: 'Sound Transit 1 Line', detail: 'SeaTac/Airport station via Skybridge 6, to downtown' }],
    hours: 'TSA Checkpoint 4 open 24 hours',
    rentalCars: 'Rental Car Facility, by 24-hour shuttle from baggage claim ends',
    checked: '2026-11-07',
  },
};

export function airportInfo(code: string, table: Readonly<Record<string, AirportInfo>> = AIRPORT_INFO): AirportInfo | null {
  return table[code] ?? null;
}

/** "Nov 7, 2026" for the sheet's footer. */
export function checkedText(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return month && d ? `${month} ${d}, ${y}` : date;
}
