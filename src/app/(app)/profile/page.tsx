
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Member, Address } from '@/lib/types';
import { Calendar, Hash, Star, Users, Store, UserCheck, ArrowUpCircle, Upload, Edit, ShieldCheck, MapPin, PlusCircle, Trash2, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGenealogyContext } from '@/context/genealogy-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
import NextRankRequirements from '@/components/profile/next-rank-requirements';
import { useIsMobile } from '@/hooks/use-mobile';
import { useI18n } from '@/lib/internationalization';
import { deleteMemberAddress, setDefaultMemberAddress } from '@/services/server-actions';
import AddressDialog from '@/components/address-dialog';
import RankBadge from '@/components/genealogy/rank-badge';
import ChangePasswordDialog from '@/components/profile/change-password-dialog';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import placeholderData from '@/lib/placeholder-images.json';
import { cn } from '@/lib/utils';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));


export default function ProfilePage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { rootMember: user, allMembersMap, loading, handleUpdateMember } = context || { rootMember: null, allMembersMap: new Map(), loading: true, handleUpdateMember: async () => false };
  const { toast } = useToast();
  const [sponsoredMembers, setSponsoredMembers] = useState<Member[]>([]);
  const [actualTeamSize, setActualTeamSize] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const [isAddressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  const [isChangePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState(user?.avatarUrl || '/images/default-avatar.png');

  const [addresses, setAddresses] = useState<Address[]>(user?.addresses || []);
  const [groupPV, setGroupPV] = useState<number>(0);

  // Calculate group PV recursively from all downline members
  const calculateGroupPV = (memberId: string, allMembers: Map<string, Member>): number => {
    const visited = new Set<string>();
    let totalPV = 0;

    const calculateRecursive = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const member = allMembers.get(id);
      if (!member) return;

      // Add this member's PV if they're in the downline (not the root member)
      if (id !== memberId) {
        totalPV += member.pv || 0;
      }

      // Traverse binary tree children (left and right legs)
      if (member.children?.left) {
        calculateRecursive(member.children.left);
      }
      if (member.children?.right) {
        calculateRecursive(member.children.right);
      }

      // Also check placementParentId for any additional children
      const placementChildren = Array.from(allMembers.values()).filter(
        m => m.placementParentId === id && m.id !== id && !m.deleted && !visited.has(m.id)
      );
      placementChildren.forEach(child => {
        calculateRecursive(child.id);
      });
    };

    // Start from the member's children (not including the member themselves)
    const member = allMembers.get(memberId);
    if (member) {
      if (member.children?.left) {
        calculateRecursive(member.children.left);
      }
      if (member.children?.right) {
        calculateRecursive(member.children.right);
      }

      // Also include any direct placement children
      const directChildren = Array.from(allMembers.values()).filter(
        m => m.placementParentId === memberId && m.id !== memberId && !m.deleted
      );
      directChildren.forEach(child => {
        calculateRecursive(child.id);
      });
    }

    return totalPV;
  };

  useEffect(() => {
    if (user) {
      if (allMembersMap.size > 0 && !user.isAdmin) {
        const downline = Array.from(allMembersMap.values()).filter(m => m.sponsorId === user.id);
        setSponsoredMembers(downline);

        // Calculate group PV from all downline members
        const calculatedGroupPV = calculateGroupPV(user.id, allMembersMap);
        setGroupPV(calculatedGroupPV);

        // Count all downline members recursively (using placementParentId for binary tree)
        const countDownlineMembers = (memberId: string): number => {
          const visited = new Set<string>();

          const countRecursive = (id: string): number => {
            if (visited.has(id)) return 0;
            visited.add(id);

            // Find all direct children in the placement tree
            const children = Array.from(allMembersMap.values()).filter(
              m => m.placementParentId === id && m.id !== id && !m.deleted
            );

            // Count this level's children and recursively count their descendants
            let total = children.length;
            children.forEach(child => {
              total += countRecursive(child.id);
            });

            return total;
          };

          return countRecursive(memberId);
        };

        const totalDownline = countDownlineMembers(user.id);
        setActualTeamSize(totalDownline);
      }

      const placeholder = imageMap.get(user.avatarUrl);
      setAvatarSrc(placeholder?.imageUrl || user.avatarUrl);

      // Update addresses when user data changes
      setAddresses(user.addresses || []);
    }
  }, [user, allMembersMap]);


  const handleUpgradeAccount = async () => {
    if (!user || !handleUpdateMember) return;
    try {
      const success = await handleUpdateMember(user.id, { accountType: 'Distributor' });
      if (success) {
        toast({
          title: t('profile.accountUpgraded'),
          description: t('profile.upgradeSuccessMessage'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Upgrade Failed',
          description: 'Failed to upgrade your account. Please try again.',
        });
      }
    } catch (error) {
      console.error('Account upgrade failed:', error);
      toast({
        variant: 'destructive',
        title: 'Upgrade Error',
        description: 'An error occurred while upgrading your account. Please contact support.',
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0 || !handleUpdateMember) return;
    const file = event.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please select a valid image file.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select an image smaller than 5MB.',
      });
      return;
    }

    // Convert file to base64 for storage
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64String = e.target?.result as string;
        const success = await handleUpdateMember(user.id, { avatarUrl: base64String });
        if (success) {
          setAvatarSrc(base64String); // Update UI with base64
          toast({
            title: t('profile.avatarUpdated'),
            description: t('profile.avatarUpdatedDescription'),
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Failed to update avatar. Please try again.',
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: 'An error occurred while uploading. Please try again.',
        });
      }
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'File Read Error',
        description: 'Failed to read the selected file. Please try again.',
      });
    };
    reader.readAsDataURL(file);
  };


  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddressDialogOpen(true);
  }

  const handleOpenEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressDialogOpen(true);
  }

  const handleAddressDialogSuccess = () => {
    // Refresh addresses from user data
    if (user) {
      setAddresses(user.addresses || []);
    }
    setAddressDialogOpen(false);
  }

  const handleOpenDeleteDialog = (addressId: string) => {
    setDeletingAddressId(addressId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAddress = async () => {
    if (!user || !deletingAddressId) return;
    try {
      await deleteMemberAddress(user.id, deletingAddressId);
      toast({
        title: "Address Removed",
        description: "The address has been successfully removed from your account."
      });
      // Update local addresses state
      setAddresses(prev => prev.filter(addr => addr.id !== deletingAddressId));
    } catch (e) {
      console.error('Failed to delete address:', e);
      toast({
        variant: 'destructive',
        title: "Delete Failed",
        description: "Failed to remove the address. Please try again."
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingAddressId(null);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      await setDefaultMemberAddress(user.id, addressId);
      toast({
        title: "Default Address Updated",
        description: "Your preferred shipping address has been updated successfully."
      });
      // Update local addresses state
      setAddresses(prev => prev.map(addr => ({ ...addr, isDefault: addr.id === addressId })));
    } catch (e) {
      console.error('Failed to set default address:', e);
      toast({
        variant: 'destructive',
        title: "Update Failed",
        description: "Failed to set the default address. Please try again."
      });
    }
  }


  if (loading || !user) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center items-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-4 w-12 mb-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-5 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.isAdmin;

  return (
    <>
      <div className="flex-1 space-y-6 p-4 pt-6 sm:p-6 md:p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-24 h-24 group shrink-0">
                <div className="relative">
                  {user.rank && user.rank !== 'Member' ? (
                    /* Show only rank logo when rank is selected */
                    <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center">
                      <RankBadge rank={user.rank} className="w-24 h-24 rounded-full" />
                    </div>
                  ) : (
                    /* Show avatar when no rank or Member rank */
                    <Avatar className="w-24 h-24 border-4 border-primary shadow-md">
                      <AvatarImage src={avatarSrc} alt={user.fullName} />
                      <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                {(!user.rank || user.rank === 'Member') && (
                  <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                    <Upload className="h-6 w-6 text-white" />
                    <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <CardTitle className="text-3xl">{user.fullName}</CardTitle>
                {!isAdmin && <p className="text-muted-foreground">{user.memberId}</p>}
                <div className="mt-2 flex justify-center sm:justify-start items-center gap-2">
                  <Button asChild variant="outline" size="sm" icon="edit">
                    <Link href="/profile/edit">{t('profile.editProfile')}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangePasswordDialogOpen(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {t('profile.changePassword') || 'Change Password'}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isAdmin && user.accountType === 'Customer' && (
              <Card className="bg-primary/10 border-primary/50 text-center">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">{t('profile.readyToEarn')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t('profile.currentlyCustomer')}</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button icon={ArrowUpCircle}>
                        {t('profile.upgradeToDistributor')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('profile.confirmAccountUpgrade')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('profile.upgradeConfirmation')}
                          <br /><br />
                          <strong>This action cannot be undone.</strong> Your account will be upgraded to a Distributor account with full access to the compensation plan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUpgradeAccount} className="bg-primary hover:bg-primary/90">
                          {t('profile.confirmUpgrade')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {!isAdmin && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">{t('profile.memberId')}</p>
                    <p className="font-semibold">{user.memberId}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <UserCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t('profile.accountType')}</p>
                  {isAdmin ? (
                    <Badge variant='destructive' className="font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" />{t('profile.administrator')}</Badge>
                  ) : (
                    <Badge variant={user.accountType === 'Distributor' ? 'default' : 'secondary'} className="font-semibold">{user.accountType}</Badge>
                  )}
                </div>
              </div>
              {!isAdmin && (
                <>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Star className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.rank')}</p>
                      <RankBadge rank={user.rank} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.joinDate')}</p>
                      <p className="font-semibold">{new Date(user.joinDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.totalTeamSize')}</p>
                      <p className="font-semibold">
                        {actualTeamSize !== null ? actualTeamSize : (user.teamSize?.total ?? 0)} {t('profile.members')}
                      </p>
                    </div>
                  </div>
                  {user.storeOwnerLevel && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Store className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">{t('profile.stockistLevel')}</p>
                        <Badge variant="default" className="font-semibold">{`${user.storeOwnerLevel} ${t('profile.stockist')}`}</Badge>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {!isAdmin && user && (
          <>
            <NextRankRequirements
              currentRank={user.rank}
              personalPV={user.pv || 0}
              groupPV={groupPV}
              directRecruits={sponsoredMembers.length}
            />

            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><MapPin /> {t('profile.myAddresses')}</CardTitle>
                    <CardDescription>{t('profile.manageAddresses')}</CardDescription>
                  </div>
                  <Button variant="outline" icon={PlusCircle} onClick={handleOpenAddAddress}>{t('profile.addNew')}</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="flex flex-col sm:flex-row items-start justify-between p-4 border rounded-lg gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{addr.label}</p>
                          {addr.isDefault && <Badge variant="secondary">{t('profile.default')}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{addr.address}</p>
                        <p className="text-sm text-muted-foreground">{addr.city}, {addr.postalCode}</p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {!addr.isDefault && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetDefaultAddress(addr.id)}>{t('profile.setAsDefault')}</Button>
                        )}
                        <Button variant="outline" size="sm" icon={Edit} onClick={() => handleOpenEditAddress(addr)}>{t('profile.edit')}</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleOpenDeleteDialog(addr.id)} icon={Trash2} />
                      </div>
                    </div>
                  ))}
                  {addresses.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('profile.noAddresses') || 'You have not added any addresses yet.'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>{t('profile.directlySponsoredMembers')}</CardTitle>
                <CardDescription>
                  {t('profile.sponsoredDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('profile.member')}</TableHead>
                      <TableHead className="text-right" hidden={isMobile}>{t('profile.rank')}</TableHead>
                      <TableHead className="text-right">{t('profile.joinDate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sponsoredMembers.length > 0 ? (
                      sponsoredMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={imageMap.get(member.avatarUrl)?.imageUrl || member.avatarUrl} alt={member.fullName} />
                                <AvatarFallback>{member.fullName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.fullName}</p>
                                <p className="text-sm text-muted-foreground">{member.memberId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right" hidden={isMobile}>
                            <RankBadge rank={member.rank} />
                          </TableCell>
                          <TableCell className="text-right">{new Date(member.joinDate).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          {t('profile.noSponsoredMembers')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AddressDialog
        isOpen={isAddressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        onSuccess={handleAddressDialogSuccess}
        memberId={user.id}
        address={editingAddress}
        onAddAddress={(newAddress) => setAddresses(prev => [...prev, newAddress])}
        onUpdateAddress={(updatedAddress) => setAddresses(prev => prev.map(addr => addr.id === updatedAddress.id ? updatedAddress : addr))}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone and the address will be permanently removed from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAddress} className="bg-destructive hover:bg-destructive/90">
              Delete Address
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangePasswordDialog
        open={isChangePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
      />
    </>
  );
}
