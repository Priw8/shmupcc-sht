import { exit, loadFile, open as fopen, out } from "std";
import { ShtReaders, ShtWriters } from "./versions.js";

const argv0 = scriptArgs[0];

if (scriptArgs.length != 5) {
    print(
`Usage: ${argv0} [-c | -d] VERSION INPUT OUTPUT`
    );
    exit(1);
}

const mode = scriptArgs[1];
const version = scriptArgs[2];
const input = scriptArgs[3];
const output = scriptArgs[4];

// TODO: IO error handling

if (mode == "-c") {
    const writer = ShtWriters[version];
    if (!writer) {
        print(`${argv0}: no writer found for version ${version}`);
        exit(1);
    }

    const w = new writer(loadFile(input) ?? "");
    if (w.wasError) {
        exit(1);
    }
    const result = w.toBuffer();
    const out = fopen(output, "wb");
    if (out) {
        out.write(result, 0, result.byteLength);
        out.close();
    }
} else if (mode == "-d") {
    const reader = ShtReaders[version];
    if (!reader) {
        print(`${argv0}: no reader found for version ${version}`);
        exit(1);
    }
    
    const r = new reader(input);
    const result = r.toJSON();
    // print(result);
    const out = fopen(output, "w");
    if (out) {
        out.puts(result);
        out.close();
    }
} else {
    print(`${argv0}: unknown mode: ${mode}`);
}
