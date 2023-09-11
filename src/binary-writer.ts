import { DataType, Endianess } from "./binary-types.js";

export class BinaryFileWriterError extends Error {
    constructor(msg: string, opt?: ErrorOptions) {
        super(`BinaryFileWriterError: ${msg}`, opt);
    }
}

function throwError(msg: string) {
    throw new BinaryFileWriterError(msg);
}

export class BinaryFileWriter {
    private seek: number = 0;
    private buffer: ArrayBuffer;
    private view: DataView;
    private littleEndian: boolean;
    constructor(bufferLength = 1024, endianess: Endianess = Endianess.LITTLE_ENDIAN) {
        this.buffer = new ArrayBuffer(bufferLength);
        this.view = new DataView(this.buffer);
        this.littleEndian = endianess == Endianess.LITTLE_ENDIAN;
    }

    seekForward(amount: number) {
        this.seek += amount;
        if (this.seek + 8 >= this.buffer.byteLength) {
            const expandedBuffer = new ArrayBuffer(this.buffer.byteLength + 1024);
            // Copy existing data into the new buffer
            new Uint8Array(expandedBuffer).set(new Uint8Array(this.buffer));
            this.buffer = expandedBuffer;
        }
    }

    write(type: DataType, val: number) {
        switch(type) {
            case DataType.UINT8:
                return this.writeByte(val);
            case DataType.INT8:
                return this.writeInt8(val);
            case DataType.UINT16:
                return this.writeUint16(val);
            case DataType.INT16:
                return this.writeInt16(val);
            case DataType.UINT32:
                return this.writeUint32(val);
            case DataType.INT32:
                return this.writeInt32(val);
            case DataType.FLOAT32:
                return this.writeFloat(val);
            case DataType.FLOAT64:
                return this.writeFloat64(val);
        }
        throwError(`Unknown or unsupported DataType: ${type}`);
    }

    writeByte(val: number) {
        this.view.setUint8(this.seek, val);
        this.seekForward(1);
    }

    writeInt8(val: number) {
        this.view.setInt8(this.seek, val);
        this.seekForward(1);
    }

    writeInt16(val: number) {
        this.view.setInt16(this.seek, val, this.littleEndian);
        this.seekForward(2);
    }

    writeUint16(val: number) {
        this.view.setUint16(this.seek, val, this.littleEndian);
        this.seekForward(2);
    }

    writeInt32(val: number) {
        this.view.setInt32(this.seek, val, this.littleEndian);
        this.seekForward(4);
    }

    writeUint32(val: number) {
        this.view.setUint32(this.seek, val, this.littleEndian);
        this.seekForward(4);
    }

    writeInt64(val: bigint) {
        this.view.setBigInt64(this.seek, val, this.littleEndian);
        this.seekForward(8);
    }

    writeUint64(val: bigint) {
        this.view.setBigUint64(this.seek, val, this.littleEndian);
        this.seekForward(8);
    }

    writeFloat(val: number) {
        this.view.setFloat32(this.seek, val, this.littleEndian);
        this.seekForward(4);
    }

    writeFloat64(val: number) {
        this.view.setFloat64(this.seek, val, this.littleEndian);
        this.seekForward(8);
    }

    getBuffer() {
        return this.buffer.slice(0, this.seek);
    }
}
