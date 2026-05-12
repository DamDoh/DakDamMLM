'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Play, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RuleExecutionContext, RuleExecutionResult, Rank } from '@/lib/types';
import { ranks } from '@/lib/types';

interface SimulationData {
  memberId: string;
  rank: Rank;
  volumes: {
    personal: number;
    group: number;
    left: number;
    right: number;
  };
  team: {
    directRecruits: number;
    totalDownline: number;
    activeMembers: number;
    qualifiedLegs: number;
  };
  genealogy: {
    generation: number;
    sponsor: string;
    placement: string;
  };
  products: {
    purchased: Array<{
      productId: string;
      quantity: number;
      amount: number;
      pv: number;
    }>;
  };
}

export default function RuleSimulation() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RuleExecutionResult[]>([]);
  const [simulationData, setSimulationData] = useState<SimulationData>({
    memberId: 'SIM001',
    rank: 'Bronze',
    volumes: {
      personal: 1000,
      group: 3000,
      left: 1500,
      right: 1500
    },
    team: {
      directRecruits: 2,
      totalDownline: 10,
      activeMembers: 8,
      qualifiedLegs: 2
    },
    genealogy: {
      generation: 0,
      sponsor: 'SP001',
      placement: 'PL001'
    },
    products: {
      purchased: []
    }
  });

  const [activeTab, setActiveTab] = useState('input');

  const runSimulation = async () => {
    setLoading(true);
    try {
      const context: RuleExecutionContext = {
        memberId: simulationData.memberId,
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        volumes: simulationData.volumes,
        ranks: {
          current: simulationData.rank,
          paidAs: simulationData.rank,
          qualifiedFor: [simulationData.rank]
        },
        team: simulationData.team,
        genealogy: {
          ...simulationData.genealogy,
          upline: [],
          downline: []
        },
        products: simulationData.products,
        previousPeriods: []
      };

      // Call simulation API
      const response = await fetch('/api/rules/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
      });

      if (!response.ok) {
        throw new Error('Simulation failed');
      }

      const data = await response.json();
      setResults(data.results);
      setActiveTab('results');

      toast({
        title: 'Simulation Complete',
        description: `Executed ${data.results.length} rules successfully.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Simulation Failed',
        description: 'Failed to run rule simulation.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: string) => {
    switch (preset) {
      case 'bronze':
        setSimulationData({
          ...simulationData,
          rank: 'Bronze',
          volumes: { personal: 1000, group: 3000, left: 1500, right: 1500 },
          team: { directRecruits: 2, totalDownline: 10, activeMembers: 8, qualifiedLegs: 2 }
        });
        break;
      case 'silver':
        setSimulationData({
          ...simulationData,
          rank: 'Silver',
          volumes: { personal: 2500, group: 7500, left: 4000, right: 3500 },
          team: { directRecruits: 5, totalDownline: 25, activeMembers: 20, qualifiedLegs: 4 }
        });
        break;
      case 'gold':
        setSimulationData({
          ...simulationData,
          rank: 'Gold',
          volumes: { personal: 5000, group: 15000, left: 8000, right: 7000 },
          team: { directRecruits: 10, totalDownline: 50, activeMembers: 40, qualifiedLegs: 6 }
        });
        break;
      case 'diamond':
        setSimulationData({
          ...simulationData,
          rank: 'Diamond',
          volumes: { personal: 25000, group: 75000, left: 40000, right: 35000 },
          team: { directRecruits: 50, totalDownline: 200, activeMembers: 150, qualifiedLegs: 8 }
        });
        break;
    }
  };

  const totalCommission = results.reduce((sum, result) => sum + result.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Rule Simulation</h2>
          <p className="text-muted-foreground">Test rules with custom member data before deployment</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadPreset('bronze')}>
            Bronze Preset
          </Button>
          <Button variant="outline" onClick={() => loadPreset('silver')}>
            Silver Preset
          </Button>
          <Button variant="outline" onClick={() => loadPreset('gold')}>
            Gold Preset
          </Button>
          <Button variant="outline" onClick={() => loadPreset('diamond')}>
            Diamond Preset
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="input">Input Data</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Member Information */}
            <Card>
              <CardHeader>
                <CardTitle>Member Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="memberId">Member ID</Label>
                  <Input
                    id="memberId"
                    value={simulationData.memberId}
                    onChange={(e) => setSimulationData({...simulationData, memberId: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="rank">Rank</Label>
                  <Select
                    value={simulationData.rank}
                    onValueChange={(value) => setSimulationData({...simulationData, rank: value as Rank})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map(rank => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Volume Information */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="personalVolume">Personal Volume (PV)</Label>
                  <Input
                    id="personalVolume"
                    type="number"
                    value={simulationData.volumes.personal}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      volumes: {...simulationData.volumes, personal: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="groupVolume">Group Volume (GV)</Label>
                  <Input
                    id="groupVolume"
                    type="number"
                    value={simulationData.volumes.group}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      volumes: {...simulationData.volumes, group: Number(e.target.value)}
                    })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="leftVolume">Left Leg</Label>
                    <Input
                      id="leftVolume"
                      type="number"
                      value={simulationData.volumes.left}
                      onChange={(e) => setSimulationData({
                        ...simulationData,
                        volumes: {...simulationData.volumes, left: Number(e.target.value)}
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rightVolume">Right Leg</Label>
                    <Input
                      id="rightVolume"
                      type="number"
                      value={simulationData.volumes.right}
                      onChange={(e) => setSimulationData({
                        ...simulationData,
                        volumes: {...simulationData.volumes, right: Number(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Information */}
            <Card>
              <CardHeader>
                <CardTitle>Team Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="directRecruits">Direct Recruits</Label>
                  <Input
                    id="directRecruits"
                    type="number"
                    value={simulationData.team.directRecruits}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      team: {...simulationData.team, directRecruits: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="totalDownline">Total Downline</Label>
                  <Input
                    id="totalDownline"
                    type="number"
                    value={simulationData.team.totalDownline}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      team: {...simulationData.team, totalDownline: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="activeMembers">Active Members</Label>
                  <Input
                    id="activeMembers"
                    type="number"
                    value={simulationData.team.activeMembers}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      team: {...simulationData.team, activeMembers: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="qualifiedLegs">Qualified Legs</Label>
                  <Input
                    id="qualifiedLegs"
                    type="number"
                    value={simulationData.team.qualifiedLegs}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      team: {...simulationData.team, qualifiedLegs: Number(e.target.value)}
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Genealogy Information */}
            <Card>
              <CardHeader>
                <CardTitle>Genealogy Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="generation">Generation</Label>
                  <Input
                    id="generation"
                    type="number"
                    value={simulationData.genealogy.generation}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      genealogy: {...simulationData.genealogy, generation: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="sponsor">Sponsor ID</Label>
                  <Input
                    id="sponsor"
                    value={simulationData.genealogy.sponsor}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      genealogy: {...simulationData.genealogy, sponsor: e.target.value}
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="placement">Placement ID</Label>
                  <Input
                    id="placement"
                    value={simulationData.genealogy.placement}
                    onChange={(e) => setSimulationData({
                      ...simulationData,
                      genealogy: {...simulationData.genealogy, placement: e.target.value}
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button onClick={runSimulation} disabled={loading} size="lg" icon={loading ? Loader2 : Play}>
              {loading ? 'Running Simulation...' : 'Run Simulation'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Results</h3>
                <p className="text-muted-foreground text-center">
                  Run a simulation to see rule execution results here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Simulation Results
                  </CardTitle>
                  <CardDescription>
                    Total Commission: <span className="font-bold text-green-600">${totalCommission.toFixed(2)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Breakdown</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{result.ruleId}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            ${result.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {result.breakdown[0]?.description || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {result.breakdown.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{item.component}:</span> ${item.amount.toFixed(2)}
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
            </>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Rules Executed</div>
                    <div className="text-2xl font-bold">{results.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Commission</div>
                    <div className="text-2xl font-bold text-green-600">${totalCommission.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Average per Rule</div>
                    <div className="text-2xl font-bold">
                      ${results.length > 0 ? (totalCommission / results.length).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rule Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Rules with Results</div>
                    <div className="text-2xl font-bold text-green-600">
                      {results.filter(r => r.amount > 0).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Rules with Zero Results</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {results.filter(r => r.amount === 0).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                    <div className="text-2xl font-bold">
                      {results.length > 0 ? ((results.filter(r => r.amount > 0).length / results.length) * 100).toFixed(1) : '0'}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commission Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results
                    .filter(r => r.amount > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 5)
                    .map((result, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="text-sm truncate max-w-[120px]">{result.ruleId}</div>
                        <div className="font-bold text-green-600">${result.amount.toFixed(2)}</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}