"use strict"

import { ensure } from "../../lib/helper/type";
import { CFWebcatalogCircle } from "../../lib/types/cfWebcatalog/cfWebcatalogCircleTypes";
import { CircleState } from "../../lib/types/cfim/circleStateTypes";
import { AttendanceIdentifiers } from "../../lib/types/cfim/commonTypes";
import { StandType } from "../../lib/types/cfim/standStateTypes";

/**
 * Regex breakdown:
 *  (                                       // Match group 1: ONE instance of a stand (B-56ab)
 *      ([A-Za-z]{1}|[A-Za-z]{2})           // Match group 2: Circle block code that discriminates between circle (one letter) and circlepro (two letters)
 *      -                                           // ignored match: separator dash
 *      (\d{1,2})                           // Match group 3: Circle number
 *      ([ab]){0,2}                         // Match group 4: Subcircle code, if exists, max 2 (usually ab). Ignore this if it's circlepro.
 *      \/?                                         // ignored match: forward slash "/" that separates match group 1 instances, for circles that books two circle/circlepro(s)
 *  ){1,2}
 *  \s?                                             // ignored match: whitespace that spaces the circle code and day
 *  \((SAT|SUN)\)?                          // Match group 5: Day, if any. No days means both days.
 */
export const circleCodeRe = /(([A-Za-z]{1}|[A-Za-z]{2})-(\d{1,2})([ab]){0,2}\/?){1,2}\s?\((SAT|SUN)\)?/g;

export const dissectCodeToDayAttendance = (circleCodeString:string):AttendanceIdentifiers => {
    // Split
    const [codeGroup,dayGroup] = circleCodeString.split(" ");
    const codes = codeGroup.split("/");
    const codesProcessed = codes.map(
        code => code.match(/(([A-Za-z]{1})|([A-Za-z]{2}))-(\d{1,2})(a)?(b)?/)
    ).map(match => {
        const ensuredMatch = ensure<RegExpMatchArray>(match);
        const type:StandType = ensuredMatch[2]? "circle" : "circlepro";
        const isCircle = type==="circle";
        const block = ensuredMatch[2]? ensuredMatch[2] : ensuredMatch[3]
        const number = +ensuredMatch[4];
        const outCircleTemp = []
        if (isCircle) {
            if (ensuredMatch[5]) outCircleTemp.push("a");
            if (ensuredMatch[6]) outCircleTemp.push("a");
            return outCircleTemp.map(subCode=>`${block}-${number}${subCode}`);
        } else {
            return `${block}-${number}`;
        };
    }).flat();

    if (dayGroup) {
        const dayProcessed = ensure<RegExpMatchArray>(dayGroup.match(/(SAT)|(SUN)/));
        return {
            day1: dayProcessed[1]?codesProcessed:undefined,
            day2: dayProcessed[2]?codesProcessed:undefined
        }
    } else {
        return {
            day1: codesProcessed,
            day2: codesProcessed,
        }
    }
};

export const convertDataToInstance = (data:CFWebcatalogCircle):CircleState => ({
    id: +data.id,
    uuid: data.user_id,
    displayName: data.name,
    fandoms: [data.fandom,data.other_fandom],
    standAttendanceCodes: dissectCodeToDayAttendance(data.circle_code),
})