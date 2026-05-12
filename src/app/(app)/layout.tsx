
import { TopNav } from '@/components/layout/top-nav';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import AuthGuard from '@/components/layout/auth-guard';
import { GenealogyProvider } from '@/context/genealogy-context';
import { CompanyProvider } from '@/context/company-context';
import AppHeader from '@/components/layout/app-header';


export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <CompanyProvider>
        <GenealogyProvider>
          <SidebarProvider defaultOpen={true}>
            <Sidebar>
              <TopNav />
            </Sidebar>
            <SidebarInset>
              <div className="flex flex-col h-full">
                {/* Desktop Header */}
                <div className="hidden md:block">
                  <AppHeader />
                </div>
                {/* Mobile Header with Sidebar Trigger and Actions */}
                <div className="md:hidden flex items-center gap-2 border-b bg-background px-3 py-2">
                  <SidebarTrigger className="h-9 w-9" />
                  <div className="flex-1" />
                  <AppHeader />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {children}
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </GenealogyProvider>
      </CompanyProvider>
    </AuthGuard>
  )
}
