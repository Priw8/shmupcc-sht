import { BinaryFileReader } from "./binary-reader.js";
import { DataType } from "./binary-types.js";
import { BinaryFileWriter } from "./binary-writer.js";

export interface StructFieldDef {
    name: string;
    type: DataType | Struct;
    count?: number; // set to > 1 for arrays
}

export type StructDef = StructFieldDef[];

interface StructValidationError {
    field: string;
    message: string;
}

function validationError(field: string, message: string) {
    return <StructValidationError>{
        field: field,
        message: message
    };
}

function intValueInRange(v: any, min: number, max: number) {
    return typeof v == "number" && v >= min && v <= max && Math.round(v) == v;
}

export class Struct {
    private def: StructDef;

    constructor(def: StructDef) {
        this.def = def;
    }

    private validateField(field: StructFieldDef, v: any, forcedOneCount = false): StructValidationError | null {
        if (!forcedOneCount && (field.count ?? 1) > 1) {
            if (!Array.isArray(v)) {
                return validationError(field.name, "array expected");
            }
            for (let i=0; i<v.length; ++i) {
                const entry = v[i];
                const err = this.validateField(field, entry, true);
                if (err) {
                    err.message += ` (at index ${i})`;
                    return err;
                }
            }
        }

        const type = field.type;

        if (typeof type == "object") {
            return type.validate(v);
        } else {
            switch(type) {
                case DataType.BYTE:
                    return intValueInRange(v, 0, 255) ? null : validationError(field.name, "BYTE must be an integer within <0,255>");
                case DataType.INT8:
                    return intValueInRange(v, -128, 127) ? null : validationError(field.name, "INT8 must be an integer within <-128,127>");
                case DataType.UINT16:
                    return intValueInRange(v, 0, 65535) ? null : validationError(field.name, "UINT16 must be an integer within <0,65535>");
                case DataType.INT16:
                    return intValueInRange(v, -32768, 32767) ? null : validationError(field.name, "INT16 must be an integer within <-32768,32767>");
                case DataType.UINT32:
                    return intValueInRange(v, 0, 4294967295) ? null : validationError(field.name, "UINT32 must be an integer within <0,4294967295>");
                case DataType.INT32:
                    return intValueInRange(v, -2147483648, 2147483647) ? null : validationError(field.name, "INT32 must be an integer within <-2147483648,2147483647>");
                case DataType.FLOAT:
                    return typeof v == "number" && !isNaN(v) ? null : validationError(field.name, "invalid FLOAT value");
                case DataType.DOUBLE:
                    return typeof v == "number" && !isNaN(v) ? null : validationError(field.name, "invalid FLOAT64 value");
            }
        }
        return null;
    }

    validate(data: any) {
        if (typeof data != "object") {
            return validationError("(none)", `passed value is not a struct at all`);
        }

        for (const field of this.def) {
            // Ignore unused fields
            if (field.name.startsWith("_")) {
                continue;
            }

            const v = data[field.name];
            if (typeof v == "undefined") {
                return validationError(field.name, "value is not defined");
            }

            const err = this.validateField(field, v);
            if (err) {
                return err;
            }
        }
        return null;
    }

    readFrom(reader: BinaryFileReader) {
        const res: Record<any, any> = {};
        for (const field of this.def) {
            const cnt = field.count ?? 1;
            if (cnt > 1) {
                let arr: any[] = [];
                for (let i=0; i<cnt; ++i) {
                    if (typeof field.type == "object") {
                        arr.push(field.type.readFrom(reader));
                    } else {
                        arr.push(reader.read(field.type));
                    }
                }
                if (!field.name.startsWith("_")) {
                    res[field.name] = arr;
                }
            } else {
                let val: any;
                if (typeof field.type == "object") {
                    val = field.type.readFrom(reader);
                } else {
                    val = reader.read(field.type);
                }
                if (!field.name.startsWith("_")) {
                    res[field.name] = val;
                }
            }
        }
        return res;
    }

    // Assumes that the data has been validated beforehand
    writeTo(writer: BinaryFileWriter, data: any) {
        for (const field of this.def) {
            if ((field.count ?? 1) > 1) {
                for (let v of data[field.name]) {
                    if (typeof field.type == "object") {
                        field.type.writeTo(writer, v ?? 0);
                    } else {
                        writer.write(field.type, v ?? 0);
                    }
                }
            } else {
                if (typeof field.type == "object") {
                    field.type.writeTo(writer, data[field.name] ?? 0);
                } else {
                    writer.write(field.type, data[field.name] ?? 0);
                }
            }
        }
    }
}
