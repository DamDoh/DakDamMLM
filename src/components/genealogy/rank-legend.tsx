
'use client';

import { useState } from 'react';
import RankBadge from "./rank-badge";
import { type Rank } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, ChevronsUpDown } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useI18n } from '@/lib/internationalization';

// 8 ranks from the table (exact order: 1.Bronze, 2.Silver, 3.Gold, 4.Diamond, 5.Manager, 6.Director, 7.President, 8.Double President)
const rankInfo: Record<string, { pv: string }> = {
    Bronze: { pv: "60 PV" },           // 1. Bronze (updated from 50 PV)
    Silver: { pv: "100 PV" },          // 2. Silver
    Gold: { pv: "500 PV" },            // 3. Gold
    Diamond: { pv: "1000 PV" },        // 4. Diamond
    Manager: { pv: "1000 PV" },        // 5. Manager
    Director: { pv: "1000 PV" },       // 6. Director
    President: { pv: "1000 PV" },      // 7. President
    'Double President': { pv: "1000 PV" }, // 8. Double President
};

// Display only these 8 ranks in the exact order from the table
// Note: 'Double President' is not in the Rank type, so we use type assertion
const displayedRanks: (Rank | 'Double President')[] = [
    'Bronze',           // 1
    'Silver',           // 2
    'Gold',             // 3
    'Diamond',          // 4
    'Manager',          // 5
    'Director',         // 6
    'President',        // 7
    'Double President' as any  // 8 (not in Rank type but shown in table)
];

export default function RankLegend() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">{t('genealogy.rankLegend')}</CardTitle>
            <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
                {displayedRanks.map((rank) => (
                    <div key={rank} className="flex flex-col items-center gap-1">
                    <RankBadge rank={rank} className="flex-shrink-0" />
                    <div className="text-xs text-center">
                        <p className="font-semibold text-foreground">{rank}</p>
                        {rankInfo[rank] && <p className="text-muted-foreground font-medium">{rankInfo[rank]?.pv}</p>}
                    </div>
                    </div>
                ))}
                </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
