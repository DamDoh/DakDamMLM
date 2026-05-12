'use client';

import { useState, useCallback } from 'react';
import { SettingsService } from '@/services/settings/settings-service';

interface FormulaBuilderProps {
  value: string;
  onChange: (value: string) => void;
  context?: { companyId?: string; userId?: string };
}

interface Variable {
  name: string;
  type: 'number' | 'boolean' | 'string';
  description: string;
  example: string;
}

interface FunctionDef {
  name: string;
  signature: string;
  description: string;
  example: string;
}

export function FormulaBuilder({ value, onChange, context }: FormulaBuilderProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [testValues, setTestValues] = useState<Record<string, any>>({
    leftWaitingPV: 100,
    rightWaitingPV: 150,
    matchedPV: 100,
    commission_rate: 0.08,
    member_rank: 'Gold',
    team_size: 25
  });

  const variables: Variable[] = [
    { name: 'leftWaitingPV', type: 'number', description: 'PV waiting in left leg', example: '100' },
    { name: 'rightWaitingPV', type: 'number', description: 'PV waiting in right leg', example: '150' },
    { name: 'matchedPV', type: 'number', description: 'PV matched in current cycle', example: '100' },
    { name: 'commission_rate', type: 'number', description: 'Commission rate percentage', example: '0.08' },
    { name: 'member_rank', type: 'string', description: 'Current member rank', example: '"Gold"' },
    { name: 'team_size', type: 'number', description: 'Total team members', example: '25' },
    { name: 'rank_pv', type: 'number', description: 'PV value for current rank', example: '500' }
  ];

  const functions: FunctionDef[] = [
    { name: 'min', signature: 'min(a, b)', description: 'Returns the smaller of two values', example: 'min(leftWaitingPV, rightWaitingPV)' },
    { name: 'max', signature: 'max(a, b)', description: 'Returns the larger of two values', example: 'max(leftWaitingPV, rightWaitingPV)' },
    { name: 'round', signature: 'round(number, decimals)', description: 'Rounds a number to specified decimal places', example: 'round(matchedPV * commission_rate, 2)' },
    { name: 'if', signature: 'if(condition, true_val, false_val)', description: 'Conditional expression', example: 'if(matchedPV > 0, matchedPV * commission_rate, 0)' },
    { name: 'abs', signature: 'abs(number)', description: 'Absolute value', example: 'abs(leftWaitingPV - rightWaitingPV)' },
    { name: 'sqrt', signature: 'sqrt(number)', description: 'Square root', example: 'sqrt(team_size)' }
  ];

  const handlePreview = useCallback(async () => {
    try {
      // This would call a backend API to evaluate the formula safely
      // For now, we'll use a client-side evaluation (in production, this should be server-side)
      const result = evaluateFormula(value, testValues);
      setPreviewResult(result);
    } catch (error) {
      setPreviewResult({ error: error instanceof Error ? error.message : 'Invalid formula' });
    }
  }, [value, testValues]);

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + variable + value.substring(end);
      onChange(newValue);

      // Focus back and set cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const insertFunction = (func: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + func + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        const funcNameEnd = start + func.indexOf('(') + 1;
        textarea.setSelectionRange(funcNameEnd, funcNameEnd);
      }, 0);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Formula Builder</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3 py-1 rounded text-sm ${
              isPreviewMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isPreviewMode ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formula Editor */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mathematical Expression
            </label>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your formula, e.g., matchedPV * commission_rate"
            />
          </div>

          {/* Available Variables */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Available Variables</h4>
            <div className="grid grid-cols-2 gap-2">
              {variables.map((variable) => (
                <button
                  key={variable.name}
                  onClick={() => insertVariable(variable.name)}
                  className="text-left p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-xs"
                  title={variable.description}
                >
                  <div className="font-medium text-blue-600">{variable.name}</div>
                  <div className="text-gray-500">{variable.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Available Functions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Available Functions</h4>
            <div className="grid grid-cols-1 gap-2">
              {functions.map((func) => (
                <button
                  key={func.name}
                  onClick={() => insertFunction(func.signature)}
                  className="text-left p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-xs"
                  title={func.description}
                >
                  <div className="font-medium text-green-600">{func.signature}</div>
                  <div className="text-gray-500">{func.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {isPreviewMode && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Test Values</h4>
              <div className="space-y-2">
                {Object.entries(testValues).map(([key, val]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <label className="text-xs font-medium text-gray-600 w-24">{key}:</label>
                    <input
                      type={typeof val === 'number' ? 'number' : 'text'}
                      value={val}
                      onChange={(e) => {
                        const newVal = typeof val === 'number' ?
                          parseFloat(e.target.value) || 0 :
                          e.target.value;
                        setTestValues(prev => ({ ...prev, [key]: newVal }));
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <button
                onClick={handlePreview}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
              >
                Calculate Preview
              </button>
            </div>

            {previewResult !== null && (
              <div className="bg-white p-3 rounded border">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Result:</h4>
                <div className="font-mono text-sm">
                  {previewResult.error ? (
                    <span className="text-red-600">{previewResult.error}</span>
                  ) : (
                    <span className="text-green-600">{JSON.stringify(previewResult, null, 2)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Safe formula evaluation (client-side - in production, move to server)
function evaluateFormula(formula: string, variables: Record<string, any>): any {
  try {
    // Create a safe evaluation context
    const context = { ...variables };

    // Add safe functions
    context.min = Math.min;
    context.max = Math.max;
    context.round = (num: number, decimals: number = 2) =>
      Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    context.abs = Math.abs;
    context.sqrt = Math.sqrt;
    context.if = (condition: any, trueVal: any, falseVal: any) =>
      condition ? trueVal : falseVal;

    // Basic security: only allow whitelisted operations
    const allowedChars = /^[0-9\s\+\-\*\/\(\)\.,a-zA-Z_]+$/;
    if (!allowedChars.test(formula.replace(/\s/g, ''))) {
      throw new Error('Invalid characters in formula');
    }

    // Create function from formula
    const func = new Function(...Object.keys(context), `return ${formula};`);
    return func(...Object.values(context));
  } catch (error) {
    throw new Error(`Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}