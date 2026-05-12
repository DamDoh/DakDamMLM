'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Calculator, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RuleExecutionContext, RuleExecutionResult, BusinessRule, Rank } from '@/lib/types';
import { ruleEngine } from '@/lib/rule-engine';

interface RuleSimulatorProps {
  rules: BusinessRule[];
}

export function RuleSimulator({ rules }: RuleSimulatorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RuleExecutionResult[]>([]);
  const [simulationContext, setSimulationContext] = useState<RuleExecutionContext>({
    memberId: 'M000001',
    period: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    },
    volumes: {
      personal: 1000,
      group: 5000,
      left: 3000,
      right: 2000
    },
    ranks: {
      current: 'Bronze' as Rank,
      paidAs: 'Bronze' as Rank,
      qualifiedFor: ['Silver']
    },
    team: {
      directRecruits: 5,
      totalDownline: 25,
      activeMembers: 20,
      qualifiedLegs: 2
    },
    genealogy: {
      generation: 1,
      upline: [],
      downline: ['M000002', 'M000003'],
      sponsor: '',
      placement: ''
    },
    products: {
      purchased: [
        {
          productId: 'prod1',
          quantity: 10,
          amount: 1000,
          pv: 1000
        }
      ]
    },
    previousPeriods: []
  });

  const handleSimulate = async () => {
    setLoading(true);
    try {
      // Load rules into engine
      ruleEngine.loadRules(rules);

      // Execute rules
      const executionResults = await ruleEngine.executeRules(simulationContext);

      setResults(executionResults);

      toast({
        title: 'Simulation Complete',
        description: `Executed ${executionResults.length} rules successfully.`,
      });
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        variant: 'destructive',
        title: 'Simulation Failed',
        description: 'An error occurred during rule simulation.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateContext = (path: string, value: any) => {
    setSimulationContext(prev => {
      const newContext = { ...prev };
      const keys = path.split('.');
      let current: any = newContext;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newContext;
    });
  };

  const totalCommission = results.reduce((sum, result) => sum + result.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Rule Simulator
          </CardTitle>
          <CardDescription>
            Test and validate business rules with custom member data and scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Member Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="memberId">Member ID</Label>
              <Input
                id="memberId"
                value={simulationContext.memberId}
                onChange={(e) => updateContext('memberId', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="currentRank">Current Rank</Label>
              <Select
                value={simulationContext.ranks.current}
                onValueChange={(value) => updateContext('ranks.current', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">Member</SelectItem>
                  <SelectItem value="Bronze">Bronze</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="personalVolume">Personal Volume</Label>
              <Input
                id="personalVolume"
                type="number"
                value={simulationContext.volumes.personal}
                onChange={(e) => updateContext('volumes.personal', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label htmlFor="groupVolume">Group Volume</Label>
              <Input
                id="groupVolume"
                type="number"
                value={simulationContext.volumes.group}
                onChange={(e) => updateContext('volumes.group', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label htmlFor="directRecruits">Direct Recruits</Label>
              <Input
                id="directRecruits"
                type="number"
                value={simulationContext.team.directRecruits}
                onChange={(e) => updateContext('team.directRecruits', parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label htmlFor="totalDownline">Total Downline</Label>
              <Input
                id="totalDownline"
                type="number"
                value={simulationContext.team.totalDownline}
                onChange={(e) => updateContext('team.totalDownline', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <Button onClick={handleSimulate} disabled={loading} size="lg" icon={loading ? "loading" : Play}>
              {loading ? 'Running Simulation...' : 'Run Simulation'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Simulation Results
              </span>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                Total: ${totalCommission.toFixed(2)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Breakdown of commissions and bonuses calculated for this scenario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.ruleId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {result.metadata?.ruleType?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {result.metadata?.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      ${result.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {result.breakdown.map((item, i) => (
                          <div key={i}>
                            {item.description}: ${item.amount.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Context Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Context</CardTitle>
          <CardDescription>
            Current member data used for this simulation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Member ID</Label>
              <p className="font-mono">{simulationContext.memberId}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Rank</Label>
              <p>{simulationContext.ranks.current}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Personal PV</Label>
              <p className="font-mono">{simulationContext.volumes.personal.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Group PV</Label>
              <p className="font-mono">{simulationContext.volumes.group.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Direct Recruits</Label>
              <p>{simulationContext.team.directRecruits}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Downline</Label>
              <p>{simulationContext.team.totalDownline}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Active Members</Label>
              <p>{simulationContext.team.activeMembers}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Qualified Legs</Label>
              <p>{simulationContext.team.qualifiedLegs}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}