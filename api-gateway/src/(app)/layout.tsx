
import { TopNav } from '@/components/layout/top-nav';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import AuthGuard from '@/components/layout/auth-guard';
import { GenealogyProvider } from '@/context/genealogy-context';
import AppHeader from '@/components/layout/app-header';


export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <GenealogyProvider>
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <TopNav />
          </Sidebar>
          <SidebarInset>
            <div className="flex flex-col h-full">
              <div className="hidden md:block">
                <AppHeader />
              </div>
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </GenealogyProvider>
    </AuthGuard>
  )
}
