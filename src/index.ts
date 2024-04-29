import path from 'path';

import * as fs from 'fs';
import { circleCodeRe, convertDataToInstance, dissectCodeToDayAttendance } from "@/src/cfCatalogToInteractiveMap/json/webcatalogExtract";
import { parseJSONFile } from "@/src/lib/helper/file";
import { omit, pick } from "@/src/lib/helper/object";
import { ensure } from "@/src/lib/helper/type";
import { CFWebcatalogCircle as CF18WebcatalogCircle, CFWebcatalogCircleDay } from "@/src/lib/types/cfWebcatalog/cfWebcatalogCircleTypes";
import { CircleState } from "@/src/lib/types/cfim/circleStateTypes";
import { AttendanceIdentifiers } from "@/src/lib/types/cfim/commonTypes";
import { InstanceIndexState } from "@/src/lib/types/cfim/indexStateTypes";
import { StandType } from "@/src/lib/types/cfim/standStateTypes";

import fandomSeed from "@/src/res/seed/fandomStatesSeed.json";
import { FandomState } from "@/src/lib/types/cfim/fandomStateTypes";
import { levenshtein } from './lib/helper/levenshtein';
import { v4 as uuidv4 } from 'uuid';
const fandomStates:FandomState[] = fandomSeed.map((fandomState)=>{
    const reinstated = fandomState as FandomState;
    if (fandomState.regexStr) {reinstated.regex = new RegExp(fandomState.regexStr)}
    return reinstated;
}) as FandomState[];

// bruh
const dataJSONAbsolutePath:string = path.resolve(__dirname,"./res/raw/cf18_catalog_raw_20240429_uuidfix.json");

const catalog:CF18WebcatalogCircle[] = parseJSONFile(dataJSONAbsolutePath) as CF18WebcatalogCircle[];

/**
 * Regex Breakdown:
 * 
 * Matches on:
 * - parantheses
 * - slashes that was perceded and succeeded by patterns that
 *   may have been part of its branding, like "Fate/Grand Order"
 *   or "Persona 3/4/5"
 * 
 *  /
 *      \(                                                  // Open parentheses
 *      |
 *      \)                                                  // Close parentheses
 *      |
 *      (?<!(fate)|\d+)\s*[\/\\\+]\s*(?!(grand)|(go)|\d+)   // Slashes including whitespaces around it that ARE NOT branding exception like Fate/go and number delimited by slashes
 *  /g      
 */
const commaReplaceRe = /\(|\)|(?<!(fate)|\d+)\s*[\/\\\+]\s*(?!(grand)|(go)|\d+)/g;

// Matches commas that are not perceded by open parentheses until its closing
const commaSplitRe = /,(?![^(]*\))/

/**
 * Matches strings with at least one characters lazily, enshrouded with either:
 * - Beginning/end of line
 * - comma
 * - Forward/backward slashes that are not:
 *      - part of branding, like fate/go
 *      - series number, like Persona 3/4/5
 */
const matchRe = /(?<=(^|,|(?<!(fate)|\d)\s*[\\\/]\s*(?!(g(rand|o))|\d))).*?(?=(,|(?<!(fate)|\d)\s*[\\\/]\s*(?!(g(rand|o))|\d))|$)/g

const parenthesesContentRe = /(?<=\().+?(?=\))/g;
const parenthesesParentRe = /(?<=^|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*)\s*)[^\(\),]+?(?=\(.*?\))/g;
const parenthesesParentAndContentRe = /(?<=^|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*)\s*)[^\(\),]+?\(.*?\)(?!\w+)/g;

// matches to at least two commas that don't have any text between each commas.
// Intended to eliminate the side effect of removing the parentheses and the word
// preceeding it (which creates a complete gap between to commas), by replacing
// those orphan commas with just one comma.
const orphanCommaRe = /(\s*,\s*){2,}/g

// matches to anything that's not:
// - alphanumerical
// - underscore
// Intended to aid creating codenames from display names
const conformDisplayNameToCodeRe = /[^A-Za-z0-9_+-]/g

// Matches to only strings that only has commas and whitespace in its entirety
// Intended to cancel making new fandom if the whole fandom name is this
const onlyCommaRe = /^(\s*,\s*)+$/g

// Matches to commas and whitespaces that are in the trim region (start & end of a string)
// Intended to substitute the whitespace-only string.trim() function
const trimRe = /(^[\s,]+)|([\s,]+$)/g

const fandomSearchComposite = {
    fandomStates,
    displayNameArr: fandomStates.map(x=>x.displayName.toLowerCase()),
    abbreviationArr: fandomStates.map(x=>x.abbreviation),
    namealikesArr: fandomStates.map(x=>x.namealikes),
    commonTypoArr: fandomStates.map(x=>x.commonTypo),
    regexArr: fandomStates.map(x=>x.regex),
    uuidIndex: Object.fromEntries(fandomStates.map((fandomState,i)=>(
        [fandomState.uuid,i]
    )))
}

const findFandomConfig = {
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
const findFandom = (
    fndmStr:string,
    {
        fandomStates,
        displayNameArr,
        abbreviationArr,
        namealikesArr,
        commonTypoArr,
        regexArr,
        uuidIndex,
    }:typeof fandomSearchComposite,
    config:typeof findFandomConfig,
    circleUUID?: string,
):[
    fandomState:FandomState|undefined,
    fandomStateIndex:number,
 ] => {
    // assume it's not found by making index -1
    var foundIndex:number = -1;

    // ALL SEARCH STRING HAS TO BE LOWERCASE!
    // STRONG REMINDER TO LOWERCASE THE
    // displayName PROPERTY FIRST!

    // find by displayName
    if (config.levenshteinSearch && fndmStr.length>=config.levenshteinMinChar) {
        // dn refers to displayName
        foundIndex = displayNameArr.findIndex(dn=>levenshtein(dn,fndmStr)<=config.levenshteinMaxDiff);
        if (foundIndex>=0) {
            // levenshtein searches shouldn't just return the found
            // fandomState, but also update the fandomState's
            // commonTypo property
            if (fndmStr!==fandomStates[foundIndex].displayName.toLowerCase()) {
                if (fandomStates[foundIndex].commonTypo) {
                    // push new common typo if property exists
                    // only if the current fandom string isn't already
                    // in common typo array yet
                    if (!fandomStates[foundIndex].commonTypo?.includes(fndmStr))
                        fandomStates[foundIndex].commonTypo?.push(fndmStr);
                } else {
                    // otherwise instantiate the property with [fndmStr] as value
                    fandomStates[foundIndex].commonTypo = [fndmStr];
                }
            }
            return [
                fandomStates[foundIndex],
                foundIndex,
            ];
        }
    } else {
        foundIndex = displayNameArr.findIndex(dn=>dn.toLowerCase()===fndmStr);
        if (foundIndex>=0) {
            return [
                fandomStates[foundIndex],
                foundIndex,
            ]
        };
    }

    // if still not found, find by the finding groups of
    //abbreviation, namealikes, and common typo
    [abbreviationArr,namealikesArr,commonTypoArr].every((findingGroup)=>{
        foundIndex = findingGroup.findIndex(fgStr=>{
            if (fgStr)  {
                
                if (
                    config.levenshteinSearch &&
                    config.levenshteinSearchOnFindingGroups &&
                    fndmStr.length>=config.levenshteinMinChar
                ) {
                    // fg refers to findingGroup's each string
                    // search if levenshteinSearch is true
                    return fgStr.some((fg)=>levenshtein(fg,fndmStr)<=config.levenshteinMaxDiff)
                } else {
                    // otherwise just find exact match
                    return fgStr.includes(fndmStr)
                }
            } else {
                // return false if there if findingGroup has no content.
                return false
            }
        });
        return foundIndex<0
    });
    if (foundIndex>=0) return [
        fandomStates[foundIndex],
        foundIndex
    ]

    // if still again not found, find by the regex
    foundIndex = regexArr.findIndex(re=>{
        // if fandom has regex
        if (re) {
            if (config.regexMatchFull) {
                return ((fndmStr.match(new RegExp(`^${re.source}$`)))?true:false)
            } else {
                return fndmStr.match(re)?true:false
            }
        } else {
            return false 
        };
    });
    if (foundIndex>=0) {
        // regex searches shouldn't just return the found
        // fandomState, but also update the fandomState's
        // commonTypo property
        if (fndmStr!==fandomStates[foundIndex].displayName.toLowerCase()) {
            if (fandomStates[foundIndex].commonTypo) {
                // push new common typo if property exists
                // only if the current fandom string isn't already
                // in common typo array yet
                if (!fandomStates[foundIndex].commonTypo?.includes(fndmStr))
                    fandomStates[foundIndex].commonTypo?.push(fndmStr);
            } else {
                // otherwise instantiate the property with [fndmStr] as value
                fandomStates[foundIndex].commonTypo = [fndmStr];
            }
        }
        return [
            fandomStates[foundIndex],
            foundIndex,
        ]
    ;}

    // my brother you have fallen
    return  [
        undefined,
        -1,
    ];
}

const registerNewFandom = (
    fandomString: string,
    fsc: typeof fandomSearchComposite,
    parentFandomStateIndex: number|null = null,
    sellerUUID?: string,
) => {
    // don't initiate if the fandomString is only commas
    if (fandomString.match(onlyCommaRe)?true:false) return;

    // instantiate the new fandom
    const newFandomState:FandomState = {
        uuid: uuidv4(),
        code: fandomString.toLowerCase().replace(conformDisplayNameToCodeRe,"_"),
        displayName: fandomString.split(" ").map(str=>`${str.charAt(0).toUpperCase()}${str.slice(1)}`).join(" "),
        circleSellerUUIDs:sellerUUID?[sellerUUID]:[],
    }

    // check if this new fandom has predefined parent
    if (parentFandomStateIndex) {
        // if the new fandomState has predefined parent:
        // 1. add the parent's UUID to the new fandomState's supersetUUIDs
        newFandomState.supersetUUIDs = [fsc.fandomStates[parentFandomStateIndex].uuid];
        // 2. add the new fandomState's UUID to the parent's subsetUUIDs
        // check if the parent already has subsetUUIDs property
        if (fsc.fandomStates[parentFandomStateIndex].subsetUUIDs) {
            // if the parent has subsetUUIDs property, add the new fandomState UUID there
            fsc.fandomStates[parentFandomStateIndex].subsetUUIDs?.push(newFandomState.uuid);
        } else {
            // otherwise just instantate with [newFandomState.uuid] as the value
            fsc.fandomStates[parentFandomStateIndex].subsetUUIDs = [newFandomState.uuid];
        }
    }

    // when instatiation finalized, update the search suite.
    // add values that this new fandomState has
    fsc.uuidIndex[newFandomState.uuid] = fsc.fandomStates.length;
    fsc.fandomStates.push(newFandomState);
    fsc.displayNameArr.push(newFandomState.displayName);
    // add dummy values to what this fandomState lacking of
    fsc.abbreviationArr.push(undefined);
    fsc.namealikesArr.push(undefined);
    fsc.regexArr.push(undefined);
    fsc.commonTypoArr.push(undefined);
    fsc.regexArr.push(undefined);

    return newFandomState;
}

/**
 * 
 */
const processFandomString = (
    fandomString:string,
    fsc:typeof fandomSearchComposite,
    circleUUID:string,
    parentFandomStateIndex: number|null=null
) => {
    // === 1. PROCESS STRING THAT HAS NO PARENTHESES ====
    // e.g
    // "genshin, honkai, idol (jkt48, 22/7), call of duty, indie vtuber indonesia (Ethel Chamomile, Kragono)"
    //  ^^^^^^^^^^^^^^^^                     ^^^^^^^^^^^^
    // replace unmarked with empty string, so you'll process:
    // "genshin, honkai, , call of duty, "

    // get all instances without parentheses and their parents
    const parenthesesStripped = fandomString.replace(parenthesesParentAndContentRe,"");
    // get all matches from stripped string
    const strippedMatches = Array.from(parenthesesStripped.matchAll(matchRe)).map(
        match=>match[0].replace(trimRe,"")
    );
    // process each match
    strippedMatches.forEach(match=>{
        const [_, i] = findFandom(
            match.replace(",","").replace(trimRe,"").toLowerCase(),
            fsc,
            findFandomConfig,
            circleUUID,
        )
        if (circleUUID==="730d956f-de5c-4979-8f8d-f50aadeb36de") (console.log(i, match.replace(",","").replace(trimRe,"").toLowerCase()));
        // If a fandomState for such fandom exist,
        if (i>=0) {
            // push the circleUUId to the circleSellerUUIDs.
            fsc.fandomStates[i].circleSellerUUIDs.push(circleUUID);
            // consider if this fandomState also has parent
            if (parentFandomStateIndex) {                
                // if the new fandomState has predefined parent:
                // 1. add the parent's UUID to the current fandomState's supersetUUIDs
                // check if current fandomState has supersetUUIDs property
                if (fsc.fandomStates[i].supersetUUIDs) {
                    // only add if new fandomState.supersetUUIDs dont have parent's UUID
                    if (!fsc.fandomStates[i].supersetUUIDs?.includes(
                        fsc.fandomStates[parentFandomStateIndex].uuid
                    )) fsc.fandomStates[i].supersetUUIDs?.push(
                        fsc.fandomStates[parentFandomStateIndex].uuid
                    );
                } else {
                    fsc.fandomStates[i].supersetUUIDs = [fsc.fandomStates[parentFandomStateIndex].uuid];
                }
                // 2. add the new fandomState's UUID to the parent's subsetUUIDs
                // check if the parent already has subsetUUIDs property
                if (fsc.fandomStates[parentFandomStateIndex].subsetUUIDs) {
                    // if the parent has subsetUUIDs property, add the new fandomState UUID there
                    // only add if new fandomState.supersetUUIDs dont have parent's UUID
                    if (!fsc.fandomStates[parentFandomStateIndex].subsetUUIDs?.includes(
                        fsc.fandomStates[i].uuid
                    )) fsc.fandomStates[parentFandomStateIndex].subsetUUIDs?.push(
                        fsc.fandomStates[i].uuid
                    );
                } else {
                    // otherwise just instantate with [newFandomState.uuid] as the value
                    fsc.fandomStates[parentFandomStateIndex].subsetUUIDs = [fsc.fandomStates[i].uuid];
                }
            }
        } else {
            registerNewFandom(
                match.replace(",","").replace(trimRe,"").toLowerCase(),
                fsc,
                parentFandomStateIndex&&parentFandomStateIndex>=0?parentFandomStateIndex:null,
                circleUUID,
            );
        }
    });

    // === 2. PROCESS STRING THAT HAS PARENTHESES WITH ITS PRECEEDING TOKEN ====
    // e.g
    // "genshin, honkai, idol (jkt48, 22/7), call of duty, indie vtuber indonesia (Ethel Chamomile, Kragono)"
    //                   ^^^^  ^^^^^^^^^^^                 ^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^
    //                    A1       B1                                A2                       B2
    // string that marked with label A will be labeled as parent string
    // string that marked with label B will be labeled as children string
    // get all instances of them, then recursively use them in this same function

    // get all instances without parentheses and their parents
    Array.from(
        fandomString.matchAll(parenthesesParentAndContentRe)
    ).map(match=>{
        const conformedMatch = match[0].replace(trimRe,"");
        return [
            // index 0 = children string
            ensure<RegExpMatchArray>(conformedMatch.match(parenthesesContentRe))[0].replace(trimRe,""),
            // index 1 = parent string
            ensure<RegExpMatchArray>(conformedMatch.match(parenthesesParentRe))[0].replace(',','').replace(trimRe,""),
        ]
    }).forEach(([childrenString,parentString])=>{
        // find parent's index if fandomStance instance exists
        var [_, parentIndex] = findFandom(
            parentString.toLowerCase(),
            fsc,
            findFandomConfig,
        )
        // if it doesn't exist, assign index to the
        // fandomSearchComposite.fandomStates position is going to be
        // new parent's FandomState's future index, then actually
        // register them.
        if (parentIndex<0) {
            parentIndex = fsc.fandomStates.length;
            registerNewFandom(
                parentString,
                fsc,
                null,
                circleUUID
            );
        }
        processFandomString(
            childrenString.replace(orphanCommaRe,","),
            fsc,
            circleUUID,
            parentIndex,
        )
    })
    // get all matches from stripped string
}
/*
const caughtParentheses:any[] = [];
const stringsWithoutParentheses: any[]= [];

const [fandomSellerUUIDs, fandomSellerNames]:({[key:string]:string[]})[] = [{}, {}];
catalog.forEach((data:CF18WebcatalogCircle)=>{
   [data.fandom,data.other_fandom].forEach(
        //https://stackoverflow.com/questions/39647555/how-to-split-string-while-ignoring-portion-in-parentheses
        fandomString=>{
            for (const match of fandomString.matchAll(parenthesesParentAndContentRe)) {
                caughtParentheses.push(match[0]);
            }
            stringsWithoutParentheses.push(fandomString.replace(parenthesesParentAndContentRe,""))

            fandomString.toLowerCase().replaceAll(
                commaReplaceRe
            ,",").split(
                commaSplitRe
            ).map(fandom=>fandom.trim()).forEach(
            fandom=>{
                if (fandom==="") {return}
                if (fandomSellerUUIDs[fandom]) {
                    if (!fandomSellerUUIDs[fandom].includes(data.user_id)) fandomSellerUUIDs[fandom].push(data.user_id);
                } else {
                    fandomSellerUUIDs[fandom] = [data.user_id];
                }
                if (fandomSellerNames[fandom]) {
                    if (!fandomSellerNames[fandom].includes(data.name)) fandomSellerNames[fandom].push(data.name);
                } else {
                    fandomSellerNames[fandom] = [data.name];
                }
            }
        )}
    );
});

const fandomSellerCounts = Object.fromEntries(Object.keys(fandomSellerNames).map(fandom=>
    [fandom,fandomSellerNames[fandom].length]
));
*/
/**
 * Interesting data on index:
 * - 247 = two circle stands but only for a day
 * - 405 = two circle stands for both days, spearhead
 */
/*
const exampleIndex = 3; 
const fandomNames = Object.keys(fandomSellerCounts);
const fandomSelect = fandomNames[exampleIndex];
const levenshteinResult = [
    fandomSelect,
    fandomNames.map(fandomName => [
        fandomName,
        levenshtein(fandomSelect,fandomName),
    ]).sort((a:(string|number)[],b:(string|number)[])=>
        (a[1] as number)-(b[1] as number)
    ).slice(0,20)
]
*/
/*
const outDir = path.resolve(__dirname,"../out");
fs.writeFileSync(`${outDir}/fandomLevenshtein.json`,JSON.stringify(levenshteinResult,null,4));
fs.writeFileSync(`${outDir}/fandomParenthesesOmitted.json`,JSON.stringify(stringsWithoutParentheses,null,4))
fs.writeFileSync(`${outDir}/fandomParentheses.json`,JSON.stringify(caughtParentheses,null,4))
fs.writeFileSync(`${outDir}/fandomStringsRaw.json`,JSON.stringify(catalog.map(circle=>[circle.fandom.toLowerCase(),circle.other_fandom.toLowerCase()]).flat(),null,4));
fs.writeFileSync(`${outDir}/fandomSellerNames.json`,JSON.stringify(fandomSellerNames,null,4));
fs.writeFileSync(`${outDir}/fandomSellerUUIDs.json`,JSON.stringify(fandomSellerNames,null,4));
fs.writeFileSync(`${outDir}/fandomSellerCounts.json`,JSON.stringify(fandomSellerCounts,null,4));
fs.writeFileSync(`${outDir}/circleStates.json`,JSON.stringify(catalog.map(circle=>convertDataToInstance(circle)),null,4));
*/
/*
console.log(JSON.stringify(
    findFandom(
        "game kikir",
        fandomSearchComposite,
        findFandomConfig,
    )
,null,4));
*/
catalog.forEach((circle,i)=>{
    processFandomString(
        circle.fandom.toLowerCase(),
        fandomSearchComposite,
        circle.user_id,
    );
    processFandomString(
        circle.other_fandom.toLowerCase(),
        fandomSearchComposite,
        circle.user_id,
    );
    console.log(`Processed ${i+1}/${catalog.length}`);
})
const outDir = path.resolve(__dirname,"../out");
fs.writeFileSync(`${outDir}/fandomStates.json`,JSON.stringify(fandomSearchComposite.fandomStates,null,4));
fs.writeFileSync(`${outDir}/fandomSellerCounts.json`,JSON.stringify(
    Object.fromEntries(fandomSearchComposite.fandomStates.map(
        (fandom):[string,number]=>[
        fandom.displayName,
        fandom.circleSellerUUIDs.length
    ]).sort((a,b)=>b[1]-a[1]))
,null,4))

console.log("TOP 3 BANYAK VARIASI KETIK TERBANYAK JATUH KEPADA")
console.log(
    fandomSearchComposite.fandomStates
    .map(fandom=>fandom.commonTypo) // map and get common typo array from each fandom
    .filter(commonTypo=>commonTypo) // filter out ones that are undefined
    .map(commonTypo=>ensure<string[]>(commonTypo)) // map and ensure each commonTypo arr
    .sort((a:string[],b:string[])=>b.length-a.length).slice(0,3)
)