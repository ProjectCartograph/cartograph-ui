/**
 * The active ISO 4217 currency codes.
 *
 * A currency is an identifier from a published standard, so it is picked
 * rather than typed: a box that accepts any three capitals accepts a typo
 * and nothing downstream can tell one from its neighbour (Programme Lead,
 * 2026-09-29). The list is the standard's own, fetched rather than
 * recalled, and includes the fund and metal codes it defines — the full
 * list is what was asked for, and trimming it here would be Cartograph deciding
 * what somebody's budget may be denominated in.
 *
 * Copied from the contract, which is the source: a test asserts the two
 * are identical, so a picker can never offer a value the schema refuses.
 */
export const CURRENCIES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD",
  "BDT","BHD","BIF","BMD","BND","BOB","BOV","BRL","BSD","BTN","BWP","BYN",
  "BZD","CAD","CDF","CHE","CHF","CHW","CLF","CLP","CNY","COP","COU","CRC",
  "CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD",
  "FKP","GBP","GEL","GHS","GIP","GMD","GTQ","GYD","HKD","HNL","HTG","HUF",
  "IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR",
  "KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LRD","LSL","LYD","MAD",
  "MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MXV",
  "MYR","MZN","NAD","NPR","NZD","OMR","PAB","PEN","PHP","PKR","PLN","PYG",
  "QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP",
  "SLE","SOS","SRD","SSP","STN","SYP","SZL","THB","TJS","TMT","TND","TOP",
  "TRY","TTD","TWD","TZS","UAH","UGX","USD","USN","UYI","UYU","UYW","UZS",
  "VED","VES","VND","VUV","WST","XAF","XAG","XAU","XBA","XBB","XBC","XBD",
  "XCD","XDR","XOF","XPD","XPF","XPT","XSU","XTS","XUA","XXX","YER","ZAR",
  "ZMW","ZWG",
] as const;

export type Currency = (typeof CURRENCIES)[number];
