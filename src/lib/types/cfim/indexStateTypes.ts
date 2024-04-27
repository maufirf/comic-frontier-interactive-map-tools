import { DataIdentifierType, DataInstance, DataInstanceType } from "./commonTypes";

export interface InstanceWithIdentifierIndexState<T> {
    // Key must be either UUID or Code
    [key:string]: T | undefined;
}

export interface InstanceIndexState<T> {
    uuid: InstanceWithIdentifierIndexState<T>;
    code: InstanceWithIdentifierIndexState<T>;
}

type DataIndexState = {
    [instance in DataInstanceType]: InstanceIndexState<DataInstance>
}

// Types and interfaces for reducer action payload

interface DataIndexPayloadAsInstanceTypeRequired {
    indexInstanceType: DataInstanceType;
}

interface DataIndexPayloadAsIdentifierTypeRequired extends DataIndexPayloadAsInstanceTypeRequired {
    indexIdentifierType: DataIdentifierType;
}

interface DataIndexPayloadAsIdentifierRequired extends DataIndexPayloadAsIdentifierTypeRequired {
    indexIdentifier: string;
}

interface SetDataIndexPayload<T> {
    payload: InstanceIndexState<T>;
}

export interface RegisterDataIndexPayload extends DataIndexPayloadAsIdentifierRequired {
    payload: DataInstance;
}