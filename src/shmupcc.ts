import { parseExtJSON, strerror } from "std";
import { BinaryFileReader } from "./binary-reader.js";
import { ShtReader } from "./versions.js";
import { Struct } from "./struct.js";
import { DataType, Endianess } from "./binary-types.js";
import { BinaryFileWriter } from "./binary-writer.js";

export class ShmupCCReaderError extends Error {
    constructor(msg: string, opt?: ErrorOptions) {
        super(`ShmupCCReaderError: ${msg}`, opt);
    }
}

function throwError(msg: string) {
    throw new ShmupCCReaderError(msg);
}

const header_t = new Struct([
    {name: "version_num", type: DataType.INT16},
    {name: "num_shootersets", type: DataType.INT16},
    {name: "dmg_cap_type", type: DataType.INT16},
    {name: "dmg_cap_val", type: DataType.INT16},
    {name: "hitbox", type: DataType.FLOAT64},
    {name: "grazebox", type: DataType.FLOAT64},
    {name: "itembox", type: DataType.FLOAT64},
    {name: "move_uf", type: DataType.FLOAT64},
    {name: "move_f", type: DataType.FLOAT64},
    {name: "option_behavior", type: DataType.UINT16},
    {name: "num_power_levels", type: DataType.BYTE},
    {name: "deathbomb_window", type: DataType.BYTE},
    {name: "option_move_type", type: DataType.BYTE},
    {name: "num_static_options", type: DataType.BYTE},
    {name: "_unused1", type: DataType.BYTE},
    {name: "_unused2", type: DataType.BYTE},
]);

const option_t = new Struct([
    {name: "x", type: DataType.FLOAT64},
    {name: "y", type: DataType.FLOAT64}
]);

const shooter_t = new Struct([
    {name: "fire_rate", type: DataType.INT16},
    {name: "start_delay", type: DataType.INT16},
    {name: "damage", type: DataType.INT32},
    {name: "off_x", type: DataType.FLOAT64},
    {name: "off_y", type: DataType.FLOAT64},
    {name: "hitbox", type: DataType.FLOAT64},
    {name: "angle", type: DataType.FLOAT64},
    {name: "speed", type: DataType.FLOAT64},
    {name: "size", type: DataType.FLOAT64},
    {name: "option", type: DataType.BYTE},
    {name: "anim", type: DataType.BYTE},
    {name: "anim_hit", type: DataType.BYTE},
    {name: "sfx", type: DataType.BYTE},
    {name: "func_init", type: DataType.UINT32},
    {name: "func_tick", type: DataType.UINT32},
    {name: "func_draw", type: DataType.UINT32},
    {name: "func_hit", type: DataType.UINT32},
    {name: "_unused3", type: DataType.INT32},
])

export class ShmupCCReader {
    private reader: BinaryFileReader;
    private result: Record<any, any> = {};

    constructor(filename: string) {
        this.reader = new BinaryFileReader(1024, Endianess.BIG_ENDIAN);
        const errno = this.reader.open(filename);
        if (errno) {
            throwError(strerror(errno));
        }

        this.readSht();
    }

    private readHeader() {
        this.result.header = header_t.readFrom(this.reader);
    }
    private readOptions() {
        const options: Record<any, any> = {};
        const isStaticOptionCount = this.result.header.num_static_options != 0;
        if (isStaticOptionCount) {
            options.all_power = {
                unfocused: [],
                focused: []
            }
            const p = options.all_power;
            const numOptions = this.result.header.num_static_options & 0b01111111;
            for (let i=0; i<numOptions; ++i) {
                p.unfocused.push(option_t.readFrom(this.reader));
            }
            for (let i=0; i<numOptions; ++i) {
                p.focused.push(option_t.readFrom(this.reader));
            }
        } else {
            for (let pwr=1; pwr<=this.result.header.num_power_levels; ++pwr) {
                const key = `power_${pwr}`;
                options[key] = {
                    unfocused: [],
                    focused: []
                }
                for (let i=0; i<pwr; ++i) {
                    options[key].unfocused.push(option_t.readFrom(this.reader));
                }
            }
            for (let pwr=1; pwr<=this.result.header.num_power_levels; ++pwr) {
                const key = `power_${pwr}`;
                for (let i=0; i<pwr; ++i) {
                    options[key].focused.push(option_t.readFrom(this.reader));
                }
            }
        }
        this.result.options = options;
    }
    private readShooters() {
        const numShootersets = this.result.header.num_shootersets;
        const shootersetCounts: number[] = [];
        for (let i=0; i<numShootersets; ++i) {
            shootersetCounts.push(this.reader.readUint16());
        }
        
        const shootersets: Record<any, any> = {};
        const numPowerLevels = this.result.header.num_power_levels;
        for (let pwr=1; pwr<=numPowerLevels; ++pwr) {
            const unfocusedCount = shootersetCounts[(pwr-1)*2];
            const focusedCount = shootersetCounts[(pwr-1)*2 + 1];
            const key = `power_${pwr}`;
            shootersets[key] = {
                unfocused: [],
                focused: []
            }
            for (let i=0; i<unfocusedCount; ++i) {
                shootersets[key].unfocused.push(shooter_t.readFrom(this.reader));
            }
            for (let i=0; i<focusedCount; ++i) {
                shootersets[key].focused.push(shooter_t.readFrom(this.reader));
            }
        }
        this.result.shootersets = shootersets;
    }

    private clean() {
        delete this.result.header.num_shootersets;
        delete this.result.header.num_static_options;
    }

    private readSht() {
        this.readHeader();
        this.readOptions();
        this.readShooters();
        this.clean();
        this.reader.close();
    }

    toJSON(): string {
        return JSON.stringify(this.result, null, 4);
    }
}

export class ShmupCCWriter {
    private data: any;
    private writer: BinaryFileWriter;
    wasError = false;

    constructor(json: string) {
        this.data = parseExtJSON(json);
        this.writer = new BinaryFileWriter(1024, Endianess.BIG_ENDIAN);
        
        this.writeSht();
    }
    // Assumes valid header
    private getNumShootersets() {
        return this.data.header.num_power_levels * 2;
    }
    // Assumes valid option data
    private getNumStaticOptions() {
        const isStaticOptionCount = typeof this.data.options.all_power != "undefined";
        if (isStaticOptionCount) {
            let res = this.data.options.all_power.unfocused.length | 0x80;
            return res;
        } else {
            return 0;
        }
    }
    private validateOptionSet(name: string) {
        if (typeof this.data.options[name] != "object") {
            print(`error in sht options: ${name} does not exist or is an invalid value`);
            return false;
        }

        if (!Array.isArray(this.data.options[name].unfocused)) {
            print(`error in sht options: ${name}.unfocused is not an array`);
            return false;
        } else {
            for (const opt of this.data.options[name].unfocused) {
                const err = option_t.validate(opt);
                if (err) {
                    print(`error in sht options in ${name}.unfocused: field ${err.field}: ${err.message}`);
                    return false;
                }
            }
        }
        if (!Array.isArray(this.data.options[name].focused)) {
            print(`error in sht options: ${name}.focused is not an array`);
            return false;
        } else {
            for (const opt of this.data.options[name].focused) {
                const err = option_t.validate(opt);
                if (err) {
                    print(`error in sht options in ${name}.focused: field ${err.field}: ${err.message}`);
                    return false;
                }
            }
        }

        if (this.data.options[name].unfocused.length != this.data.options[name].focused.length) {
            print(`error in sht options in ${name}: focused and unfocused count does not match`);
            return false;
        }
        return true;
    }
    private validateShooterset(name: string) {
        if (typeof this.data.shootersets[name] != "object") {
            print(`error in sht shootersets: ${name} does not exist or is an invalid value`);
            return false;
        }

        if (!Array.isArray(this.data.shootersets[name].unfocused)) {
            print(`error in sht shootersets: ${name}.unfocused is not an array`);
            return false;
        } else {
            for (const sht of this.data.shootersets[name].unfocused) {
                const err = shooter_t.validate(sht);
                if (err) {
                    print(`error in sht shootersets in ${name}.unfocused: field ${err.field}: ${err.message}`);
                    return false;
                }
            }
        }
        if (!Array.isArray(this.data.shootersets[name].focused)) {
            print(`error in sht shootersets: ${name}.focused is not an array`);
            return false;
        } else {
            for (const sht of this.data.shootersets[name].focused) {
                const err = shooter_t.validate(sht);
                if (err) {
                    print(`error in sht shootersets in ${name}.focused: field ${err.field}: ${err.message}`);
                    return false;
                }
            }
        }

        return true;
    }
    private validate() {
        // Validate header
        // These 2 fields will be filled later, but they need to exist for the validation
        this.data.header.num_shootersets = 0
        this.data.header.num_static_options = 0;
        const headerError = header_t.validate(this.data.header);
        if (headerError) {
            print(`error in sht header: field ${headerError.field}: ${headerError.message}`);
            return false;
        }

        // We now know that the header fields exist, so we can use them for further validation
        const power = this.data.header.num_power_levels;

        // Validate options
        if (typeof this.data.options != "object") {
            print(`error in sht options: option data is missing`);
            return false;
        }
        if (this.data.options.all_power) {
            // If all_power is set, it must be the only key
            if (Object.keys(this.data.options).length != 1) {
                print(`error in sht options: all_power forbids other keys in the option object`);
                return false;
            }
            if (!this.validateOptionSet("all_power")) {
                return false;
            }
        } else {
            // Otherwise, we expect to find power_1, power_2 etc based on num_power_levels
            for (let pwr=1; pwr<=power; ++pwr) {
                const key = `power_${pwr}`;
                if (!this.validateOptionSet(key)) {
                    return false;
                }
                if (this.data.options[key].focused.length != pwr) {
                    print(`error in sht options: ${key}: exactly ${pwr} options are required`);
                }
            }
        }

        // With validated options, we can fill this in safely
        this.data.header.num_static_options = this.getNumStaticOptions();

        // This just uses power to acquire the expected amount
        this.data.header.num_shootersets = this.getNumShootersets();

        for (let pwr=1; pwr<=power; ++pwr) {
            const key = `power_${pwr}`;
            if (!this.validateShooterset(key)) {
                return false;
            }
        }


        return true;
    }
    private writeHeader() {
        header_t.writeTo(this.writer, this.data.header);
    }
    private writeOptionSet(name: string, subset: string) {
        const set = this.data.options[name][subset];
        for (let opt of set) {
            option_t.writeTo(this.writer, opt);
        }
    }
    private writeOptions() {
        if (this.data.options.all_power) {
            this.writeOptionSet("all_power", "unfocused");
            this.writeOptionSet("all_power", "focused");
        } else {
            for (let pwr=1; pwr<=this.data.header.num_power_levels; ++pwr) {
                this.writeOptionSet(`power_${pwr}`, "unfocused");
            }
            for (let pwr=1; pwr<=this.data.header.num_power_levels; ++pwr) {
                this.writeOptionSet(`power_${pwr}`, "focused");
            }
        }
    }
    private writeShooters() {
        for (let pwr=1; pwr<=this.data.header.num_power_levels; ++pwr) {
            this.writer.writeInt16(this.data.shootersets[`power_${pwr}`].unfocused.length);
            this.writer.writeInt16(this.data.shootersets[`power_${pwr}`].focused.length);
        }

        for (let pwr=1; pwr<=this.data.header.num_power_levels; ++pwr) {
            for (const sht of this.data.shootersets[`power_${pwr}`].unfocused) {
                shooter_t.writeTo(this.writer, sht);
            }
            for (const sht of this.data.shootersets[`power_${pwr}`].focused) {
                shooter_t.writeTo(this.writer, sht);
            }
        }
    }
    private writeSht() {
        if (!this.validate()) {
            this.wasError = true;
            return;
        }
        this.writeHeader();
        this.writeOptions();
        this.writeShooters();
    }
    toBuffer() {
        return this.writer.getBuffer();
    }
}
