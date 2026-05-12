
'use client';

import { useState } from 'react';
import RankBadge from "./rank-badge";
import { type Rank } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, ChevronsUpDown } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useI18n } from '@/lib/internationalization';

const rankInfo: Record<Rank, { pv: string }> = {
    Member: { pv: "50 PV" },
    Bronze: { pv: "100 PV" },
    Silver: { pv: "250 PV" },
    Gold: { pv: "500 PV" },
    Diamond: { pv: "1000 PV" },
    'Super Diamond': { pv: "1500 PV" },
    'Half STAR': { pv: "N/A" },
    STAR: { pv: "800 PV" },
    Supervisor: { pv: "N/A" },
    Manager: { pv: "N/A" },
    Director: { pv: "N/A" },
    President: { pv: "N/A" },
    Chairman: { pv: "2500 PV" },
    'Blue Diamond': { pv: "N/A" },
    'Black Diamond': { pv: "N/A" },
    Emerald: { pv: "1200 PV" },
    'Blue Emerald': { pv: "N/A" },
    Elite: { pv: "N/A" },
    Crown: { pv: "N/A" },
    'Double Diamond': { pv: "N/A" },
    Expired: { pv: "N/A" },
};

const displayedRanks: Rank[] = ['Member', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Chairman', 'Emerald', 'Super Diamond'];

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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                {displayedRanks.map((rank) => (
                    <div key={rank} className="flex items-center gap-2">
                    <RankBadge rank={rank} className="flex-shrink-0" />
                    <div className="text-xs text-center">
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
