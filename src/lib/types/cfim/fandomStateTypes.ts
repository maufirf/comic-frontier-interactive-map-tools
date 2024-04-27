import { AttendanceIdentifiers, CommonMapDataInterface } from "./commonTypes";

export interface FandomState extends CommonMapDataInterface {
    uuid: string;
    displayName: string;
    abbreviation?: string[];
    namealikes?: string[];
    commonTypo?: string[];
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