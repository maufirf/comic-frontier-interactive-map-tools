import { AttendanceIdentifiers, CommonMapDataInterface, DayKey, dayKeys, StringKeyIndex } from "./commonTypes";

/**
 * 
 */
type __CuratedFandomStands = {
    [key in DayKey]?: StringKeyIndex<boolean | number> | String[]
}

export interface CuratedFandomStands extends __CuratedFandomStands {
    //day1: StringKeyIndex<boolean | number> | String[];
    //day2: StringKeyIndex<boolean | number> | String[];
    name: string;
}

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
    
    /**
     * Whether this fandom is curated by CFIM team
     * (Comic Frontier Interactive Map)
     * 
     * The implication is that most of the circles in
     * circleSellerUUIDs have passed one of the matching
     * methods we have, either by exact match or approximate
     * match (through Levenshtein distance) on displayName,
     * abbreviation, namealikes, and commonTypo plus regex.
     */
    curatedCFIM?: true;


    /**
     * Whether this fandom is curated by IDGC research team
     * (Institut Data Gembrot CF)
     * 
     * The implication is that all of the stands in
     * curatedIDGCStands are manually handpicked
     * with the highest accuracy possible provided
     * by IDGC team.
     */
    curatedIDGC?: true;
    curatedIDGCStands?: CuratedFandomStands;
}

export interface DataFandomsState {
    fandoms: FandomState[];
}