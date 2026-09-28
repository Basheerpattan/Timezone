// Time zone abbreviations people type: "3pm PST to IST", "EST to CET".
//
// Each code names the city whose clock it means. Summer and winter forms
// ("PST" and "PDT") point at the same city, because people say "PST" all year
// and mean Pacific time, not a fixed UTC-8. Codes that several regions share
// pick the reading most visitors mean and list the others in `also`, so the
// answer can say which one it used.
//
// Deliberately missing: codes that are also everyday words ("EAT", "WET",
// "WEST", "ART", "CAT"), which would turn ordinary sentences into places.

// code: [city, name, also?]
export const ABBREVIATIONS = {
  // North America
  pt: ['Los Angeles', 'Pacific Time'],
  pst: ['Los Angeles', 'Pacific Time'],
  pdt: ['Los Angeles', 'Pacific Time'],
  mt: ['Denver', 'Mountain Time'],
  mst: ['Denver', 'Mountain Time'],
  mdt: ['Denver', 'Mountain Time'],
  ct: ['Chicago', 'Central Time'],
  cst: ['Chicago', 'US Central Time', 'China Standard Time'],
  cdt: ['Chicago', 'Central Time'],
  et: ['New York', 'Eastern Time'],
  est: ['New York', 'Eastern Time'],
  edt: ['New York', 'Eastern Time'],
  akst: ['Anchorage', 'Alaska Time'],
  akdt: ['Anchorage', 'Alaska Time'],
  hst: ['Honolulu', 'Hawaii Time'],
  ast: ['Riyadh', 'Arabia Standard Time', 'Atlantic Standard Time'],
  brt: ['Sao Paulo', 'Brasília Time'],

  // Europe and Africa
  utc: ['UTC', 'Coordinated Universal Time'],
  gmt: ['UTC', 'Greenwich Mean Time', 'UK time (London)'],
  bst: ['London', 'British Summer Time', 'Bangladesh Standard Time'],
  cet: ['Paris', 'Central European Time'],
  cest: ['Paris', 'Central European Time'],
  eet: ['Athens', 'Eastern European Time'],
  eest: ['Athens', 'Eastern European Time'],
  msk: ['Moscow', 'Moscow Time'],
  sast: ['Johannesburg', 'South Africa Time'],

  // Asia and Oceania
  gst: ['Dubai', 'Gulf Standard Time'],
  pkt: ['Karachi', 'Pakistan Time'],
  ist: ['New Delhi', 'India Standard Time', 'Israel or Irish Standard Time'],
  npt: ['Kathmandu', 'Nepal Time'],
  sgt: ['Singapore', 'Singapore Time'],
  hkt: ['Hong Kong', 'Hong Kong Time'],
  jst: ['Tokyo', 'Japan Time'],
  kst: ['Seoul', 'Korea Time'],
  awst: ['Perth', 'Australian Western Time'],
  acst: ['Adelaide', 'Australian Central Time'],
  acdt: ['Adelaide', 'Australian Central Time'],
  aest: ['Sydney', 'Australian Eastern Time'],
  aedt: ['Sydney', 'Australian Eastern Time'],
  nzst: ['Auckland', 'New Zealand Time'],
  nzdt: ['Auckland', 'New Zealand Time'],
}

/** The abbreviation a phrase is, if it is exactly one: { code, city, name, also }. */
export function findAbbreviation(phrase) {
  const code = phrase.trim().toLowerCase()
  const hit = Object.hasOwn(ABBREVIATIONS, code) && ABBREVIATIONS[code]
  return hit ? { code: code.toUpperCase(), city: hit[0], name: hit[1], also: hit[2] || null } : null
}
