// Recorded-shape FAA NAS XML fixture (ground stop/GDP entries follow the documented format; rest captured 2026-10-14).
export default `<?xml version="1.0" encoding="UTF-8"?>
<AIRPORT_STATUS_INFORMATION>
  <Update_Time>Wed Oct 14 05:22:14 2026 GMT</Update_Time>
  <Dtd_File>http://www.fly.faa.gov/AirportStatus.dtd</Dtd_File>
  <Delay_type>
    <Name>Ground Stop Programs</Name>
    <Ground_Stop_List>
      <Program>
        <ARPT>EWR</ARPT>
        <Reason>thunderstorms</Reason>
        <End_Time>8:15 pm EDT</End_Time>
      </Program>
    </Ground_Stop_List>
  </Delay_type>
  <Delay_type>
    <Name>Ground Delay Programs</Name>
    <Ground_Delay_List>
      <Ground_Delay>
        <ARPT>SFO</ARPT>
        <Reason>low ceilings</Reason>
        <Avg>47 minutes</Avg>
        <Max>1 hour and 52 minutes</Max>
      </Ground_Delay>
    </Ground_Delay_List>
  </Delay_type>
  <Delay_type>
    <Name>General Arrival/Departure Delay Info</Name>
    <Arrival_Departure_Delay_List>
      <Delay>
        <ARPT>ORD</ARPT>
        <Reason>WX:Thunderstorms</Reason>
        <Arrival_Departure Type="Departure">
          <Min>16 minutes</Min>
          <Max>30 minutes</Max>
          <Trend>Increasing</Trend>
        </Arrival_Departure>
      </Delay>
      <Delay>
        <ARPT>ATL</ARPT>
        <Reason>VOLUME:Volume</Reason>
        <Arrival_Departure Type="Arrival">
          <Min>1 hour</Min>
          <Max>1 hour and 15 minutes</Max>
          <Trend>Steady</Trend>
        </Arrival_Departure>
      </Delay>
    </Arrival_Departure_Delay_List>
  </Delay_type>
  <Delay_type>
    <Name>Airport Closures</Name>
    <Airport_Closure_List>
      <Airport>
        <ARPT>SNA</ARPT>
        <Reason>!SNA 10/016 SNA AD AP CLSD DLY 0630-1315 2610130630-2610171315</Reason>
        <Start>Oct 13 at 06:30 UTC.</Start>
        <Reopen>Oct 17 at 13:15 UTC.</Reopen>
      </Airport>
    </Airport_Closure_List>
  </Delay_type>
</AIRPORT_STATUS_INFORMATION>
`;
