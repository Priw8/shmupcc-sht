import { ErrorObj, FILE, FILEResult, SEEK_SET, open as fopen } from "std";
import { DataType, Endianess } from "./binary-types.js";

export class BinaryFileReaderError extends Error {
    constructor(msg: string, opt?: ErrorOptions) {
        super(`BinaryFileReaderError: ${msg}`, opt);
    }
}

function throwError(msg: string) {
    throw new BinaryFileReaderError(msg);
}

export class BinaryFileReader {
    private file: FILEResult = null;
    private seek: number = 0;
    private buffer: ArrayBuffer;
    private view: DataView;
    private littleEndian: boolean;

    constructor(bufferLength = 1024, endianess: Endianess = Endianess.LITTLE_ENDIAN) {
        this.buffer = new ArrayBuffer(bufferLength);
        this.view = new DataView(this.buffer);
        this.littleEndian = endianess == Endianess.LITTLE_ENDIAN;
    }

    open(filename: string) {
        const r: ErrorObj = {};
        this.file = fopen(filename, "rb", r);

        this.seek = 0;
        
        return r.errno ?? 0;
    }
    close() {
        if (this.file) {
            this.file.close();
        }
    }

    private rawRead(byteCount: number) {
        if (!this.file) {
            throwError(`rawRead: no file loaded`);
        }
        this.file!.seek(this.seek, SEEK_SET);
        this.file!.read(this.buffer, 0, byteCount);
        this.seek += byteCount;
    }

    read(type: DataType) {
        switch(type) {
            case DataType.UINT8:
                return this.readByte();
            case DataType.INT8:
                return this.readInt8();
            case DataType.UINT16:
                return this.readUint16();
            case DataType.INT16:
                return this.readInt16();
            case DataType.UINT32:
                return this.readUint32();
            case DataType.INT32:
                return this.readInt32();
            case DataType.UINT64:
                return this.readUint64();
            case DataType.INT64:
                return this.readInt64();
            case DataType.FLOAT32:
                return this.readFloat();
            case DataType.FLOAT64:
                return this.readFloat64();
        }
        throwError(`Unknown or unsupported DataType: ${type}`);
    }

    readByte() {
        this.rawRead(1);
        return this.view.getUint8(0);
    }

    readInt8() {
        this.rawRead(1);
        return this.view.getInt8(0);
    }

    readInt16() {
        this.rawRead(2);
        return this.view.getInt16(0, this.littleEndian);
    }

    readUint16() {
        this.rawRead(2);
        return this.view.getUint16(0, this.littleEndian);
    }

    readInt32() {
        this.rawRead(4);
        return this.view.getInt32(0, this.littleEndian);
    }

    readUint32() {
        this.rawRead(4);
        return this.view.getUint32(0, this.littleEndian);
    }

    readInt64() {
        this.rawRead(8);
        return this.view.getBigInt64(0, this.littleEndian);
    }

    readUint64() {
        this.rawRead(8);
        return this.view.getBigUint64(0, this.littleEndian);
    }

    readFloat() {
        this.rawRead(4);
        return this.view.getFloat32(0, this.littleEndian);
    }

    readFloat64() {
        this.rawRead(8);
        return this.view.getFloat64(0, this.littleEndian);
    }
}
