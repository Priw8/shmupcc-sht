import { ShmupCCReader, ShmupCCWriter } from "./shmupcc.js";

export class ShtReader {
    constructor(filename: string) {};
    toJSON(): string {return ""};
}

export class ShtWriter {
    wasError: boolean = false;
    constructor(json: string) {};
    toBuffer(): ArrayBuffer {return new ArrayBuffer(1024)};
}


export const ShtReaders: Record<string, typeof ShtReader> = {
    "shmupcc": ShmupCCReader
}

export const ShtWriters: Record<string, typeof ShtWriter> = {
    "shmupcc": ShmupCCWriter
}
