import { circleCodeRe, convertDataToInstance, dissectCodeToDayAttendance } from "../cfCatalogToInteractiveMap/json/webcatalogExtract";
import { parseJSONFile } from "../lib/helper/file";
import { omit, pick } from "../lib/helper/object";
import { ensure } from "../lib/helper/type";
import { CFWebcatalogCircle as CF18WebcatalogCircle, CFWebcatalogCircleDay } from "../lib/types/cfWebcatalog/cfWebcatalogCircleTypes";
import { CircleState } from "../lib/types/cfim/circleStateTypes";
import { AttendanceIdentifiers } from "../lib/types/cfim/commonTypes";
import { InstanceIndexState } from "../lib/types/cfim/indexStateTypes";
import { StandType } from "../lib/types/cfim/standStateTypes";
import * as fs from 'fs';
import path from 'path';

// bruh
const dataJSONRelativePath:string = "../../../src/res/raw/cf18_catalog_raw.json";

const catalog:CF18WebcatalogCircle[] = parseJSONFile(dataJSONRelativePath) as CF18WebcatalogCircle[];

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

/**
 * Interesting data on index:
 * - 247 = two circle stands but only for a day
 * - 405 = two circle stands for both days, spearhead
 */
const exampleIndex = 247; 

const exampleCircle = catalog[exampleIndex];
const matches = exampleCircle.circle_code.matchAll(circleCodeRe)

const exampleCircleState:CircleState = convertDataToInstance(exampleCircle);


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

const [fandomSellerUUIDs, fandomSellerNames]:({[key:string]:string[]})[] = [{}, {}];
catalog.forEach((data:CF18WebcatalogCircle)=>{
    [data.fandom,data.other_fandom].forEach(
        //https://stackoverflow.com/questions/39647555/how-to-split-string-while-ignoring-portion-in-parentheses
        fandomString=>fandomString.toLowerCase().replaceAll(
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
        )
    );
});

const outDir = path.resolve(__dirname,"../../out");

fs.writeFileSync(`${outDir}/fandomStringsRaw.json`,JSON.stringify(catalog.map(circle=>[circle.fandom.toLowerCase(),circle.other_fandom.toLowerCase()]).flat(),null,4));
fs.writeFileSync(`${outDir}/fandomSellerNames.json`,JSON.stringify(fandomSellerNames,null,4));
fs.writeFileSync(`${outDir}/fandomSellerUUIDs.json`,JSON.stringify(fandomSellerNames,null,4));
fs.writeFileSync(`${outDir}/fandomSellerCounts.json`,JSON.stringify(
    Object.fromEntries(Object.keys(fandomSellerNames).map(fandom=>
        [fandom,fandomSellerNames[fandom].length]
    ))
,null,4));
fs.writeFileSync(`${outDir}/circleStates.json`,JSON.stringify(catalog.map(circle=>convertDataToInstance(circle)),null,4));


console.log(JSON.stringify(
    __dirname
,null,4));