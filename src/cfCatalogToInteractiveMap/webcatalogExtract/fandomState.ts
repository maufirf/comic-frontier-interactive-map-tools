import { ensure } from "@/src/lib/helper/type";
import { FandomState } from "@/src/lib/types/cfim/fandomStateTypes";
import { levenshtein } from '@/src/lib/helper/levenshtein';
import { v4 as uuidv4 } from 'uuid';

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

export interface FandomSearchComposite {
    fandomStates: FandomState[];
    displayNameArr: string[];
    abbreviationArr: (string[]|undefined)[];
    namealikesArr: (string[]|undefined)[];
    commonTypoArr: (string[]|undefined)[];
    regexArr: (RegExp|undefined)[];
    uuidIndex: {[key:string]: number};
}

export interface FindFandomConfig {
    levenshteinSearch: boolean;
    levenshteinMinChar: number;
    levenshteinMaxDiff: number;
    levenshteinSearchOnFindingGroups: true;
    regexMatchFull: boolean;
}

export const findFandom = (
    fndmStr:string,
    {
        fandomStates,
        displayNameArr,
        abbreviationArr,
        namealikesArr,
        commonTypoArr,
        regexArr,
        uuidIndex,
    }:FandomSearchComposite,
    config:FindFandomConfig,
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

export const registerNewFandom = (
    fandomString: string,
    fsc: FandomSearchComposite,
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
    if (parentFandomStateIndex &&
        newFandomState.uuid!==fsc.fandomStates[parentFandomStateIndex].uuid
    ) {
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
export const processFandomString = (
    fandomString:string,
    fsc:FandomSearchComposite,
    circleUUID:string,
    parentFandomStateIndex: number|null=null,
    findFandomConfig:FindFandomConfig,
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
        // If a fandomState for such fandom exist,
        if (i>=0) {
            // push the circleUUId to the circleSellerUUIDs.
            fsc.fandomStates[i].circleSellerUUIDs.push(circleUUID);
            // consider if this fandomState also has parent
            if (parentFandomStateIndex &&
                fsc.fandomStates[i].uuid!==fsc.fandomStates[parentFandomStateIndex].uuid
            ) {                
                // if the new fandomState has predefined parent:
                // 1. add the parent's UUID to the current fandomState's supersetUUIDs
                // check if current fandomState has supersetUUIDs property
                if (fsc.fandomStates[i].supersetUUIDs) {
                    // only add if new fandomState.supersetUUIDs dont have parent's UUID
                    if (!fsc.fandomStates[i].supersetUUIDs?.includes(
                        fsc.fandomStates[parentFandomStateIndex].uuid
                    ))
                    fsc.fandomStates[i].supersetUUIDs?.push(
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
    const nomatchStr:string = "<<NOMATCH>>";
    Array.from(
        fandomString.matchAll(parenthesesParentAndContentRe)
    ).map(match=>{
        const conformedMatch = match[0].replace(trimRe,"");
        const contentMatch = conformedMatch.match(parenthesesContentRe);
        const parentMatch = conformedMatch.match(parenthesesParentRe);
        if (contentMatch && parentMatch) {
            return [
                // index 0 = children string
                ensure<RegExpMatchArray>(conformedMatch.match(parenthesesContentRe))[0].replace(trimRe,""),
                // index 1 = parent string
                ensure<RegExpMatchArray>(conformedMatch.match(parenthesesParentRe))[0].replace(',','').replace(trimRe,""),
            ]
        } else return [nomatchStr,nomatchStr]
    }).forEach(([childrenString,parentString])=>{
        if (childrenString===nomatchStr || parentString===nomatchStr) return;
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
            findFandomConfig,
        )
    })
    // get all matches from stripped string
}