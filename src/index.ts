import path from 'path';
import * as fs from 'fs';
import { parseJSONFile } from "@/src/lib/helper/file";
import { CFWebcatalogCircle } from "@/src/lib/types/cfWebcatalog/cfWebcatalogCircleTypes";
import { FandomState } from "@/src/lib/types/cfim/fandomStateTypes";
import { FandomSearchComposite, FindFandomConfig } from './cfCatalogToInteractiveMap/webcatalogExtract/fandomState';
import { convertCFCatalogRaw } from './script/convertCFCatalogRaw';

//CF16
//const fandomSeed:FandomState[] = [];
//CF18
import fandomSeed from "@/src/res/seed/fandomStatesSeed.json";

// Instatiate the catalog
//CF17
//const dataJSONAbsolutePath:string = path.resolve(__dirname,"./res/raw/cf17rawCatalogueData.json");
//CF18
const dataJSONAbsolutePath:string = path.resolve(__dirname,"./res/raw/cf18_catalog_raw_20240429_uuidfix.json");
const catalog:CFWebcatalogCircle[] = parseJSONFile(dataJSONAbsolutePath) as CFWebcatalogCircle[];

// Populate fandomStates from seeds (curated fandoms)
const fandomStatesSeed:FandomState[] = fandomSeed.map((fandomState)=>{
    const reinstated = fandomState as FandomState;
    if (fandomState.regexStr) {reinstated.regex = new RegExp(fandomState.regexStr)}
    return reinstated;
}) as FandomState[];


// Prepare the search composite object, a set of temporary
// arrays that is going to be used to aid categorizing
// fandoms
const fandomSearchComposite:FandomSearchComposite = {
    fandomStates: fandomStatesSeed,
    displayNameArr: fandomStatesSeed.map(x=>x.displayName.toLowerCase()),
    abbreviationArr: fandomStatesSeed.map(x=>x.abbreviation),
    namealikesArr: fandomStatesSeed.map(x=>x.namealikes),
    commonTypoArr: fandomStatesSeed.map(x=>x.commonTypo),
    regexArr: fandomStatesSeed.map(x=>x.regex),
    uuidIndex: Object.fromEntries(fandomStatesSeed.map((fandomState,i)=>(
        [fandomState.uuid,i]
    )))
}

// Prepare the searching config, this will determine how
// accurate the search is and how tolerating the search
// restrictions are
const findFandomConfig:FindFandomConfig = {
    // Whether to enable Levenshtein search
    levenshteinSearch: true,

    // these config only relevant if levensthteinSearch===true
        // The minimum amount of characters a string can be qualified to use levenshtein search
        levenshteinMinChar: 12,
        // The maximum levenshtein distance for a string to be deemed "close enough"
        levenshteinMaxDiff: 2,
        // Whether to enable levenshtein search on finding groups (abbreviations, common typo, namealikes)
        levenshteinSearchOnFindingGroups: true,

    // Whether regex should match full or not
    regexMatchFull: true,
}

const { circleStates, fandomStates, standStates } = convertCFCatalogRaw(
    catalog,
    fandomSearchComposite,
    findFandomConfig,
)

const outDir = path.resolve(__dirname,"../out");
fs.writeFileSync(`${outDir}/circleStates.json`,JSON.stringify(circleStates,null,4));
fs.writeFileSync(`${outDir}/fandomStates.json`,JSON.stringify(fandomStates,null,4));
fs.writeFileSync(`${outDir}/standStates.json`,JSON.stringify(standStates,null,4));
fs.writeFileSync(`${outDir}/fandomSellerCounts.json`,JSON.stringify(
    Object.fromEntries(fandomSearchComposite.fandomStates.map(
        (fandom):[string,number]=>[
        fandom.displayName,
        fandom.circleSellerUUIDs.length
    ]).sort((a,b)=>b[1]-a[1]))
,null,4))

/*
console.log("TOP 3 BANYAK VARIASI KETIK TERBANYAK JATUH KEPADA")
console.log(
    fandomStates
    .map(fandom=>fandom.commonTypo) // map and get common typo array from each fandom
    .filter(commonTypo=>commonTypo) // filter out ones that are undefined
    .map(commonTypo=>ensure<string[]>(commonTypo)) // map and ensure each commonTypo arr
    .sort((a:string[],b:string[])=>b.length-a.length).slice(0,3)
)
*/