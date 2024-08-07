import { ensure } from "@/src/lib/helper/type";
import { dayKeys } from "@/src/lib/types/cfim/commonTypes";
import { convertDataToInstance } from "@/src/cfCatalogToInteractiveMap/webcatalogExtract/circleState";
import { CFWebcatalogCircle } from "@/src/lib/types/cfWebcatalog/cfWebcatalogCircleTypes";
import { CircleState } from "@/src/lib/types/cfim/circleStateTypes";
import { StandState} from "@/src/lib/types/cfim/standStateTypes";
import { FandomSearchComposite, FindFandomConfig, processFandomString } from '@/src/cfCatalogToInteractiveMap/webcatalogExtract/fandomState';

import { stdout as log } from "single-line-log";

export function convertCFCatalogRaw(
    catalog:CFWebcatalogCircle[],
    fandomSearchComposite:FandomSearchComposite,
    findFandomConfig:FindFandomConfig,
) {

    console.log ([
    "\n\n==============================================",
        "==                                          ==",
        "==            EXTRACTING CIRCLES            ==",
        "==                                          ==",
        "==============================================\n\n",
    ].join("\n"))
    
    const circleStates:CircleState[] = catalog.map((circle,i)=>{
        if ((i%Math.floor(catalog.length/10))===Math.floor(catalog.length/10)-1 || i===catalog.length-1)
            log(`Processed ${i+1}/${catalog.length} circles\n|${"█".repeat(3*Math.floor(i/Math.floor(catalog.length/10)))}${" ".repeat(30-3*Math.floor(i/Math.floor(catalog.length/10)))}|\n`);
        return convertDataToInstance(circle)
    })

    const circleStatesUUIDIndex:{[key:string]:number} = Object.fromEntries(circleStates.map((circle,i)=>[circle.uuid,i]));
    
    log.clear();
    console.log([
    "\n\n==============================================",
        "==                                          ==",
        "==            EXTRACTING FANDOMS            ==",
        "==                                          ==",
        "==============================================\n\n",
    ].join("\n"))
    
    // Populate the fandomState using the data from catalog
    catalog.forEach((circle,i)=>{
        processFandomString(
            circle.fandom.toLowerCase(),
            fandomSearchComposite,
            circle.user_id,
            null,
            findFandomConfig,
        );
        processFandomString(
            circle.other_fandom.toLowerCase(),
            fandomSearchComposite,
            circle.user_id,
            null,
            findFandomConfig,
        );
        if ((i%Math.floor(catalog.length/10))===Math.floor(catalog.length/10)-1 || i===catalog.length-1) {
            //https://stackoverflow.com/questions/32938213/is-there-a-way-to-erase-the-last-line-of-output
            log(`Processed ${i+1}/${catalog.length} circles\n|${"█".repeat(3*Math.floor(i/Math.floor(catalog.length/10)))}${" ".repeat(30-3*Math.floor(i/Math.floor(catalog.length/10)))}|\n`);
        }
    })
    const fandomStatesUUIDIndex:{[key:string]:number} = Object.fromEntries(
        fandomSearchComposite.fandomStates.map((fandom,i)=>[fandom.uuid,i])
    );
    
    log.clear();
    console.log([
    "\n\n==============================================",
        "==                                          ==",
        "==             CROSS-POPULATING             ==",
        "==      circleStates FROM fandomStates      ==",
        "==============================================\n\n",
    ].join("\n"),"")

    fandomSearchComposite.fandomStates.forEach(fandom => {
        fandom.circleSellerUUIDs.forEach(circleUUID => {
            if (!circleStates[circleStatesUUIDIndex[circleUUID]].fandomUUIDs.includes(fandom.uuid))
                circleStates[circleStatesUUIDIndex[circleUUID]].fandomUUIDs.push(fandom.uuid)
        })
    })
        
    console.log([
    "\n\n==============================================",
        "==                                          ==",
        "==             CROSS-POPULATING             ==",
        "==      standStates FROM circleStates       ==",
        "==============================================\n\n",
    ].join("\n"))

    const standStates:StandState[] = [];
    const standStateCodeIndex:{[key:string]:number} = {};
    // loop to each circle
    circleStates.forEach(circle=>{
        // loop to each days
        dayKeys.forEach(dayKey=>{
            // check if this circle has attendance on current day
            if (circle.standAttendanceCodes[dayKey]) {
                // if it does, go loop to every stand code it attends that day
                circle.standAttendanceCodes[dayKey]?.forEach(dayStandCode=>{
                    // check if there's already a standState for the code
                    if (standStateCodeIndex[dayStandCode]) {
                        // check if sais standState already has current day attendance
                        if (standStates[standStateCodeIndex[dayStandCode]].circleAttendanceUUIDs[dayKey]) {
                            //if it does, then push the circleUUID there
                            standStates[standStateCodeIndex[dayStandCode]].circleAttendanceUUIDs[dayKey]?.push(circle.uuid);
                        } else {
                            // else just make a new attendace and use circleUUID as its first value
                            standStates[standStateCodeIndex[dayStandCode]].circleAttendanceUUIDs[dayKey] = [circle.uuid];
                        }
                    // if the standState don't exist yet, create a new circle instead.
                    } else {
                        const codeReMat = Array.from(dayStandCode.matchAll(/([A-Za-z])([A-Za-z])?-(\d{1,2})([ab])?/g))[0];
                        const code = `${codeReMat[1].toUpperCase()}${(codeReMat[2]?codeReMat[2]:"").toLowerCase()}-${+codeReMat[3]}${(codeReMat[4]?codeReMat[4]:"").toLowerCase()}`
                        const displayName = `${codeReMat[1].toUpperCase()}${(codeReMat[2]?codeReMat[2]:"").toLowerCase()}-${codeReMat[3].padStart(2,"0")}${(codeReMat[4]?codeReMat[4]:"").toLowerCase()}`
                        const newStandState:StandState = {
                            code,
                            displayName,
                            standType:dayStandCode.match(/(^[A-Za-z]-){1}/g)?"circle":"circlepro",
                            circleAttendanceUUIDs: Object.fromEntries([[dayKey,[circle.uuid]]]),
                        };
                        standStateCodeIndex[newStandState.code] = standStates.length;
                        standStates.push(newStandState);
                    }
                })
            } 
        })
    })

    return {
        circleStates,
        fandomStates: fandomSearchComposite.fandomStates,
        standStates,
    }
}

