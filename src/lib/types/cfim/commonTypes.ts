import { CircleState } from "./circleStateTypes";
import { FandomState } from "./fandomStateTypes";
import { StandState } from "./standStateTypes";

export interface CommonMapDataInterface {
    displayName: string;
    uuid?: string;
    code?: string;
}

export type DayInt = 1|2;
export type DayKey = `day${DayInt}`;
export const dayKeys:DayKey[] = ["day1","day2"];
export const dayInts:DayInt[] = [1,2];

export type DataInstanceType = "circle" | "fandom" | "stand";
export type DataIdentifierType = "uuid" | "code"
export type DataInstance = CircleState | FandomState | StandState; // this is the "legalize nuclear bombs" if this caused a circular import lmao

export type AttendanceIdentifiers = {[day in DayKey]?: string[]}

export interface StringKeyIndex<T> {
    [key:string]: T
}