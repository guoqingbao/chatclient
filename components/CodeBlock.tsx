
import React, { useState, useEffect, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyIcon, CheckIcon } from './Icon';

const HIGHLIGHT_THRESHOLD = 5000;

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = memo(({ language, value }) => {
  const [isCopied, setIsCopied] = useState(false);
  const isLarge = value.length > HIGHLIGHT_THRESHOLD;
  const [shouldHighlight, setShouldHighlight] = useState(!isLarge);

  useEffect(() => {
    if (isLarge && !shouldHighlight) {
      const id = requestIdleCallback(() => setShouldHighlight(true), { timeout: 500 });
      return () => cancelIdleCallback(id);
    }
  }, [isLarge, shouldHighlight]);

  const handleCopy = async () => {
    const textToCopy = value;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (err) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
            setIsCopied(true);
        } else {
            console.error('Fallback copy failed.');
        }
      } catch (fallbackErr) {
        console.error('Failed to copy code:', fallbackErr);
      }
    }
    
    setTimeout(() => setIsCopied(false), 2000);
  };

  const lineCount = value.split('\n').length;

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-[#282c34] my-4 shadow-sm group">
      <div className="flex justify-between items-center px-4 py-1.5 bg-[#21252b] text-gray-400 text-xs border-b border-gray-700">
        <span className="font-mono lowercase select-none text-gray-500">
          {language || 'text'}
          {isLarge && <span className="ml-2 text-gray-600">({lineCount} lines)</span>}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 transition-all duration-200 py-0.5 px-2 rounded ${isCopied ? 'text-green-400 bg-green-400/10' : 'hover:text-white hover:bg-white/10'}`}
          title="Copy code"
        >
          {isCopied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative max-h-[600px] overflow-auto custom-scrollbar">
        {shouldHighlight ? (
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1.25rem',
              background: 'transparent',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              borderRadius: 0,
            }}
            wrapLongLines={true}
          >
            {value}
          </SyntaxHighlighter>
        ) : (
          <pre className="p-5 text-sm leading-relaxed text-gray-300 font-mono whitespace-pre-wrap">
            {value}
          </pre>
        )}
      </div>
    </div>
  );
});

export default CodeBlock;
