const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/visualize', (req, res) => {
  const { code, language } = req.body;
  if (!code) { return res.status(400).json({ error: 'No code provided.' }); }
  if (language === 'python') { 
    // This 'pass' statement ensures the tracer has one final line to execute,
    // allowing it to capture the state *after* the user's last line has run.
    const codeWithEpilogue = code + "\npass";
    visualizePython(codeWithEpilogue, res); 
  } 
  else if (language === 'cpp') { visualizeCpp(code, res); } 
  else { res.status(400).json({ error: 'Unsupported language specified.' }); }
});

function visualizePython(code, res) {
  const tempTracerPath = path.join(os.tmpdir(), `tracer_${Date.now()}.py`);
  const tracerScript = `
import sys
import json
import io
import types

# This function recursively serializes Python objects into a JSON-friendly format.
def serialize_object(obj, visited=None):
    if visited is None:
        visited = set()

    # Check for primitive types FIRST to prevent string interning from causing false circular reference errors.
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj

    obj_id = id(obj)
    if obj_id in visited:
        return {"_type": "circular_ref", "id": obj_id}
    
    # Add to visited set only AFTER we've confirmed it's a complex object.
    visited.add(obj_id)

    if isinstance(obj, types.ModuleType):
        return {"_type": "module", "id": obj_id, "name": obj.__name__}
    elif isinstance(obj, list):
        return {"_type": "list", "id": obj_id, "values": [serialize_object(item, visited) for item in obj]}
    elif isinstance(obj, tuple):
        return {"_type": "tuple", "id": obj_id, "values": [serialize_object(item, visited) for item in obj]}
    elif isinstance(obj, set):
        return {"_type": "set", "id": obj_id, "values": [serialize_object(item, visited) for item in sorted(list(obj), key=lambda x: str(x))]}
    elif isinstance(obj, dict):
        return {"_type": "dict", "id": obj_id, "values": {str(k): serialize_object(v, visited) for k, v in obj.items()}}
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
    else:
        return {"_type": "unknown", "id": obj_id, "repr": repr(obj)}

trace = []
user_stdout = io.StringIO()
original_stdout = sys.stdout

def tracer(frame, event, arg):
    if event == 'line':
        line_no = frame.f_lineno
        if frame.f_code.co_filename != "<string>": return tracer
        local_vars = {k: serialize_object(v) for k, v in frame.f_locals.items() if not k.startswith('__')}
        captured_output = user_stdout.getvalue()
        trace.append({"line": line_no, "event": event, "locals": local_vars, "output": captured_output})
        user_stdout.seek(0)
        user_stdout.truncate(0)
    return tracer

sys.stdout = user_stdout
sys.settrace(tracer)
try:
    exec(compile(${JSON.stringify(code)}, "<string>", "exec"), {})
except Exception as e:
    trace.append({"error": str(e)})
finally:
    sys.stdout = original_stdout
    sys.settrace(None)
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
    try { 
        const result = JSON.parse(output);
        // --- FIX: The result.trace.pop() line has been removed ---
        // We now send the complete trace, including the final state.
        res.json(result);
    } 
    catch (e) { res.status(500).json({ error: 'Failed to parse the final JSON output from the Python script.' }); }
  });
}

function visualizeCpp(code, res) {
  res.status(501).json({ error: 'C++ visualization is not yet implemented.' });
}

app.listen(port, () => {
  console.log(`Code visualizer backend listening at http://localhost:${port}`);
});