"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { 
  FiPlay, 
  FiMaximize, 
  FiMinimize, 
  FiUpload, 
  FiSettings, 
  FiMoon, 
  FiSun, 
  FiChevronDown,
  FiRotateCcw
} from "react-icons/fi";
import Editor from "@monaco-editor/react";

const CodeEditor = ({
  language = "javascript",
  code = "",
  fontSize: initialFontSize = 14,
  isFullscreen = false,
  onCodeChange,
  onEditorMount,
  onRunCode,
  onToggleFullscreen,
  setLanguage,
  onSubmitCode,
  problemData,
  theme,
  isRunning,
  isSubmitting
}) => {
  const handleToggleFullscreen = useCallback(() => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      console.warn("onToggleFullscreen handler not provided to CodeEditor");
    }
  }, [onToggleFullscreen]);
  
  // Constants
  const EDITOR_LANG_KEY = 'editor-lang';
  const DEFAULT_LANGUAGE = 'cpp';
  
  // Initialize state
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Initialize from localStorage, prop, or default
    return localStorage.getItem(EDITOR_LANG_KEY) || language || DEFAULT_LANGUAGE;
  });
  const [error, setError] = useState(null);
  
  // Refs and other state
  const editorRef = useRef(null);
  const prevLangRef = useRef(currentLanguage);
  
  // UI state
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true);
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState(initialFontSize);
  const [isLoading, setIsLoading] = useState(false);
  const [isLangChanging, setIsLangChanging] = useState(false);

  const handleLangChange = async (newLang) => {
    if (!newLang || newLang === currentLanguage || isLangChanging) {
      return;
    }
    setIsLangChanging(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/changeLanguage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: problemData?.initial_code,
            fromLang: currentLanguage,
            toLang: newLang
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to change language');
      }
      
      const data = await response.json();
      setError(null);
      
      if (editorRef.current) {
        editorRef.current.setValue(data.code);
        if (onCodeChange) {
          onCodeChange(data.code);
        }
      }
      
      setCurrentLanguage(newLang);
      localStorage.setItem(EDITOR_LANG_KEY, newLang);
      setLanguage?.(newLang);
    } catch (err) {
      console.error('Error changing language:', err);
      setError(err.message || 'An error occurred while changing language');
    } finally {
      setIsLangChanging(false);
    }
  }

  useEffect(() => {
    // Load user preferences from localStorage
    const storedLang = localStorage.getItem("editor-lang");
    const storedFont = localStorage.getItem("editor-font");
    const storedTheme = localStorage.getItem("editor-theme");
    const storedAutoSuggest = localStorage.getItem("editor-auto-suggest");
    
    // Set default language to cpp if no language is stored
    if (storedLang) {
      setLanguage(storedLang);
    } else {
      setLanguage("cpp");
      localStorage.setItem("editor-lang", "cpp");
    }
    if (storedFont) {
      const parsedSize = parseInt(storedFont);
      if (!isNaN(parsedSize) && parsedSize >= 10 && parsedSize <= 30) {
        setCurrentFontSize(parsedSize);
        if (editorRef.current) editorRef.current.updateOptions({ fontSize: parsedSize });
      }
    }
    if (storedTheme) setEditorTheme(storedTheme);
    if (storedAutoSuggest !== null) setAutoSuggestEnabled(storedAutoSuggest === "true");
  }, [setLanguage, handleToggleFullscreen]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;

    // Apply the current font size when editor mounts
    editor.updateOptions({ fontSize: currentFontSize });

    // Save font size changes
    editor.onDidChangeConfiguration(() => {
      const opts = editor.getRawOptions();
      if (opts.fontSize) {
        localStorage.setItem("editor-font", opts.fontSize.toString());
        setCurrentFontSize(opts.fontSize);
      }
    });

    // Keyboard shortcut: Ctrl+Enter to run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRunCode) onRunCode();
    });

    // Keyboard shortcut: Ctrl+S to submit code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, (e) => {
      if (e) e.preventDefault();
      handleSubmitCode();
    });
    
    // Keyboard shortcut: F11 or Alt+Enter for fullscreen toggle
    editor.addCommand(monaco.KeyCode.F11, () => {
      handleToggleFullscreen();
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
      handleToggleFullscreen();
    });

    if (onEditorMount) onEditorMount(editor, monaco);
  };

  const handleResetCode = () => {
    if (editorRef.current) {
      const initialCode = problemData?.initial_code || '';
      editorRef.current.setValue(initialCode);
      // Trigger the onCodeChange to update the parent component's state
      if (onCodeChange) {
        onCodeChange(initialCode);
      }
    }
  };

  const handleSubmitCode = () => {
    if (!editorRef.current) return;
    
    const typedCode = editorRef.current.getValue() || '';
    
    // Call onSubmitCode if provided
    onSubmitCode?.({
      description: problemData?.description,
      typedSolution: typedCode,
      actualSolution: problemData?.solution,
      language: currentLanguage
    });
  };

  const toggleAutoSuggest = () => {
    const newValue = !autoSuggestEnabled;
    setAutoSuggestEnabled(newValue);
    localStorage.setItem("editor-auto-suggest", newValue.toString());
    
    if (editorRef.current) {
      editorRef.current.updateOptions({
        quickSuggestions: newValue,
        suggestOnTriggerCharacters: newValue,
        acceptSuggestionOnEnter: newValue ? "on" : "off"
      });
      
      if (newValue) {
        editorRef.current.trigger("manual", "editor.action.triggerSuggest", {});
      }
    }
  };

  const handleThemeToggle = () => {
    const newTheme = editorTheme === "vs-dark" ? "light" : "vs-dark";
    setEditorTheme(newTheme);
    localStorage.setItem("editor-theme", newTheme);
  };

  const changeFontSize = (delta) => {
    if (!editorRef.current) return;
    
    const newSize = Math.max(10, Math.min(currentFontSize + delta, 30));
    
    // Update the state first
    setCurrentFontSize(newSize);
    
    // Update the editor font size
    editorRef.current.updateOptions({ fontSize: newSize });
    
    // Persist to localStorage
    localStorage.setItem("editor-font", newSize.toString());
  };

  // Ensure the toggle fullscreen function works in keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // F11 key for fullscreen toggle
      if (event.key === 'F11') {
        event.preventDefault();
        handleToggleFullscreen();
      }
      // Alt+Enter for fullscreen toggle
      if (event.key === 'Enter' && event.altKey) {
        event.preventDefault();
        handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleFullscreen]);
  
  // Determine text/bg color classes based on theme
  const themeClasses = theme === "vs-dark" 
    ? { bg: "bg-gray-700", border: "border-gray-600", text: "text-white", hover: "hover:bg-gray-700" }
    : { bg: "bg-white", border: "border-gray-300", text: "text-gray-700", hover: "hover:bg-gray-200" };

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-slate-900 p-4 overflow-hidden" : "h-full"}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 shadow-md">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button 
              className="flex items-center bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => !isLangChanging && setIsSettingsOpen(!isSettingsOpen)}
              aria-expanded={isSettingsOpen}
              aria-haspopup="true"
              disabled={isLangChanging}
            >
              <FiSettings size={14} className="mr-1.5" />
              <span className="capitalize mr-1">{currentLanguage === "cpp" ? "C++" : currentLanguage}</span>
              {isLangChanging ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              ) : (
                <FiChevronDown size={14} />
              )}
            </button>
            
            {isSettingsOpen && (
              <div className="absolute z-10 top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl py-1 min-w-32">
                <div className="px-3 py-2 text-xs text-slate-400 font-semibold border-b border-slate-700">
                  Language
                </div>
                {["javascript", "python", "java", "cpp"].map((lang) => (
                  <button
                    key={lang}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                      currentLanguage === lang 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    onClick={() => {
                      handleLangChange(lang);
                      setIsSettingsOpen(false);
                    }}
                    disabled={isLangChanging}
                  >
                    {lang === "cpp" ? "C++" : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
                <div className="border-t border-slate-700 mt-1 pt-1">
                  <div className="px-3 py-2 text-xs text-slate-400 font-semibold">
                    Editor Options
                  </div>
                  <button
                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    onClick={toggleAutoSuggest}
                  >
                    <span>Auto-suggest</span>
                    <div className={`w-8 h-4 rounded-full relative ${autoSuggestEnabled ? 'bg-green-500' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transform transition-transform ${autoSuggestEnabled ? 'left-4' : 'left-0.5'}`}></div>
                    </div>
                  </button>
                  <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-300">
                    <span>Font Size</span>
                    <div className="flex space-x-1">
                      <button 
                        className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white"
                        onClick={() => changeFontSize(-1)}
                        aria-label="Decrease font size"
                      >
                        -
                      </button>
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-white min-w-6 text-center">
                        {currentFontSize}
                      </span>
                      <button 
                        className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-white"
                        onClick={() => changeFontSize(1)}
                        aria-label="Increase font size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    onClick={() => {
                      handleThemeToggle();
                      setIsSettingsOpen(false);
                    }}
                  >
                    <span>Theme</span>
                    <div className="flex items-center">
                      {theme === "vs-dark" ? (
                        <FiSun size={14} className="text-yellow-400" />
                      ) : (
                        <FiMoon size={14} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-md transition-colors"
            onClick={handleResetCode}
            title="Reset to initial code"
          >
            <FiRotateCcw size={14} />
          </button>
          <button
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-md transition-colors"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (F11)" : "Enter fullscreen (F11)"}
          >
            {isFullscreen ? <FiMinimize size={14} /> : <FiMaximize size={14} />}
          </button>
          
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md flex items-center transition-colors"
            onClick={onRunCode}
            disabled={isRunning}
            title="Run code (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-white rounded-full mr-1.5"></div>
                Running...
              </>
            ) : (
              <>
                <FiPlay className="mr-1.5" size={14} /> Run
              </>
            )}
          </button>
          
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md flex items-center transition-colors"
            onClick={handleSubmitCode}
            disabled={isSubmitting}
            title="Submit code (Ctrl+S)"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-white rounded-full mr-1.5"></div>
                Submitting...
              </>
            ) : (
              <>
                <FiUpload className="mr-1.5" size={14} /> Submit
              </>
            )}
          </button>
        </div>
      </div>

      <div className="h-full overflow-hidden">
        <Editor
          height={isFullscreen ? "calc(100vh - 60px)" : "100%"}
          language={currentLanguage}
          value={code}
          theme={editorTheme}
          onChange={onCodeChange}
          onMount={handleEditorMount}
          options={{
            fontSize: currentFontSize,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: "on",
            folding: true,
            tabSize: 2,
            wordWrap: "on",
            formatOnPaste: true,
            formatOnType: true,
            quickSuggestions: autoSuggestEnabled,
            suggestOnTriggerCharacters: autoSuggestEnabled,
            acceptSuggestionOnEnter: autoSuggestEnabled ? "on" : "off",
            tabCompletion: "on",
            suggestSelection: "first",
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            contextmenu: true,
            mouseWheelZoom: true,
            bracketPairColorization: {
              enabled: true
            },
            fontLigatures: true,
            padding: { top: 10 }
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;