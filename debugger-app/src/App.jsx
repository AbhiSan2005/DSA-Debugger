import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Rewind, SkipBack, SkipForward, FastForward, Play, Pause } from 'lucide-react';

// --- Import New Components ---
import AnimatedList from './components/AnimatedList';
import Counter from './components/Counter';
import Dock from './components/Dock';

// --- Main App Component ---
export default function App() {
  const [code, setCode] = useState(
`# Definition for a binary tree node.
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# Build a simple binary tree
root = TreeNode(4)
root.left = TreeNode(2)
root.right = TreeNode(7)
root.left.left = TreeNode(1)
root.left.right = TreeNode(3)
root.right.left = TreeNode(6)
root.right.right = TreeNode(9)

traversal_result = []
# In-order traversal
def inorder_traversal(node):
    if node:
        inorder_traversal(node.left)
        traversal_result.append(node.val)
        inorder_traversal(node.right)

inorder_traversal(root)
`
  );
  const [language, setLanguage] = useState('python');
  const [trace, setTrace] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [isStepListOpen, setIsStepListOpen] = useState(false);
  const intervalRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationRef = useRef([]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prevStep => {
          if (prevStep >= trace.length - 1) {
            setIsPlaying(false);
            return prevStep;
          }
          return prevStep + 1;
        });
      }, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, trace.length]);

  useEffect(() => {
    if (editorRef.current && trace.length > 0 && monacoRef.current) {
      const line = trace[currentStep]?.line;
      if (!line) return;
      decorationRef.current = editorRef.current.deltaDecorations(decorationRef.current, [{
        range: new monacoRef.current.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'bg-purple-900/50 border-l-4 border-purple-500' },
      }]);
      editorRef.current.revealLineInCenter(line);
    }
  }, [currentStep, trace]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }

  async function visualizeCode() {
    setIsPlaying(false);
    setIsLoading(true);
    setTrace([]);
    setCurrentStep(0);
    if (!editorRef.current) { setIsLoading(false); return; }
    const sourceCode = editorRef.current.getValue();
    try {
      const response = await fetch('http://localhost:3001/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sourceCode, language }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Server error');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTrace(data.trace || []);
    } catch (error) {
      setTrace([{ error: `Visualization failed: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleStep = (newStep) => {
    setIsPlaying(false);
    if (newStep >= 0 && newStep < trace.length) setCurrentStep(newStep);
  };

  const togglePlayPause = () => {
    if (currentStep >= trace.length - 1) {
        setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };
  
  const dockItems = [
    { icon: <Rewind size={20} />, label: 'First', onClick: () => handleStep(0) },
    { icon: <SkipBack size={20} />, label: 'Previous', onClick: () => handleStep(currentStep - 1) },
    { icon: isPlaying ? <Pause size={20} /> : <Play size={20} />, label: isPlaying ? 'Pause' : 'Play', onClick: togglePlayPause },
    { icon: <SkipForward size={20} />, label: 'Next', onClick: () => handleStep(currentStep + 1) },
    { icon: <FastForward size={20} />, label: 'Last', onClick: () => handleStep(trace.length - 1) },
  ];

  return (
    <div className="bg-gray-900 text-white h-screen w-screen overflow-hidden flex flex-col font-sans">
      <header className="py-2 md:py-4 flex-shrink-0">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-purple-400">DSA Visualizer</h1>
        <p className="text-center text-gray-400 text-sm md:text-base">Visualize complex data structures and algorithms</p>
      </header>
      
      <main className="flex-grow flex flex-col md:flex-row gap-2 md:gap-4 px-2 md:px-4 pb-2 md:pb-28 min-h-0">
        <div className="w-full h-1/2 md:h-full md:w-1/2 flex flex-col rounded-lg shadow-2xl bg-gray-800">
          <div className="flex-shrink-0 flex justify-between items-center bg-gray-700 p-2 rounded-t-lg"><h2 className="text-lg font-semibold">Code Editor</h2><select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-gray-600 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"><option value="python">Python</option><option value="cpp" disabled>C++</option></select></div>
          <div className="flex-grow relative"><Editor className="absolute top-0 left-0 w-full h-full" language={language} theme="vs-dark" defaultValue={code} onMount={handleEditorDidMount} options={{ fontSize: 14, minimap: { enabled: false }, readOnly: isLoading }} /></div>
          <div className="flex-shrink-0 p-2 bg-gray-700 rounded-b-lg"><button onClick={visualizeCode} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-500">{isLoading ? 'Visualizing...' : 'Visualize'}</button></div>
        </div>
        <div className="w-full h-1/2 md:h-full md:w-1/2 flex flex-col rounded-lg shadow-2xl bg-gray-800">
          <div className="flex-shrink-0 bg-gray-700 p-2 rounded-t-lg flex justify-between items-center"><h2 className="text-lg font-semibold">Visualization</h2>
            {trace.length > 0 && !trace[0]?.error && (
                // --- FONT FIX: Apply font-mono to the entire button ---
                <button onClick={() => setIsStepListOpen(!isStepListOpen)} className="font-mono text-sm bg-gray-900 border border-gray-600 px-3 py-1 rounded-md flex items-center gap-2 hover:bg-gray-700 transition-colors">
                    Step 
                    <Counter 
                        value={currentStep + 1} 
                        fontSize={14} 
                        textColor="#e5e7eb"
                        gradientFrom="rgba(31, 41, 55, 0)"
                        gradientTo="rgba(31, 41, 55, 0)"
                    /> 
                </button>
            )}
          </div>
          <div className="p-2 md:p-4 flex-grow overflow-auto relative">
            {isLoading ? <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div></div> : trace.length > 0 ? <VisualizationPanel step={trace[currentStep]} /> : <div className="text-center text-gray-400">Click "Visualize" to begin.</div>}
            {isStepListOpen && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-10 flex justify-center items-center" onClick={() => setIsStepListOpen(false)}>
                    <AnimatedList 
                        items={trace.map((_, i) => `Step ${i + 1}`)}
                        onItemSelect={(_, index) => {
                            handleStep(index);
                            setIsStepListOpen(false);
                        }}
                        className="w-64 bg-gray-800 border border-gray-600 rounded-lg"
                        itemClassName="bg-gray-700/50 hover:bg-gray-700"
                    />
                </div>
            )}
          </div>
        </div>
      </main>
      
      {trace.length > 0 && !trace[0]?.error && (
        <footer className="absolute bottom-0 left-0 right-0 flex flex-col items-center z-20">
            <Dock items={dockItems} />
            <div className="flex items-center gap-2 sm:gap-3 px-1 sm:px-4 w-full max-w-xs mb-2">
                <input type="range" min="100" max="2000" step="100" value={2100 - speed} onChange={(e) => setSpeed(2100 - e.target.value)} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                <span className="text-xs w-10 text-center font-mono">{(speed/1000).toFixed(1)}s</span>
            </div>
        </footer>
      )}
    </div>
  );
}

// --- Visualization Panel and Variable Rendering ---
const VisualizationPanel = ({ step }) => {
  if (!step) return null;
  if (step.error) return <div className="text-red-400 font-mono whitespace-pre-wrap p-2 bg-red-900/20 rounded-md">{step.error}</div>;
  const variables = Object.entries(step.locals || {}).filter(([name, value]) => value?._type !== 'module');
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Variables</h3>
        <div className="space-y-4">{variables.map(([name, value]) => <VariableDisplay key={name} name={name} value={value} />)}</div>
      </div>
      {step.output && step.output.trim() && (<div><h3 className="text-lg font-semibold text-cyan-400 mb-2">Output</h3><pre className="p-2 bg-gray-900 rounded-md text-gray-300 whitespace-pre-wrap">{step.output}</pre></div>)}
    </div>
  );
};

const VariableDisplay = ({ name, value }) => {
  const renderValue = (val) => {
    if (val === null || typeof val !== 'object') return <div className="bg-gray-700 p-2 rounded-md text-lg font-mono">{String(val)}</div>;
    if (val._type === 'list' && val.values.length > 0 && val.values[0]?._type === 'list') { return <GridDisplay matrix={val.values} />; }
    switch (val._type) {
      case 'list': return <ListDisplay items={val.values} />;
      case 'dict': return <DictDisplay items={val.values} />;
      case 'function': return <FunctionDisplay func={val} />;
      case 'tree_node': return <div className="overflow-x-auto p-1"><TreeDisplay node={val} /></div>;
      case 'linked_list_node': return <div className="overflow-x-auto p-1"><LinkedListDisplay node={val} /></div>;
      case 'object': return <ObjectDisplay obj={val} />;
      case 'circular_ref': return <div className="text-sm text-gray-500 font-mono">Circular Reference</div>;
      default: return <div className="bg-gray-700 p-2 rounded-md text-lg font-mono">{JSON.stringify(val)}</div>;
    }
  };
  return (<div><p className="font-mono text-purple-400 mb-1">{name}</p>{renderValue(value)}</div>);
};

// --- Data Structure Specific Components ---
const ListDisplay = ({ items }) => (
  <div className="flex flex-wrap gap-1 bg-gray-900/50 p-2 rounded-md">
    {items.map((item, index) => (
      <div key={index} className="flex flex-col items-center">
        <div className="bg-gray-700 px-3 py-1 rounded-t-md text-base">{item && typeof item === 'object' ? `(${item._type})` : String(item)}</div>
        <div className="bg-gray-600 text-xs px-3 py-0.5 rounded-b-md text-gray-400">{index}</div>
      </div>
    ))}
  </div>
);

const GridDisplay = ({ matrix }) => (
    <div className="bg-gray-900/50 p-2 rounded-md inline-block">
        <table className="border-collapse">
            <tbody>
                {matrix.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.values.map((cell, colIndex) => (
                            <td key={colIndex} className="border border-gray-600 p-2 text-center font-mono">
                                {cell && typeof cell === 'object' ? '...' : String(cell)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const DictDisplay = ({ items }) => (
    <div className="bg-gray-900/50 p-2 rounded-md space-y-2">
        {Object.entries(items).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3">
                <span className="bg-green-800/50 text-green-300 px-2 py-1 rounded font-mono flex-shrink-0">{key}:</span>
                <div className="flex-grow">
                    {value && value._type === 'list' ? <ListDisplay items={value.values} /> : <span>{String(value)}</span>}
                </div>
            </div>
        ))}
    </div>
);

const ObjectDisplay = ({ obj }) => (
    <div className="bg-gray-900/50 p-3 rounded-md border border-gray-700">
        <p className="text-sm text-gray-400 mb-2 font-semibold">{obj.class_name}</p>
        <div className="space-y-1">
            {Object.entries(obj.attributes).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-purple-400">{key}:</span>
                    <span>{value && typeof value === 'object' ? `(${value._type || 'obj'})` : String(value)}</span>
                </div>
            ))}
        </div>
    </div>
);

const FunctionDisplay = ({ func }) => (
    <div className="bg-gray-900/50 p-3 rounded-md border border-gray-700">
        <p className="text-sm text-gray-400 font-mono"><span className="text-indigo-400">function</span> {func.name}()</p>
    </div>
);

const LinkedListDisplay = ({ node }) => (
    <div className="flex items-center gap-0">
        <div className="bg-sky-700 p-2 md:p-3 rounded-l-md font-mono text-sm md:text-base">{String(node.attributes.val)}</div>
        <div className="bg-sky-800 p-2 md:p-3 rounded-r-md text-sky-300">&rarr;</div>
        {node.attributes.next ? <LinkedListDisplay node={node.attributes.next} /> : <div className="bg-gray-700 p-2 md:p-3 rounded-md font-mono text-xs md:text-sm">None</div>}
    </div>
);

const TreeDisplay = ({ node }) => {
    if (!node || node._type !== 'tree_node') return null;
    return (
        <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="bg-teal-600 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full font-bold text-base md:text-lg mb-2">{String(node.attributes.val)}</div>
            <div className="flex gap-2 md:gap-4">
                <div className="flex flex-col items-center">
                    <p className="text-xs text-gray-500">left</p>
                    {node.attributes.left ? <TreeDisplay node={node.attributes.left} /> : <div className="text-gray-600 font-mono text-xs md:text-sm p-2">None</div>}
                </div>
                 <div className="flex flex-col items-center">
                    <p className="text-xs text-gray-500">right</p>
                    {node.attributes.right ? <TreeDisplay node={node.attributes.right} /> : <div className="text-gray-600 font-mono text-xs md:text-sm p-2">None</div>}
                </div>
            </div>
        </div>
    );
};