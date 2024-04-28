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

const fandomSearchSuite = {
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
    }:typeof fandomSearchSuite,
    config:typeof findFandomConfig
):{
    fandomState:FandomState|undefined,
    foundMethod:string|undefined,
} => {
    var foundIndex:number = -1;

    // find by displayName
    if (config.levenshteinSearch && fndmStr.length>=config.levenshteinMinChar) {
        console.log("finding by levenshtein...");
        foundIndex = displayNameArr.findIndex(dn=>levenshtein(dn,fndmStr)<=config.levenshteinMaxDiff);
        console.log({foundIndex});
        if (foundIndex>=0) return {
            fandomState:fandomStates[foundIndex],
            foundMethod:"displayNameLevenshtein"
        };
    } else {
        foundIndex = displayNameArr.findIndex(dn=>dn===fndmStr);
        console.log("finding by exact...");
        console.log({foundIndex});
        if (foundIndex>=0) return {
            fandomState:fandomStates[foundIndex],
            foundMethod:"displayNameExact"
        };
    }

    // if still not found, find by the finding groups of
    //abbreviation, namealikes, and common typo
    groupFindingLoop: [abbreviationArr,namealikesArr,commonTypoArr].forEach((findingGroup,i)=>{
        if (foundIndex>=0) return;
        console.log(`finding by ${[
            "abbreviation",
            "namealikes",
            "commonTypoArr",
        ][i]}...`);
        foundIndex = findingGroup.findIndex(fgStr=>fgStr?fgStr?.includes(fndmStr):false);
    });
    if (foundIndex>=0) return {
        fandomState:fandomStates[foundIndex],
        foundMethod:"groupFinding"
    };
    console.log({foundIndex});

    // if still again not found, find by the regex
    console.log("finding by regex...");
    foundIndex = regexArr.findIndex(re=>re?(fndmStr.match(re)?true:false):false);
    console.log({foundIndex});
    if (foundIndex>=0) return {
        fandomState:fandomStates[foundIndex],
        foundMethod:"regex"
    };

    // my brother you have fallen
    return  {
        fandomState:undefined,
        foundMethod:undefined
    };
}

/**
 * 
 */
const conformFandomString = (
    fandomString:string,
    fandomStates:FandomState[],
    circleUUID:string,
    parentFandomString:string|null=null
) => {
    // get all instances of parentheses and their parents
    const parenthesesStripped = fandomString.replace(parenthesesParentAndContentRe,"");
    const strippedMatches = [];
    for (const match of parenthesesStripped.matchAll(matchRe)) {
        strippedMatches.push(match[0].trim());
    }
    
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
console.log(JSON.stringify(
    findFandom(
        "honkai /  star rail",
        fandomSearchSuite,
        findFandomConfig,
    )
,null,4));