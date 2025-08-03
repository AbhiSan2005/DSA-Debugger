const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/visualize', (req, res) => {
  const { code, language } = req.body;
  if (!code) { return res.status(400).json({ error: 'No code provided.' }); }
  
  if (language === 'python') { 
    const codeWithEpilogue = code + "\npass";
    visualizePython(codeWithEpilogue, res); 
  } 
  else if (language === 'cpp') { 
    visualizeCpp(code, res); 
  } 
  else { res.status(400).json({ error: 'Unsupported language specified.' }); }
});

// --- C++ Visualization Logic with GDB ---
function visualizeCpp(code, res) {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const tempDir = path.join(os.tmpdir(), `cpp-visualizer-${uniqueId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const cppFilePath = path.join(tempDir, 'main.cpp');
    fs.writeFileSync(cppFilePath, code);

    const gdbScriptContent = `
set pagination off
set confirm off
set print elements 0
file /app/main.out
rbreak main.cpp:.
run
while 1
  printf "---STEP_START---\\n"
  frame
  info locals
  printf "---STEP_END---\\n"
  next
end
    `;
    const gdbScriptPath = path.join(tempDir, 'gdb_script.txt');
    fs.writeFileSync(gdbScriptPath, gdbScriptContent);

    const dockerfileContent = `
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y build-essential gdb
WORKDIR /app
COPY . .
RUN g++ main.cpp -o main.out -std=c++17 -g
    `;
    const dockerfilePath = path.join(tempDir, 'Dockerfile');
    fs.writeFileSync(dockerfilePath, dockerfileContent);
    
    const imageName = `visualizer-cpp-${uniqueId}`;
    const command = `docker build -t ${imageName} "${tempDir}" && docker run --rm ${imageName} gdb -batch -x gdb_script.txt`;

    exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        fs.rmSync(tempDir, { recursive: true, force: true });

        if (error && !stdout) {
            console.error(`Docker exec error: ${error}`);
            if (stderr.includes('g++:') || stderr.includes('error:')) {
                 return res.json({ trace: [{ error: `Compilation Error:\n\n${stderr}` }] });
            }
            return res.json({ trace: [{ error: `Execution Error:\n\n${stderr || error.message}` }] });
        }
        
        const trace = parseGdbOutput(stdout);
        res.json({ trace });
    });
}

// --- GDB Output Parser (REWRITTEN for Initializer Lists) ---
function parseGdbOutput(gdbOutput) {
    let trace = [];
    const steps = gdbOutput.split('---STEP_START---');
    
    const lineRegex = /main\.cpp:(\d+)/;
    // --- NEW: More robust regex for parsing multi-line variable assignments ---
    const localsRegex = /^([a-zA-Z_][\w]*) = ([\s\S]*?)(?=\n[a-zA-Z_]|\n---STEP_END---)/gm;
    
    const variableBlacklist = new Set([
        'unwind_buf', 'not_first_call', 'cancel_jmp_buf', 'mask_was_saved', 
        'priv', 'pad', 'data', 'prev', 'cleanup', 'canceltype', 'jm', 'addrs', 
        'l', 'init_array', 'result', 'j'
    ]);

    let lastLocals = {};
    let hasFoundMain = false;

    for (const step of steps) {
        if (!step.trim()) continue;

        if (!hasFoundMain && step.includes('main () at main.cpp')) {
            hasFoundMain = true;
        }
        if (!hasFoundMain) {
            continue;
        }

        const lineMatch = step.match(lineRegex);
        if (!lineMatch) continue;

        const line = parseInt(lineMatch[1], 10);
        const currentLocals = {};
        
        let match;
        localsRegex.lastIndex = 0; 
        while ((match = localsRegex.exec(step)) !== null) {
            const varName = match[1];
            if (variableBlacklist.has(varName)) {
                continue;
            }

            let value = match[2].trim().replace(/,\s*$/, "");
            
            if (value.startsWith('std::')) {
                const containerMatch = value.match(/{([\s\S]*)}/);

                if (value.includes('stack') || value.includes('queue')) {
                    if (containerMatch) {
                        const elements = containerMatch[1].split(',').map(el => el.trim()).filter(Boolean);
                        let type = 'container';
                        if (value.includes('stack')) type = 'stack';
                        if (value.includes('queue')) type = 'queue';
                        if (value.includes('priority_queue')) type = 'priority_queue';
                        value = { _type: type, values: elements };
                    }
                }
                else if (containerMatch) {
                    const elements = containerMatch[1].split(',').map(el => el.trim()).filter(Boolean);
                    
                    if (value.includes('string')) {
                        const stringMatch = value.match(/"(.*?)"/);
                        if (stringMatch) { value = { _type: 'string', value: stringMatch[1] }; }
                    }
                    else if (value.includes('vector')) { value = { _type: 'vector', values: elements }; }
                    else if (value.startsWith('std::deque')) { value = { _type: 'deque', values: elements }; }
                    else if (value.startsWith('std::list')) {
                        const listElements = elements.map(el => {
                            const parts = el.split('=');
                            return parts.length > 1 ? parts[1].trim() : el.trim();
                        });
                        value = { _type: 'list', values: listElements };
                    }
                    else if (value.includes('set')) {
                        const type = value.includes('multiset') ? 'multiset' : 'set';
                        const setType = value.includes('unordered') ? `unordered_${type}` : type;
                        value = { _type: setType, values: elements };
                    }
                    else if (value.includes('map')) {
                        const content = containerMatch[1];
                        const mapValues = {};
                        if (content) {
                            const pairRegex = /\[(.*?)\] = (.*?)(, |$)/g;
                            let pairMatch; let keyCounter = 0;
                            while((pairMatch = pairRegex.exec(content)) !== null) {
                                let key = pairMatch[1].replace(/"/g, '');
                                const val = pairMatch[2];
                                if (value.includes('multimap') && mapValues[key]) {
                                    key = `${key}_${keyCounter++}`;
                                }
                                mapValues[key] = val;
                            }
                        }
                        const type = value.includes('multimap') ? 'multimap' : 'map';
                        const mapType = value.includes('unordered') ? `unordered_${type}` : type;
                        value = { _type: mapType, values: mapValues };
                    }
                    else if (value.startsWith('std::pair')) {
                        const pairMatch = value.match(/first = (.*?), second = (.*)/s);
                        if(pairMatch) { value = { _type: 'pair', first: pairMatch[1].trim(), second: pairMatch[2].trim() }; }
                    }
                    else if (value.startsWith('std::tuple')) { value = { _type: 'tuple', values: elements }; }
                }
                else if (value.startsWith('std::bitset')) {
                    const sizeMatch = value.match(/<(\d+)>/);
                    const bitsMatch = value.match(/= ([01]+)/);
                    if (sizeMatch) {
                        const size = parseInt(sizeMatch[1], 10);
                        let bits = [];
                        if (bitsMatch) {
                            bits = bitsMatch[1].padStart(size, '0').split('');
                        } else {
                            bits = Array(size).fill('0');
                        }
                        value = { _type: 'bitset', values: bits };
                    }
                }
            } else {
                 value = value.replace(/<.*?>/g, '').trim();
            }
            
            currentLocals[varName] = value;
        }

        const combinedLocals = { ...lastLocals, ...currentLocals };
        const lastStep = trace[trace.length - 1];
        const hasStateChanged = !lastStep || JSON.stringify(lastStep.locals) !== JSON.stringify(combinedLocals);

        if (!lastStep || lastStep.line !== line || hasStateChanged) {
             trace.push({
                line,
                event: 'line',
                locals: combinedLocals,
                output: '' 
            });
            lastLocals = combinedLocals;
        }
    }
    
    if (gdbOutput.includes('Inferior exit')) {
        trace.pop();
    }

    if (trace.length > 0) {
        trace.push({ ...trace[trace.length - 1], event: 'end' });
    }

    return trace;
}


// --- Python Visualization Logic (Unchanged) ---
function visualizePython(code, res) {
  const tempTracerPath = path.join(os.tmpdir(), `tracer_${Date.now()}.py`);
  const tracerScript = `
import sys, json, io, types
def serialize_object(obj, visited=None):
    if visited is None: visited = set()
    if isinstance(obj, (int, float, str, bool, type(None))): return obj
    obj_id = id(obj)
    if obj_id in visited: return {"_type": "circular_ref", "id": obj_id}
    visited.add(obj_id)
    if isinstance(obj, types.ModuleType): return {"_type": "module", "id": obj_id, "name": obj.__name__}
    elif isinstance(obj, list): return {"_type": "list", "id": obj_id, "values": [serialize_object(item, visited) for item in obj]}
    elif isinstance(obj, tuple): return {"_type": "tuple", "id": obj_id, "values": [serialize_object(item, visited) for item in obj]}
    elif isinstance(obj, set): return {"_type": "set", "id": obj_id, "values": [serialize_object(item, visited) for item in sorted(list(obj), key=lambda x: str(x))]}
    elif isinstance(obj, dict): return {"_type": "dict", "id": obj_id, "values": {str(k): serialize_object(v, visited) for k, v in obj.items()}}
    elif callable(obj):
        try: name = obj.__name__
        except AttributeError: name = "unknown_callable"
        return {"_type": "function", "id": obj_id, "name": name}
    elif hasattr(obj, '__dict__'):
        attrs = vars(obj)
        obj_type = 'object'
        if 'val' in attrs and 'next' in attrs and 'left' not in attrs: obj_type = 'linked_list_node'
        elif 'val' in attrs and 'left' in attrs and 'right' in attrs: obj_type = 'tree_node'
        return {"_type": obj_type, "id": obj_id, "class_name": obj.__class__.__name__, "attributes": {k: serialize_object(v, visited) for k, v in attrs.items()}}
    else: return {"_type": "unknown", "id": obj_id, "repr": repr(obj)}
trace, user_stdout, original_stdout = [], io.StringIO(), sys.stdout
def tracer(frame, event, arg):
    if event == 'line':
        if frame.f_code.co_filename != "<string>": return tracer
        local_vars = {k: serialize_object(v) for k, v in frame.f_locals.items() if not k.startswith('__')}
        trace.append({"line": frame.f_lineno, "event": event, "locals": local_vars, "output": user_stdout.getvalue()})
        user_stdout.seek(0); user_stdout.truncate(0)
    return tracer
sys.stdout = user_stdout; sys.settrace(tracer)
try: exec(compile(${JSON.stringify(code)}, "<string>", "exec"), {})
except Exception as e: trace.append({"error": str(e)})
finally: sys.stdout = original_stdout; sys.settrace(None)
print(json.dumps({"trace": trace}))
  `;
  fs.writeFileSync(tempTracerPath, tracerScript);
  const pythonProcess = spawn('python', [tempTracerPath]);
  let output = '';
  let errorOutput = '';
  pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
  pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
  pythonProcess.on('error', (err) => {
    res.status(500).json({ error: `Failed to start Python process.` });
    fs.unlinkSync(tempTracerPath);
  });
  pythonProcess.on('close', (exitCode) => {
    fs.unlinkSync(tempTracerPath);
    if (exitCode !== 0) { return res.status(500).json({ error: errorOutput || 'Python script execution failed.' }); }
    try { res.json(JSON.parse(output)); } 
    catch (e) { res.status(500).json({ error: 'Failed to parse the final JSON output from the Python script.' }); }
  });
}

app.listen(port, () => {
  console.log(`Code visualizer backend listening at http://localhost:${port}`);
});