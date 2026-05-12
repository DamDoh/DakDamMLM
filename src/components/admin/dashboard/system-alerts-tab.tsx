import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Clock, GitCommit, Loader2 } from 'lucide-react';
import type { Member, FinancialControl } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';

interface SystemAlertsTabProps {
  members: Member[];
  financialControls: FinancialControl[];
  agreements: any[];
  isCompressing: boolean;
  onCompressTree: () => void;
}

export function SystemAlertsTab({
  members,
  financialControls,
  agreements,
  isCompressing,
  onCompressTree
}: SystemAlertsTabProps) {
  const { t } = useI18n();

  const activeMembers = members.filter((m: Member) => m.active && !m.isAdmin);
  const inactiveMembers = members.filter((m: Member) => !m.active && !m.isAdmin);

  const getComplianceRate = () => {
    if (activeMembers.length === 0) return 0;
    const compliantMemberIds = new Set(agreements.map((a) => a.memberId));
    const compliantActiveMembersCount = activeMembers.filter((m) => compliantMemberIds.has(m.id)).length;
    return Math.round((compliantActiveMembersCount / activeMembers.length) * 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('admin.bi.attentionRequired')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {inactiveMembers.length > 10 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>{t('admin.bi.inactiveWarning', { count: String(inactiveMembers.length) })}</span>
              </div>
            )}
            {financialControls.length > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>{t('admin.bi.financialWarning', { count: String(financialControls.length) })}</span>
              </div>
            )}
            {getComplianceRate() < 80 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>{t('admin.bi.complianceWarning')}</span>
              </div>
            )}
            {inactiveMembers.length <= 10 && financialControls.length === 0 && getComplianceRate() >= 80 && (
              <p className="text-sm text-muted-foreground">No high-priority alerts at this time.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            {t('admin.bi.systemHealth')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{t('admin.bi.auditLogging')}</span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" icon={GitCommit} disabled={isCompressing}>
                {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Run Tree Compression
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently alter the tree structure by bypassing inactive members. This action cannot be undone. It should only be run at the end of a commission cycle.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onCompressTree}>Yes, run compression</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}