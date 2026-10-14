// One real capture from aviationweather.gov (2026-10-14 ~06:45Z), fetched once; tests never call the live API.
// GET /api/data/metar?ids=KORD,KJFK,PHNL&format=json   and   /api/data/taf?ids=KORD,KJFK&format=json
export const REAL_METAR: unknown = [
  {
    "icaoId": "KJFK",
    "receiptTime": "2026-10-14T05:57:06.912Z",
    "obsTime": 1791957060,
    "reportTime": "2026-10-14T06:00:00.000Z",
    "temp": 18.9,
    "dewp": 16.7,
    "wdir": 220,
    "wspd": 13,
    "visib": "10+",
    "altim": 1011.3,
    "slp": 1011,
    "qcField": 4,
    "presTend": -0.7,
    "maxT": 20,
    "minT": 18.9,
    "metarType": "METAR",
    "rawOb": "METAR KJFK 140551Z 22013KT 10SM FEW250 19/17 A2986 RMK AO2 SLP110 T01890167 10200 20189 58007",
    "lat": 40.6392,
    "lon": -73.7639,
    "elev": 3,
    "name": "New York/JF Kennedy Intl, NY, US",
    "cover": "FEW",
    "clouds": [
      {
        "cover": "FEW",
        "base": 25000
      }
    ],
    "fltCat": "VFR"
  },
  {
    "icaoId": "KORD",
    "receiptTime": "2026-10-14T06:40:05.144Z",
    "obsTime": 1791959760,
    "reportTime": "2026-10-14T06:36:00.000Z",
    "temp": 18.3,
    "dewp": 17.2,
    "wdir": 0,
    "wspd": 0,
    "visib": 4,
    "altim": 1014,
    "qcField": 12,
    "wxString": "-RA BR",
    "precip": 0.03,
    "metarType": "SPECI",
    "rawOb": "SPECI KORD 140636Z 00000KT 4SM -RA BR FEW035 OVC046 18/17 A2994 RMK AO2 RAB20 P0003 T01830172 $",
    "lat": 41.9602,
    "lon": -87.9316,
    "elev": 202,
    "name": "Chicago/O'Hare Intl, IL, US",
    "cover": "OVC",
    "clouds": [
      {
        "cover": "FEW",
        "base": 3500
      },
      {
        "cover": "OVC",
        "base": 4600
      }
    ],
    "fltCat": "MVFR"
  },
  {
    "icaoId": "PHNL",
    "receiptTime": "2026-10-14T05:58:17.584Z",
    "obsTime": 1791957180,
    "reportTime": "2026-10-14T06:00:00.000Z",
    "temp": 26.1,
    "dewp": 19.4,
    "wdir": 20,
    "wspd": 6,
    "visib": "10+",
    "altim": 1015.3,
    "slp": 1015,
    "qcField": 12,
    "presTend": 2,
    "maxT": 30.6,
    "minT": 25.6,
    "metarType": "METAR",
    "rawOb": "METAR PHNL 140553Z 02006KT 10SM FEW025 26/19 A2998 RMK AO2 SLP150 T02610194 10306 20256 53020 $",
    "lat": 21.315,
    "lon": -157.924,
    "elev": 2,
    "name": "Honolulu Intl, HI, US",
    "cover": "FEW",
    "clouds": [
      {
        "cover": "FEW",
        "base": 2500
      }
    ],
    "fltCat": "VFR"
  }
];

export const REAL_TAF: unknown = [
  {
    "icaoId": "KJFK",
    "dbPopTime": "2026-10-14T05:44:36.460Z",
    "bulletinTime": "2026-10-14T05:44:00.000Z",
    "issueTime": "2026-10-14T05:44:00.000Z",
    "validTimeFrom": 1791957600,
    "validTimeTo": 1792065600,
    "rawTAF": "TAF KJFK 140544Z 1406/1512 22008KT P6SM FEW250 FM141000 24008KT P6SM FEW250 FM141400 27011G18KT P6SM SCT040 SCT250 FM142000 28011G18KT P6SM FEW050 BKN090 FM150000 34009KT P6SM BKN080 FM150500 36010KT P6SM FEW250",
    "mostRecent": 1,
    "remarks": "",
    "lat": 40.63916,
    "lon": -73.76394,
    "elev": 3,
    "prior": 0,
    "name": "New York/JF Kennedy Intl",
    "fcsts": [
      {
        "timeFrom": 1791957600,
        "timeTo": 1791972000,
        "timeBec": null,
        "fcstChange": null,
        "probability": null,
        "wdir": 220,
        "wspd": 8,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "FEW",
            "base": 25000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1791972000,
        "timeTo": 1791986400,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 240,
        "wspd": 8,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "FEW",
            "base": 25000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1791986400,
        "timeTo": 1792008000,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 270,
        "wspd": 11,
        "wgst": 18,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "SCT",
            "base": 4000,
            "type": null
          },
          {
            "cover": "SCT",
            "base": 25000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1792008000,
        "timeTo": 1792022400,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 280,
        "wspd": 11,
        "wgst": 18,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "FEW",
            "base": 5000,
            "type": null
          },
          {
            "cover": "BKN",
            "base": 9000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1792022400,
        "timeTo": 1792040400,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 340,
        "wspd": 9,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "BKN",
            "base": 8000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1792040400,
        "timeTo": 1792065600,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 360,
        "wspd": 10,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "FEW",
            "base": 25000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      }
    ]
  },
  {
    "icaoId": "KORD",
    "dbPopTime": "2026-10-14T05:31:01.333Z",
    "bulletinTime": "2026-10-14T05:30:00.000Z",
    "issueTime": "2026-10-14T05:30:00.000Z",
    "validTimeFrom": 1791957600,
    "validTimeTo": 1792065600,
    "rawTAF": "TAF KORD 140530Z 1406/1512 04006KT P6SM VCSH SCT030 OVC040 TEMPO 1406/1408 4SM -TSRA BR SCT020 BKN030CB FM141000 03011KT P6SM SCT012 BKN020 PROB30 1413/1417 2SM -RADZ SCT008 BKN010 FM150600 10010KT P6SM BKN025 OVC035",
    "mostRecent": 1,
    "remarks": "",
    "lat": 41.96017,
    "lon": -87.93161,
    "elev": 202,
    "prior": 0,
    "name": "Chicago/O'Hare Intl",
    "fcsts": [
      {
        "timeFrom": 1791957600,
        "timeTo": 1791972000,
        "timeBec": null,
        "fcstChange": null,
        "probability": null,
        "wdir": 40,
        "wspd": 6,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": "VCSH",
        "notDecoded": null,
        "clouds": [
          {
            "cover": "SCT",
            "base": 3000,
            "type": null
          },
          {
            "cover": "OVC",
            "base": 4000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1791957600,
        "timeTo": 1791964800,
        "timeBec": null,
        "fcstChange": "TEMPO",
        "probability": null,
        "wdir": null,
        "wspd": null,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": 4,
        "altim": null,
        "vertVis": null,
        "wxString": "-TSRA BR",
        "notDecoded": null,
        "clouds": [
          {
            "cover": "SCT",
            "base": 2000,
            "type": null
          },
          {
            "cover": "BKN",
            "base": 3000,
            "type": "CB"
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1791972000,
        "timeTo": 1792044000,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 30,
        "wspd": 11,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "SCT",
            "base": 1200,
            "type": null
          },
          {
            "cover": "BKN",
            "base": 2000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1791982800,
        "timeTo": 1791997200,
        "timeBec": null,
        "fcstChange": "PROB",
        "probability": 30,
        "wdir": null,
        "wspd": null,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": 2,
        "altim": null,
        "vertVis": null,
        "wxString": "-RA -DZ",
        "notDecoded": null,
        "clouds": [
          {
            "cover": "SCT",
            "base": 800,
            "type": null
          },
          {
            "cover": "BKN",
            "base": 1000,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      },
      {
        "timeFrom": 1792044000,
        "timeTo": 1792065600,
        "timeBec": null,
        "fcstChange": "FM",
        "probability": null,
        "wdir": 100,
        "wspd": 10,
        "wgst": null,
        "wshearHgt": null,
        "wshearDir": null,
        "wshearSpd": null,
        "visib": "6+",
        "altim": null,
        "vertVis": null,
        "wxString": null,
        "notDecoded": null,
        "clouds": [
          {
            "cover": "BKN",
            "base": 2500,
            "type": null
          },
          {
            "cover": "OVC",
            "base": 3500,
            "type": null
          }
        ],
        "icgTurb": [],
        "temp": []
      }
    ]
  }
];
