import { CommonMapDataInterface, DayKey } from "./commonTypes"

export type StandAttendanceCodes = {
    // property only exists if they attend at least on one stand in that day
    [key in DayKey]?: string[];
}

export interface CircleState extends CommonMapDataInterface {
    id: number, //numeral id, chronically incremented as they registered one by one.
    uuid: string, //UUID, created when it's first registered
    displayName: string //name, mostly acknowledged as display name
    standAttendanceCodes: StandAttendanceCodes, //the stands they attends
    fandoms: [string,string] //FUTURE FEATURE: maybe UUIDs or IDs of each fandoms. CircleState gets populated by fandom -- fandoms shouldn't get populated at all.
    fandomUUIDs: string[]
    //#TODO: get more properties added here as necessary.
}