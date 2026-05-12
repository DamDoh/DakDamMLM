'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Play, AlertTriangle, CheckCircle } from 'lucide-react';
import { customFunctionEngine, type CustomFunction, type CustomFunctionParameter, builtInFunctions } from '@/lib/custom-functions';
import { useToast } from '@/hooks/use-toast';
import type { Rank } from '@/lib/types';

interface CustomFunctionsManagerProps {
  companyId?: string;
}

export function CustomFunctionsManager({ companyId }: CustomFunctionsManagerProps) {
  const [functions, setFunctions] = useState<CustomFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<CustomFunction | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFunctions();
  }, [companyId]);

  const loadFunctions = () => {
    const allFunctions = customFunctionEngine.getFunctions(companyId);
    setFunctions(allFunctions);
  };

  const handleCreateFunction = (funcData: Partial<CustomFunction>) => {
    try {
      const newFunction: CustomFunction = {
        id: `custom-${Date.now()}`,
        name: funcData.name || '',
        description: funcData.description || '',
        parameters: funcData.parameters || [],
        returnType: funcData.returnType || 'number',
        code: funcData.code || '',
        companyId: companyId || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin', // In real app, get from auth
        version: 1,
        tags: funcData.tags || [],
        metadata: null
      };

      // Validate function
      const validation = customFunctionEngine.validateFunction(newFunction);
      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: validation.errors.join(', '),
          variant: 'destructive'
        });
        return;
      }

      customFunctionEngine.registerFunction(newFunction);
      loadFunctions();
      setIsCreateDialogOpen(false);

      toast({
        title: 'Success',
        description: 'Custom function created successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create custom function',
        variant: 'destructive'
      });
    }
  };

  const handleTestFunction = async (func: CustomFunction, testParams: Record<string, any>) => {
    try {
      setTestError(null);
      const mockContext = {
        memberId: 'test-member',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 2500, right: 2500 },
        ranks: { current: 'Gold' as Rank, paidAs: 'Gold' as Rank, qualifiedFor: ['Gold' as Rank, 'Diamond' as Rank] },
        team: { directRecruits: 5, totalDownline: 50, activeMembers: 35, qualifiedLegs: 2 },
        genealogy: { generation: 1, upline: [], downline: [], sponsor: 'sponsor-id', placement: 'placement-id' },
        products: { purchased: [] },
        previousPeriods: [],
        customData: {}
      };

      const result = await customFunctionEngine.executeFunction(func.id, mockContext, testParams);
      setTestResults(result);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test failed');
    }
  };

  const handleDeleteFunction = (funcId: string) => {
    customFunctionEngine.unregisterFunction(funcId);
    loadFunctions();
    toast({
      title: 'Success',
      description: 'Custom function deleted successfully'
    });
  };

  const getBuiltInFunctions = () => {
    return builtInFunctions.map(func => ({
      ...func,
      id: `builtin-${func.name.toLowerCase().replace(/\s+/g, '-')}`,
      companyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      version: 1
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Custom Functions Manager</h2>
          <p className="text-muted-foreground">
            Create and manage custom calculation functions for limitless MLM customization
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Function
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Custom Function</DialogTitle>
              <DialogDescription>
                Define a new custom function for advanced rule calculations
              </DialogDescription>
            </DialogHeader>
            <FunctionEditor
              onSave={handleCreateFunction}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="custom" className="space-y-4">
        <TabsList>
          <TabsTrigger value="custom">Custom Functions</TabsTrigger>
          <TabsTrigger value="builtin">Built-in Functions</TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {functions.map((func) => (
              <Card key={func.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{func.name}</CardTitle>
                      <CardDescription className="mt-1">{func.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFunction(func);
                          setIsTestDialogOpen(true);
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFunction(func)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFunction(func.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{func.returnType}</Badge>
                      <Badge variant={func.isActive ? 'default' : 'secondary'}>
                        {func.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {func.parameters.length} parameters
                    </div>
                    {func.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {func.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="builtin" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getBuiltInFunctions().map((func) => (
              <Card key={func.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{func.name}</CardTitle>
                      <CardDescription className="mt-1">{func.description}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFunction(func);
                        setIsTestDialogOpen(true);
                      }}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{func.returnType}</Badge>
                      <Badge variant="default">Built-in</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {func.parameters.length} parameters
                    </div>
                    {func.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {func.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Test Function Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Function: {selectedFunction?.name}</DialogTitle>
            <DialogDescription>
              Test the function with sample parameters and data
            </DialogDescription>
          </DialogHeader>
          {selectedFunction && (
            <FunctionTester
              func={selectedFunction}
              onTest={handleTestFunction}
              testResults={testResults}
              testError={testError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FunctionEditorProps {
  initialFunction?: Partial<CustomFunction>;
  onSave: (func: Partial<CustomFunction>) => void;
  onCancel: () => void;
}

function FunctionEditor({ initialFunction, onSave, onCancel }: FunctionEditorProps) {
  const [formData, setFormData] = useState({
    name: initialFunction?.name || '',
    description: initialFunction?.description || '',
    returnType: initialFunction?.returnType || 'number',
    code: initialFunction?.code || '',
    tags: (initialFunction?.tags as string[]) || []
  });
  const [parameters, setParameters] = useState((initialFunction?.parameters as CustomFunctionParameter[]) || []);
  const [newTag, setNewTag] = useState('');

  const handleSave = () => {
    onSave({
      ...formData,
      parameters
    });
  };

  const addParameter = () => {
    setParameters([...parameters, {
      name: '',
      type: 'number',
      required: true,
      description: ''
    }]);
  };

  const updateParameter = (index: number, field: string, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag]
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag)
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Function Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Advanced Binary Calculator"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="returnType">Return Type</Label>
          <Select value={formData.returnType} onValueChange={(value) => setFormData({ ...formData, returnType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="array">Array</SelectItem>
              <SelectItem value="object">Object</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this function does..."
          rows={3}
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Parameters</Label>
          <Button type="button" variant="outline" size="sm" onClick={addParameter}>
            <Plus className="w-4 h-4 mr-2" />
            Add Parameter
          </Button>
        </div>

        {parameters.map((param, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={param.name}
                    onChange={(e) => updateParameter(index, 'name', e.target.value)}
                    placeholder="parameterName"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={param.type} onValueChange={(value) => updateParameter(index, 'type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="array">Array</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Description</Label>
                  <Input
                    value={param.description}
                    onChange={(e) => updateParameter(index, 'description', e.target.value)}
                    placeholder="Parameter description"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={param.required}
                    onCheckedChange={(checked) => updateParameter(index, 'required', checked)}
                  />
                  <Label>Required</Label>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeParameter(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Function Code</Label>
        <Textarea
          id="code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          placeholder={`// Example: Calculate advanced binary commission
const { weakerLegVolume, strongerLegVolume, balanceRatio = 1.0, commissionRate } = params;

// Check if legs are balanced enough
const ratio = weakerLegVolume / strongerLegVolume;
if (ratio < balanceRatio) {
  return 0; // Not eligible for commission
}

// Calculate commission on weaker leg
return (weakerLegVolume * commissionRate) / 100;`}
          rows={15}
          className="font-mono text-sm"
        />
        <p className="text-sm text-muted-foreground">
          Use <code>params</code> to access function parameters and <code>context</code> for execution context.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag..."
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Function
        </Button>
      </div>
    </div>
  );
}

interface FunctionTesterProps {
  func: CustomFunction;
  onTest: (func: CustomFunction, params: Record<string, any>) => void;
  testResults: any;
  testError: string | null;
}

function FunctionTester({ func, onTest, testResults, testError }: FunctionTesterProps) {
  const [testParams, setTestParams] = useState<Record<string, any>>({});

  useEffect(() => {
    // Initialize test parameters with defaults
    const initialParams: Record<string, any> = {};
    func.parameters.forEach(param => {
      switch (param.type) {
        case 'number':
          initialParams[param.name] = 0;
          break;
        case 'string':
          initialParams[param.name] = '';
          break;
        case 'boolean':
          initialParams[param.name] = false;
          break;
        case 'array':
          initialParams[param.name] = [];
          break;
        case 'object':
          initialParams[param.name] = {};
          break;
      }
    });
    setTestParams(initialParams);
  }, [func]);

  const handleTest = () => {
    onTest(func, testParams);
  };

  const updateParam = (name: string, value: any) => {
    setTestParams({ ...testParams, [name]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Test Parameters</h3>
        {func.parameters.map((param) => (
          <div key={param.name} className="space-y-2">
            <Label>{param.name} ({param.type})</Label>
            {param.type === 'boolean' ? (
              <Switch
                checked={testParams[param.name] || false}
                onCheckedChange={(checked) => updateParam(param.name, checked)}
              />
            ) : param.type === 'number' ? (
              <Input
                type="number"
                value={testParams[param.name] || 0}
                onChange={(e) => updateParam(param.name, Number(e.target.value))}
              />
            ) : (
              <Input
                value={testParams[param.name] || ''}
                onChange={(e) => updateParam(param.name, e.target.value)}
                placeholder={`Enter ${param.type} value`}
              />
            )}
            <p className="text-sm text-muted-foreground">{param.description}</p>
          </div>
        ))}
      </div>

      <Button onClick={handleTest} className="w-full">
        <Play className="w-4 h-4 mr-2" />
        Test Function
      </Button>

      {(testResults !== null || testError) && (
        <div className="space-y-2">
          <Label>Test Results</Label>
          {testError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <pre className="text-sm">{JSON.stringify(testResults, null, 2)}</pre>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}