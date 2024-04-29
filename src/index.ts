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
    return fandomState;
}) as FandomState[];

// bruh
const dataJSONAbsolutePath:string = path.resolve(__dirname,"./res/raw/cf18_catalog_raw.json");

const catalog:CF18WebcatalogCircle[] = parseJSONFile(dataJSONAbsolutePath) as CF18WebcatalogCircle[];

const pickingKeys:(keyof CF18WebcatalogCircle)[] = [
    "user_id",
    "circle_code",
    "name",
    "fandom",
    "other_fandom",
    "day",
];

const omittingKeys:(keyof CF18WebcatalogCircle)[] = [
    "circle_cut",
    "SellsCommision",
    "SellsComic",
    "SellsArtbook",
    "SellsPhotobookGeneral",
    "SellsNovel",
    "SellsGame",
    "SellsMusic",
    "SellsGoods",
    "circle_facebook",
    "circle_instagram",
    "circle_twitter",
    "circle_other_socials",
    "marketplace_link",
    "id",
    "rating",
    "sampleworks_images",
    "SellsHandmadeCrafts",
    "SellsMagazine",
    "SellsPhotobookCosplay",
]

const pickedCatalog = catalog.map(
    circle=>pick<CF18WebcatalogCircle>(circle,...pickingKeys)
)

const omittedCatalog = catalog.map(
    circle=>omit<CF18WebcatalogCircle>(circle,...omittingKeys)
)



//const exampleCircle = catalog[exampleIndex];
//const matches = exampleCircle.circle_code.matchAll(circleCodeRe)

//const exampleCircleState:CircleState = convertDataToInstance(exampleCircle);


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
const matchRe = /(?<=^|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*)\s*).+?(?=\s*$|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*))/g

const parenthesesContentRe = /(?<=\().+?(?=\))/g;
const parenthesesParentRe = /(?<=^|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*)\s*)[^\(\),]+?(?=\(.*?\))/g;
const parenthesesParentAndContentRe = /(?<=^|,|(?<!(fate)|\d*)[\\\/](?!(go)|(grand)|\d*)\s*)[^\(\),]+?\(.*?\)(?!\w+)/g;

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
    levenshteinSearch: true,
    levenshteinMinChar: 12,
    levenshteinMaxDiff: 2,
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
    config:typeof findFandomConfig
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
        if (foundIndex>=0) return [
            fandomStates[foundIndex],
            foundIndex,
        ];
    }

    // if still not found, find by the finding groups of
    //abbreviation, namealikes, and common typo
    [abbreviationArr,namealikesArr,commonTypoArr].forEach((findingGroup)=>{
        if (foundIndex>=0) return;
        foundIndex = findingGroup.findIndex(fgStr=>
            fgStr?
            //fgStr?.includes(fndmStr)
            (config.levenshteinSearch && fndmStr.length>=config.levenshteinMinChar?
                // fg refers to findingGroup's each string
                // search if levenshteinSearch is true
                fgStr.some((fg)=>levenshtein(fg,fndmStr)<=config.levenshteinMaxDiff):
                // otherwise just find exact match
                fgStr.includes(fndmStr)
            ):
            // return false if there if findingGroup has no content.
            false);
    });
    if (foundIndex>=0) return [
        fandomStates[foundIndex],
        foundIndex,
    ];

    // if still again not found, find by the regex
    foundIndex = regexArr.findIndex(re=>
        // if fandom has regex
        re?
        (fndmStr.match(re)?true:false):
        false
    );
    if (foundIndex>=0) return [
        fandomStates[foundIndex],
        foundIndex,
    ];

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
    // instantiate the new fandom
    const newFandomState:FandomState = {
        uuid: uuidv4(),
        displayName: fandomString,
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
    console.log(fandomString);
    // === 1. PROCESS STRING THAT HAS NO PARENTHESES ====
    // e.g
    // "genshin, honkai, idol (jkt48, 22/7), call of duty, indie vtuber indonesia (Ethel Chamomile, Kragono)"
    //  ^^^^^^^^^^^^^^^^                     ^^^^^^^^^^^^
    // replace unmarked with empty string, so you'll process:
    // "genshin, honkai, , call of duty, "

    // get all instances without parentheses and their parents
    const parenthesesStripped = fandomString.replace(parenthesesParentAndContentRe,"");
    console.log(parenthesesStripped);
    // get all matches from stripped string
    const strippedMatches = Array.from(parenthesesStripped.matchAll(matchRe)).map(
        match=>match[0].trim()
    );
    // process each match
    strippedMatches.forEach(match=>{
        console.log(match.replace(",",""));
        const [_, i] = findFandom(
            match.replace(",","").trim(),
            fsc,
            findFandomConfig
        )
        // If a fandomState for such fandom exist,
        if (i>=0) {
            // push the circleUUId to the parent's circleSellerUUIDs.
            fsc.fandomStates[i].circleSellerUUIDs.push(circleUUID);
            // consider if this fandomState also has parent
            if (parentFandomStateIndex) {                
                // if the new fandomState has predefined parent:
                // 1. add the parent's UUID to the new fandomState's supersetUUIDs
                if (fsc.fandomStates[i].supersetUUIDs) {
                    fsc.fandomStates[i].supersetUUIDs?.push(fsc.fandomStates[parentFandomStateIndex].uuid);
                } else {
                    fsc.fandomStates[i].supersetUUIDs = [fsc.fandomStates[parentFandomStateIndex].uuid];
                }
                // 2. add the new fandomState's UUID to the parent's subsetUUIDs
                // check if the parent already has subsetUUIDs property
                if (fsc.fandomStates[parentFandomStateIndex].subsetUUIDs) {
                    // if the parent has subsetUUIDs property, add the new fandomState UUID there
                    fsc.fandomStates[parentFandomStateIndex].subsetUUIDs?.push(fsc.fandomStates[i].uuid);
                } else {
                    // otherwise just instantate with [newFandomState.uuid] as the value
                    fsc.fandomStates[parentFandomStateIndex].subsetUUIDs = [fsc.fandomStates[i].uuid];
                }
            }
        } else {
            registerNewFandom(
                match,
                fsc,
                parentFandomStateIndex&&parentFandomStateIndex>=0?parentFandomStateIndex:null,
                circleUUID,
            );
            console.log(fsc.fandomStates[fsc.fandomStates.length-1]);
        }
        console.log(i>=0?fsc.fandomStates[i]:undefined);
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
        const conformedMatch = match[0].
        trim();
        return [
            // index 0 = children string
            ensure<RegExpMatchArray>(conformedMatch.match(parenthesesContentRe))[0].trim(),
            // index 1 = parent string
            ensure<RegExpMatchArray>(conformedMatch.match(parenthesesParentRe))[0].replace(',','').trim(),
        ]
    }).forEach(([childrenString,parentString])=>{
        console.log({
            childrenString,
            parentString,
        })
        // find parent's index if fandomStance instance exists
        var [_, parentIndex] = findFandom(
            parentString,
            fsc,
            findFandomConfig,
        )
        // if it doesn't exist, assign index to the
        // fandomSearchComposite.fandomStates position is going to be
        // new parent's FandomState's future index, then actually
        // register them.
        parentIndex = fsc.fandomStates.length;
        registerNewFandom(
            parentString,
            fsc,
            null,
            circleUUID
        );
        console.log(fsc.fandomStates[parentIndex]);
        processFandomString(
            childrenString,
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
processFandomString(
    //catalog[21].other_fandom.toLowerCase(),
    "Gemshi Impact, Honkia star rail, kpop(Super Junior, BTS), call of duty, identity v".toLowerCase(),
    fandomSearchComposite,
    //catalog[21].user_id,
    uuidv4(),
)
const outDir = path.resolve(__dirname,"../out");
fs.writeFileSync(`${outDir}/fandomStates.json`,JSON.stringify(fandomSearchComposite.fandomStates,null,4));