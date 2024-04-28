import { AttendanceIdentifiers, CommonMapDataInterface } from "./commonTypes";

export interface FandomState extends CommonMapDataInterface {
    uuid: string;
    displayName: string; // proper marketed name, like "Fate/Grand Order"
    abbreviation?: string[]; // abbreviations, can be complete like 
    namealikes?: string[]; // a.k.a, aliases, other names this fandom is known as
    commonTypo?: string[]; // typo, mispellings that people often got
    regexStr?: string; // matches lowercase
    regex?: RegExp;
    circleSellerUUIDs: string[]; // day can be derived from circle later so let's not use AttendanceIdentifiers
    subsetUUIDs?: string[]; // fandoms that are included when the superset/parent (this fandom) is mentioned
    supersetUUIDs?: string[]; // the fandom that has this fandom the parent of
    curated?: boolean; // Whether this fandom is curated by CFIM team or Data Gembrot team
}

export interface DataFandomsState {
    fandoms: FandomState[];
}