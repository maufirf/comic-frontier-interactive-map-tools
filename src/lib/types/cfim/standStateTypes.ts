import { AttendanceIdentifiers, CommonMapDataInterface } from "./commonTypes";

export type StandType = "circle" | "circlepro";

//export type GetDOMElementFunc = ()=>HTMLDivElement; //#TODO: delete this the fuck up
export interface StandState extends CommonMapDataInterface {
    code: string;
    displayName: string;
    standType: StandType;
    circleAttendanceUUIDs: AttendanceIdentifiers;
    //getDOMElement?: GetDOMElementFunc; //#TODO: delete this the fuck up
}

interface BannedStandsIndex {
    [key:string]: boolean;
}

export interface dataStandsState {
    stands: StandState[];
    bannedStandsIndex: BannedStandsIndex;
}